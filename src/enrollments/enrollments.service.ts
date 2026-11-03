import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import {
  Enrollment,
  EnrollmentStatus,
} from './entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from './entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto.js';

interface EnrollmentActor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(EnrollmentStatusHistory)
    private readonly enrollmentStatusHistoryRepository: Repository<EnrollmentStatusHistory>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(SchoolClass)
    private readonly schoolClassRepository: Repository<SchoolClass>,
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
  ) {}

  // CREATE ENROLLMENT
  async create(
    createEnrollmentDto: CreateEnrollmentDto,
    actor: EnrollmentActor,
  ) {
    const student = await this.getStudent(createEnrollmentDto.studentId);

    if (student.status === StudentStatus.GRADUATED) {
      throw new BadRequestException(
        'A graduated student cannot be enrolled in a class',
      );
    }

    const schoolClass = await this.getSchoolClass(createEnrollmentDto.classId);

    await this.assertActorCanManageClass(actor, schoolClass);

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        student: { id: student.id },
        schoolClass: { id: schoolClass.id },
      },
      relations: {
        statusHistory: true,
      },
    });

    if (existingEnrollment?.status === EnrollmentStatus.ACTIVE) {
      throw new ConflictException('Student is already enrolled in this class');
    }

    if (existingEnrollment) {
      const oldStatus = existingEnrollment.status;
      const newStatus = createEnrollmentDto.status ?? EnrollmentStatus.ACTIVE;

      existingEnrollment.status = newStatus;
      existingEnrollment.completedAt = this.resolveCompletedAt(
        newStatus,
        createEnrollmentDto.completedAt,
        existingEnrollment.completedAt,
      );

      const savedEnrollment =
        await this.enrollmentRepository.save(existingEnrollment);

      if (oldStatus !== newStatus) {
        await this.recordStatusHistory(
          savedEnrollment,
          oldStatus,
          newStatus,
          actor.userId,
          createEnrollmentDto.reason ?? 'Student re-enrolled in class',
        );
      }

      return this.toPublicEnrollment(
        await this.getEnrollmentEntity(savedEnrollment.id),
      );
    }

    const status = createEnrollmentDto.status ?? EnrollmentStatus.ACTIVE;

    try {
      const enrollment = await this.enrollmentRepository.save(
        this.enrollmentRepository.create({
          student,
          schoolClass,
          status,
          completedAt: this.resolveCompletedAt(
            status,
            createEnrollmentDto.completedAt,
          ),
        }),
      );

      await this.recordStatusHistory(
        enrollment,
        null,
        status,
        actor.userId,
        createEnrollmentDto.reason ?? 'Student enrolled in class',
      );

      return this.toPublicEnrollment(
        await this.getEnrollmentEntity(enrollment.id),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Student is already enrolled in this class',
        );
      }

      throw error;
    }
  }

  // GET ALL ENROLLMENTS WITH FILTERS
  async findAll(query: QueryEnrollmentDto, actor: EnrollmentActor) {
    const { studentId, classId, status } = query;
    const where: FindOptionsWhere<Enrollment> = {};
    const classWhere: FindOptionsWhere<SchoolClass> = {};

    if (studentId) {
      where.student = { id: studentId };
    }

    if (status) {
      where.status = status;
    }

    if (classId) {
      classWhere.id = classId;
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.getTeacherForActor(actor.userId);

      if (classId) {
        const schoolClass = await this.getSchoolClass(classId);
        this.assertTeacherOwnsClass(teacher, schoolClass);
      }

      classWhere.teacher = { id: teacher.id };
    }

    if (Object.keys(classWhere).length > 0) {
      where.schoolClass = classWhere;
    }

    const enrollments = await this.enrollmentRepository.find({
      where,
      relations: {
        student: true,
        schoolClass: {
          course: true,
          teacher: true,
        },
        statusHistory: {
          changedByUser: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return enrollments.map((enrollment) => this.toPublicEnrollment(enrollment));
  }

  // GET ONE ENROLLMENT
  async findOne(id: string, actor: EnrollmentActor) {
    const enrollment = await this.getAccessibleEnrollment(id, actor);

    return this.toPublicEnrollment(enrollment);
  }

  // GET ENROLLMENTS FOR A STUDENT
  async findByStudent(studentId: string, actor: EnrollmentActor) {
    await this.getStudent(studentId);

    return this.findAll({ studentId }, actor);
  }

  // GET ENROLLMENTS FOR A CLASS
  async findByClass(classId: string, actor: EnrollmentActor) {
    const schoolClass = await this.getSchoolClass(classId);

    await this.assertActorCanManageClass(actor, schoolClass);

    return this.findAll({ classId }, actor);
  }

  // GET ENROLLMENT STATUS HISTORY
  async findHistory(id: string, actor: EnrollmentActor) {
    const enrollment = await this.getAccessibleEnrollment(id, actor);

    const history = await this.enrollmentStatusHistoryRepository.find({
      where: {
        enrollment: { id: enrollment.id },
      },
      relations: {
        changedByUser: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return history.map((entry) => this.toPublicHistoryEntry(entry));
  }

  // UPDATE ENROLLMENT
  async update(
    id: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
    actor: EnrollmentActor,
  ) {
    if (
      updateEnrollmentDto.status === undefined &&
      updateEnrollmentDto.completedAt === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const enrollment = await this.getAccessibleEnrollment(id, actor);
    const oldStatus = enrollment.status;

    if (updateEnrollmentDto.status !== undefined) {
      enrollment.status = updateEnrollmentDto.status;
    }

    if (
      updateEnrollmentDto.completedAt !== undefined ||
      updateEnrollmentDto.status !== undefined
    ) {
      enrollment.completedAt = this.resolveCompletedAt(
        enrollment.status,
        updateEnrollmentDto.completedAt,
        enrollment.completedAt,
      );
    }

    const savedEnrollment = await this.enrollmentRepository.save(enrollment);

    if (
      updateEnrollmentDto.status !== undefined &&
      updateEnrollmentDto.status !== oldStatus
    ) {
      await this.recordStatusHistory(
        savedEnrollment,
        oldStatus,
        updateEnrollmentDto.status,
        actor.userId,
        updateEnrollmentDto.reason ?? 'Enrollment status updated',
      );
    }

    return this.toPublicEnrollment(
      await this.getEnrollmentEntity(savedEnrollment.id),
    );
  }

  // DELETE ENROLLMENT
  async remove(id: string, actor: EnrollmentActor) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only administrators can delete enrollments',
      );
    }

    const enrollment = await this.getEnrollmentEntity(id);

    await this.enrollmentRepository.remove(enrollment);

    return {
      message: 'Enrollment deleted successfully',
    };
  }

  private resolveCompletedAt(
    status: EnrollmentStatus,
    requestedCompletedAt?: string | null,
    currentCompletedAt?: Date | null,
  ) {
    if (requestedCompletedAt !== undefined) {
      return requestedCompletedAt === null
        ? null
        : new Date(requestedCompletedAt);
    }

    if (status === EnrollmentStatus.WITHDRAWN) {
      return currentCompletedAt ?? new Date();
    }

    return null;
  }

  private async recordStatusHistory(
    enrollment: Enrollment,
    oldStatus: string | null,
    newStatus: EnrollmentStatus,
    changedByUserId: string,
    reason?: string,
  ) {
    const history = this.enrollmentStatusHistoryRepository.create({
      enrollment,
      oldStatus,
      newStatus,
      reason: reason?.trim() || null,
      changedByUser: {
        id: changedByUserId,
      } as User,
    });

    await this.enrollmentStatusHistoryRepository.save(history);
  }

  private async getAccessibleEnrollment(id: string, actor: EnrollmentActor) {
    const enrollment = await this.getEnrollmentEntity(id);

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.getTeacherForActor(actor.userId);
      this.assertTeacherOwnsClass(teacher, enrollment.schoolClass);
    }

    return enrollment;
  }

  private async getEnrollmentEntity(id: string) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id },
      relations: {
        student: true,
        schoolClass: {
          course: true,
          teacher: true,
        },
        statusHistory: {
          changedByUser: true,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    return enrollment;
  }

  private async getStudent(id: string) {
    const student = await this.studentRepository.findOneBy({ id });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  private async getSchoolClass(id: string) {
    const schoolClass = await this.schoolClassRepository.findOne({
      where: { id },
      relations: {
        course: true,
        teacher: true,
      },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  private async getTeacherForActor(userId: string) {
    const teacher = await this.teacherRepository.findOne({
      where: {
        user: { id: userId },
      },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }

    return teacher;
  }

  private async assertActorCanManageClass(
    actor: EnrollmentActor,
    schoolClass: SchoolClass,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('You do not have permission');
    }

    const teacher = await this.getTeacherForActor(actor.userId);
    this.assertTeacherOwnsClass(teacher, schoolClass);
  }

  private assertTeacherOwnsClass(teacher: Teacher, schoolClass: SchoolClass) {
    if (!schoolClass.teacher || schoolClass.teacher.id !== teacher.id) {
      throw new ForbiddenException(
        'You can only manage enrollments for your own classes',
      );
    }
  }

  private toPublicEnrollment(enrollment: Enrollment) {
    return {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.createdAt,
      completedAt: enrollment.completedAt,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
      student: enrollment.student
        ? {
            id: enrollment.student.id,
            studentNumber: enrollment.student.studentNumber,
            firstName: enrollment.student.firstName,
            lastName: enrollment.student.lastName,
            email: enrollment.student.email,
            status: enrollment.student.status,
          }
        : null,
      class: enrollment.schoolClass
        ? {
            id: enrollment.schoolClass.id,
            classCode: enrollment.schoolClass.classCode,
            name: enrollment.schoolClass.name,
            status: enrollment.schoolClass.status,
            course: enrollment.schoolClass.course
              ? {
                  id: enrollment.schoolClass.course.id,
                  name: enrollment.schoolClass.course.name,
                }
              : null,
            teacher: enrollment.schoolClass.teacher
              ? {
                  id: enrollment.schoolClass.teacher.id,
                  teacherNumber: enrollment.schoolClass.teacher.teacherNumber,
                  firstName: enrollment.schoolClass.teacher.firstName,
                  lastName: enrollment.schoolClass.teacher.lastName,
                }
              : null,
          }
        : null,
      statusHistory: [...(enrollment.statusHistory ?? [])]
        .sort(
          (first, second) =>
            second.createdAt.getTime() - first.createdAt.getTime(),
        )
        .map((entry) => this.toPublicHistoryEntry(entry)),
    };
  }

  private toPublicHistoryEntry(entry: EnrollmentStatusHistory) {
    return {
      id: entry.id,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      createdAt: entry.createdAt,
      changedBy: entry.changedByUser
        ? {
            id: entry.changedByUser.id,
            email: entry.changedByUser.email,
            role: entry.changedByUser.role,
          }
        : null,
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
