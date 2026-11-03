import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Certificate } from './entities/certificate.entity/certificate.entity.js';
import { CertificateRequest } from './entities/certificate-request.entity/certificate-request.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateCertificateRequestDto } from './dto/create-certificate-request.dto.js';
import { ReviewCertificateRequestDto } from './dto/review-certificate-request.dto.js';
import { QueryCertificateRequestsDto } from './dto/query-certificate-requests.dto.js';
import { QueryCertificatesDto } from './dto/query-certificates.dto.js';
import { UpdateCertificateDto } from './dto/update-certificate.dto.js';
import { IssueCertificateDto } from './dto/issue-certificate.dto.js';
import { CertificateRequestStatus } from './dto/certificate-request-status.js';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    @InjectRepository(CertificateRequest)
    private readonly requestRepository: Repository<CertificateRequest>,
    private readonly access: AcademicAccessService,
  ) {}

  // REQUESTS

  async createRequest(dto: CreateCertificateRequestDto, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(dto.classId);
    const student = await this.resolveStudentForRequest(
      dto,
      schoolClass.id,
      actor,
    );
    const requestedByTeacher =
      actor.role === UserRole.TEACHER
        ? await this.access.getTeacherForActor(actor.userId)
        : null;

    await this.assertEnrolled(student.id, schoolClass.id);

    const existing = await this.requestRepository.findOne({
      where: {
        student: { id: student.id },
        schoolClass: { id: schoolClass.id },
        status: CertificateRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A pending certificate request already exists for this class',
      );
    }

    const request = this.requestRepository.create({
      student,
      schoolClass,
      requestedByTeacher,
      reason: dto.reason?.trim() || null,
      status: CertificateRequestStatus.PENDING,
      reviewNotes: null,
      reviewedByUser: null,
      reviewedAt: null,
    });

    const saved = await this.requestRepository.save(request);

    return this.toPublicRequest(await this.getRequestEntity(saved.id));
  }

  async findAllRequests(
    query: QueryCertificateRequestsDto,
    actor: AcademicActor,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.student', 'student')
      .leftJoinAndSelect('request.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('request.requestedByTeacher', 'requestedByTeacher')
      .leftJoinAndSelect('request.reviewedByUser', 'reviewedByUser')
      .leftJoinAndSelect('request.certificate', 'certificate')
      .orderBy('request.requestedAt', 'DESC')
      .addOrderBy('request.id', 'DESC');

    if (query.status) {
      queryBuilder.andWhere('request.status = :status', {
        status: query.status,
      });
    }

    if (query.classId) {
      queryBuilder.andWhere('schoolClass.id = :classId', {
        classId: query.classId,
      });
    }

    if (query.studentId) {
      queryBuilder.andWhere('student.id = :studentId', {
        studentId: query.studentId,
      });
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);
      queryBuilder.andWhere('classTeacher.id = :actorTeacherId', {
        actorTeacherId: teacher.id,
      });
    } else if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);
      queryBuilder.andWhere('student.id = :actorStudentId', {
        actorStudentId: student.id,
      });
    }

    if (query.classId) {
      await this.access.assertCanAccessClass(
        actor,
        await this.access.getSchoolClass(query.classId),
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [requests, total] = await queryBuilder.getManyAndCount();

    return {
      data: requests.map((request) => this.toPublicRequest(request)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findRequest(id: string, actor: AcademicActor) {
    const request = await this.getRequestEntity(id);
    await this.assertCanAccessRequest(actor, request);

    return this.toPublicRequest(request);
  }

  async reviewRequest(
    id: string,
    dto: ReviewCertificateRequestDto,
    actor: AcademicActor,
  ) {
    const request = await this.getRequestEntity(id);
    await this.access.assertCanManageClass(actor, request.schoolClass);

    if (
      dto.status !== CertificateRequestStatus.APPROVED &&
      dto.status !== CertificateRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        'A request can only be approved or rejected',
      );
    }

    if (request.status !== CertificateRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been reviewed');
    }

    request.status = dto.status;
    request.reviewNotes = dto.reviewNotes?.trim() || null;
    request.reviewedByUser = { id: actor.userId } as User;
    request.reviewedAt = new Date();

    await this.requestRepository.save(request);

    return this.toPublicRequest(await this.getRequestEntity(id));
  }

  async removeRequest(id: string, actor: AcademicActor) {
    const request = await this.getRequestEntity(id);

    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (request.student.id !== student.id) {
        throw new ForbiddenException(
          'You can only delete your own certificate requests',
        );
      }

      if (request.status !== CertificateRequestStatus.PENDING) {
        throw new ForbiddenException('Only pending requests can be deleted');
      }
    } else {
      await this.access.assertCanManageClass(actor, request.schoolClass);
    }

    await this.requestRepository.remove(request);

    return { message: 'Certificate request deleted successfully' };
  }

  async issueCertificate(
    requestId: string,
    dto: IssueCertificateDto,
    actor: AcademicActor,
  ) {
    const request = await this.getRequestEntity(requestId);
    await this.access.assertCanManageClass(actor, request.schoolClass);

    if (request.status === CertificateRequestStatus.REJECTED) {
      throw new BadRequestException(
        'A rejected request cannot be issued a certificate',
      );
    }

    if (request.certificate) {
      throw new ConflictException(
        'A certificate has already been issued for this request',
      );
    }

    const certificate = this.certificateRepository.create({
      certificateNumber: this.generateCertificateNumber(),
      fileUrl: dto.fileUrl?.trim() || null,
      issuedAt: new Date(),
      student: request.student,
      schoolClass: request.schoolClass,
      certificateRequest: request,
    });

    const saved = await this.certificateRepository.save(certificate);

    if (request.status !== CertificateRequestStatus.APPROVED) {
      request.status = CertificateRequestStatus.APPROVED;
      request.reviewedByUser = { id: actor.userId } as User;
      request.reviewedAt ??= new Date();

      await this.requestRepository.save(request);
    }

    return this.toPublicCertificate(await this.getCertificateEntity(saved.id));
  }

  // CERTIFICATES

  async findAllCertificates(query: QueryCertificatesDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.certificateRepository
      .createQueryBuilder('certificate')
      .leftJoinAndSelect('certificate.student', 'student')
      .leftJoinAndSelect('certificate.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('certificate.certificateRequest', 'request')
      .orderBy('certificate.issuedAt', 'DESC')
      .addOrderBy('certificate.id', 'DESC');

    if (query.classId) {
      queryBuilder.andWhere('schoolClass.id = :classId', {
        classId: query.classId,
      });
    }

    if (query.studentId) {
      queryBuilder.andWhere('student.id = :studentId', {
        studentId: query.studentId,
      });
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);
      queryBuilder.andWhere('classTeacher.id = :actorTeacherId', {
        actorTeacherId: teacher.id,
      });
    } else if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);
      queryBuilder.andWhere('student.id = :actorStudentId', {
        actorStudentId: student.id,
      });
    }

    if (query.classId) {
      await this.access.assertCanAccessClass(
        actor,
        await this.access.getSchoolClass(query.classId),
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [certificates, total] = await queryBuilder.getManyAndCount();

    return {
      data: certificates.map((certificate) =>
        this.toPublicCertificate(certificate),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findCertificate(id: string, actor: AcademicActor) {
    const certificate = await this.getCertificateEntity(id);

    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (certificate.student.id !== student.id) {
        throw new ForbiddenException(
          'You can only access your own certificates',
        );
      }
    } else {
      await this.access.assertCanAccessClass(actor, certificate.schoolClass);
    }

    return this.toPublicCertificate(certificate);
  }

  async updateCertificate(
    id: string,
    dto: UpdateCertificateDto,
    actor: AcademicActor,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const certificate = await this.getCertificateEntity(id);
    await this.access.assertCanManageClass(actor, certificate.schoolClass);

    if (dto.fileUrl !== undefined) {
      certificate.fileUrl = dto.fileUrl?.trim() || null;
    }

    await this.certificateRepository.save(certificate);

    return this.toPublicCertificate(await this.getCertificateEntity(id));
  }

  async removeCertificate(id: string, actor: AcademicActor) {
    const certificate = await this.getCertificateEntity(id);
    await this.access.assertCanManageClass(actor, certificate.schoolClass);

    await this.certificateRepository.remove(certificate);

    return { message: 'Certificate deleted successfully' };
  }

  private async resolveStudentForRequest(
    dto: CreateCertificateRequestDto,
    classId: string,
    actor: AcademicActor,
  ): Promise<Student> {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getActiveStudentForActor(actor.userId);

      if (dto.studentId && dto.studentId !== student.id) {
        throw new ForbiddenException(
          'You can only request certificates for yourself',
        );
      }

      await this.access.assertStudentEnrolledInClass(actor.userId, classId);

      return student;
    }

    if (actor.role === UserRole.TEACHER) {
      await this.access.assertCanManageClass(
        actor,
        await this.access.getSchoolClass(classId),
      );
    }

    if (!dto.studentId) {
      throw new BadRequestException(
        'studentId is required when requesting on behalf of a student',
      );
    }

    return this.access.getStudent(dto.studentId);
  }

  private async assertEnrolled(studentId: string, classId: string) {
    const enrollment = await this.access.findEnrollment(studentId, classId);

    if (!enrollment || !this.access.isActiveEnrollment(enrollment)) {
      throw new BadRequestException(
        'The student is not actively enrolled in this class',
      );
    }
  }

  private async assertCanAccessRequest(
    actor: AcademicActor,
    request: CertificateRequest,
  ) {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (request.student.id !== student.id) {
        throw new ForbiddenException(
          'You can only access your own certificate requests',
        );
      }

      return;
    }

    await this.access.assertCanAccessClass(actor, request.schoolClass);
  }

  private async getRequestEntity(id: string) {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: {
        student: true,
        schoolClass: { course: true, teacher: true },
        requestedByTeacher: true,
        reviewedByUser: true,
        certificate: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Certificate request not found');
    }

    return request;
  }

  private async getCertificateEntity(id: string) {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
      relations: {
        student: true,
        schoolClass: { course: true, teacher: true },
        certificateRequest: {
          requestedByTeacher: true,
          reviewedByUser: true,
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }

  private generateCertificateNumber() {
    const year = new Date().getFullYear();
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

    return `CERT-${year}-${suffix}`;
  }

  private toPublicRequest(request: CertificateRequest) {
    return {
      id: request.id,
      status: request.status,
      reason: request.reason,
      reviewNotes: request.reviewNotes,
      requestedAt: request.requestedAt,
      reviewedAt: request.reviewedAt,
      student: this.access.toStudentSummary(request.student),
      class: this.access.toClassSummary(request.schoolClass),
      requestedByTeacher: this.access.toTeacherSummary(
        request.requestedByTeacher,
      ),
      reviewedBy: this.access.toUserSummary(request.reviewedByUser),
      certificate: request.certificate
        ? {
            id: request.certificate.id,
            certificateNumber: request.certificate.certificateNumber,
            issuedAt: request.certificate.issuedAt,
            fileUrl: request.certificate.fileUrl,
          }
        : null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private toPublicCertificate(certificate: Certificate) {
    return {
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      fileUrl: certificate.fileUrl,
      issuedAt: certificate.issuedAt,
      student: this.access.toStudentSummary(certificate.student),
      class: this.access.toClassSummary(certificate.schoolClass),
      request: certificate.certificateRequest
        ? {
            id: certificate.certificateRequest.id,
            status: certificate.certificateRequest.status,
            requestedAt: certificate.certificateRequest.requestedAt,
            reviewedAt: certificate.certificateRequest.reviewedAt,
          }
        : null,
      createdAt: certificate.createdAt,
      updatedAt: certificate.updatedAt,
    };
  }
}
