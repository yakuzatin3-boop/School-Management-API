import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import QRCode from 'qrcode';

import { ClassJoinCode } from './entities/class-join-code.entity/class-join-code.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity/student.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateClassJoinCodeDto } from './dto/create-class-join-code.dto.js';

const DEFAULT_EXPIRES_IN_HOURS = 24;

interface AuthenticatedActor {
  userId: string;
  role?: UserRole;
}

@Injectable()
export class ClassRegistrationService {
  constructor(
    @InjectRepository(ClassJoinCode)
    private readonly joinCodeRepository: Repository<ClassJoinCode>,
    @InjectRepository(SchoolClass)
    private readonly schoolClassRepository: Repository<SchoolClass>,
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createJoinCode(
    classId: string,
    actor: AuthenticatedActor,
    dto: CreateClassJoinCodeDto,
  ) {
    const schoolClass = await this.getClassForManager(classId, actor);
    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRES_IN_HOURS;

    const joinCodeId = randomUUID();
    const token = this.buildJoinCodeToken(joinCodeId);
    const joinCode = this.joinCodeRepository.create({
      id: joinCodeId,
      schoolClass,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      isActive: true,
      createdByUser: { id: actor.userId } as User,
    });

    const savedJoinCode = await this.joinCodeRepository.save(joinCode);

    return this.toPublicJoinCode(savedJoinCode, schoolClass.id);
  }

  async findJoinCodes(classId: string, actor: AuthenticatedActor) {
    const schoolClass = await this.getClassForManager(classId, actor);
    const joinCodes = await this.joinCodeRepository.find({
      where: {
        schoolClass: {
          id: schoolClass.id,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      joinCodes.map((joinCode) =>
        this.toPublicJoinCode(joinCode, schoolClass.id),
      ),
    );
  }

  async revokeJoinCode(
    classId: string,
    joinCodeId: string,
    actor: AuthenticatedActor,
  ) {
    const schoolClass = await this.getClassForManager(classId, actor);
    const joinCode = await this.joinCodeRepository.findOne({
      where: {
        id: joinCodeId,
        schoolClass: {
          id: schoolClass.id,
        },
      },
    });

    if (!joinCode) {
      throw new NotFoundException('Invitation not found');
    }

    if (joinCode.isActive) {
      joinCode.isActive = false;
      await this.joinCodeRepository.save(joinCode);
    }

    return this.toPublicJoinCode(joinCode, schoolClass.id);
  }

  async validateInvitation(token: string) {
    const joinCode = await this.getValidJoinCode(token);
    const schoolClass = joinCode.schoolClass;

    return {
      valid: true,
      expiresAt: joinCode.expiresAt,
      class: {
        id: schoolClass.id,
        classCode: schoolClass.classCode,
        name: schoolClass.name,
        status: schoolClass.status,
        course: schoolClass.course
          ? {
              id: schoolClass.course.id,
              name: schoolClass.course.name,
            }
          : null,
      },
    };
  }

  async joinClass(token: string, userId: string) {
    const joinCode = await this.getValidJoinCode(token);
    const schoolClass = joinCode.schoolClass;
    const student = await this.studentRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(
        'No student profile is linked to this account. Please contact an administrator.',
      );
    }

    if (student.status !== StudentStatus.ACTIVE) {
      throw new ForbiddenException('Only active students can join a class');
    }

    if (schoolClass.status !== 'active') {
      throw new BadRequestException('This class is not open for registration');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const joinCodeRepository = manager.getRepository(ClassJoinCode);
        const lockedJoinCode = await joinCodeRepository.findOne({
          where: {
            id: joinCode.id,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (
          !lockedJoinCode ||
          !lockedJoinCode.isActive ||
          lockedJoinCode.expiresAt.getTime() <= Date.now()
        ) {
          throw new NotFoundException('Invitation not found or has expired');
        }

        const enrollmentRepository = manager.getRepository(Enrollment);
        const existingEnrollment = await enrollmentRepository.findOne({
          where: {
            student: {
              id: student.id,
            },
            schoolClass: {
              id: schoolClass.id,
            },
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (
          existingEnrollment &&
          existingEnrollment.status === EnrollmentStatus.ACTIVE
        ) {
          throw new ConflictException('You are already enrolled in this class');
        }

        let enrollment: Enrollment;
        const oldStatus = existingEnrollment?.status ?? null;

        if (existingEnrollment) {
          existingEnrollment.status = EnrollmentStatus.ACTIVE;
          existingEnrollment.completedAt = null;
          enrollment = await enrollmentRepository.save(existingEnrollment);
        } else {
          enrollment = await enrollmentRepository.save(
            enrollmentRepository.create({
              student,
              schoolClass,
              status: EnrollmentStatus.ACTIVE,
            }),
          );
        }

        await manager.getRepository(EnrollmentStatusHistory).save(
          manager.getRepository(EnrollmentStatusHistory).create({
            enrollment,
            oldStatus,
            newStatus: EnrollmentStatus.ACTIVE,
            reason: 'Student joined class through QR registration',
            changedByUser: { id: userId } as User,
          }),
        );

        return this.toPublicEnrollment(enrollment, schoolClass);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('You are already enrolled in this class');
      }

      throw error;
    }
  }

  private async getClassForManager(classId: string, actor: AuthenticatedActor) {
    const schoolClass = await this.schoolClassRepository.findOne({
      where: {
        id: classId,
      },
      relations: {
        teacher: true,
      },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    if (actor.role === UserRole.ADMIN) {
      return schoolClass;
    }

    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('You do not have permission');
    }

    const teacher = await this.teacherRepository.findOne({
      where: {
        user: {
          id: actor.userId,
        },
      },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }

    if (!schoolClass.teacher || schoolClass.teacher.id !== teacher.id) {
      throw new ForbiddenException(
        'You can only manage invitations for your own classes',
      );
    }

    return schoolClass;
  }

  private async getValidJoinCode(token: string) {
    const joinCode = await this.joinCodeRepository.findOne({
      where: {
        tokenHash: this.hashToken(token),
      },
      relations: {
        schoolClass: {
          course: true,
        },
      },
    });

    if (
      !joinCode ||
      !joinCode.isActive ||
      joinCode.expiresAt.getTime() <= Date.now()
    ) {
      throw new NotFoundException('Invitation not found or has expired');
    }

    return joinCode;
  }

  private buildRegistrationUrl(token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:4200';

    return `${frontendUrl.replace(/\/+$/, '')}/class-registration/${encodeURIComponent(token)}`;
  }

  /**
   * Join-code tokens are deterministic for a given code id, so the original
   * QR/URL can be rebuilt for display without persisting the raw token.
   * Only its hash is stored in the database.
   */
  private buildJoinCodeToken(joinCodeId: string) {
    const secret =
      this.configService.get<string>('CLASS_JOIN_CODE_SECRET')?.trim() ||
      this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error(
        'CLASS_JOIN_CODE_SECRET or JWT_SECRET must be configured',
      );
    }

    const signature = createHmac('sha256', secret)
      .update(joinCodeId)
      .digest('base64url');

    return `${joinCodeId}.${signature}`;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async toPublicJoinCode(joinCode: ClassJoinCode, classId: string) {
    const isExpired = joinCode.expiresAt.getTime() <= Date.now();
    const canRegister = joinCode.isActive && !isExpired;
    const registrationUrl = canRegister
      ? this.buildRegistrationUrl(this.buildJoinCodeToken(joinCode.id))
      : null;

    return {
      id: joinCode.id,
      classId,
      registrationUrl,
      qrCodeDataUrl:
        registrationUrl === null
          ? null
          : await this.createQrCodeDataUrl(registrationUrl),
      expiresAt: joinCode.expiresAt,
      isActive: joinCode.isActive,
      isExpired,
      createdAt: joinCode.createdAt,
      updatedAt: joinCode.updatedAt,
    };
  }

  private createQrCodeDataUrl(content: string) {
    return QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    });
  }

  private toPublicEnrollment(enrollment: Enrollment, schoolClass: SchoolClass) {
    return {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.createdAt,
      completedAt: enrollment.completedAt,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
      class: {
        id: schoolClass.id,
        classCode: schoolClass.classCode,
        name: schoolClass.name,
        status: schoolClass.status,
        course: schoolClass.course
          ? {
              id: schoolClass.course.id,
              name: schoolClass.course.name,
            }
          : null,
      },
    };
  }

  private isUniqueViolation(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const codedError = error as {
      code?: string;
      driverError?: { code?: string };
    };

    return (
      codedError.code === '23505' || codedError.driverError?.code === '23505'
    );
  }
}
