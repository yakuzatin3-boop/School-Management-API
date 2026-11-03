import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExamAttempt } from './entities/exam-attempt.entity/exam-attempt.entity.js';
import { Assignment } from '../assignments/entities/assignment.entity/assignment.entity.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateExamAttemptDto } from './dto/create-exam-attempt.dto.js';
import { UpdateExamAttemptDto } from './dto/update-exam-attempt.dto.js';
import { SubmitExamAttemptDto } from './dto/submit-exam-attempt.dto.js';
import { QueryExamAttemptsDto } from './dto/query-exam-attempts.dto.js';
import { ExamAttemptStatus } from './dto/exam-attempt-status.js';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(ExamAttempt)
    private readonly attemptRepository: Repository<ExamAttempt>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    private readonly access: AcademicAccessService,
  ) {}

  async create(dto: CreateExamAttemptDto, actor: AcademicActor) {
    const assignment = await this.getAssignmentEntity(dto.assignmentId);
    const student = await this.resolveStudentForCreate(dto, assignment, actor);
    const attemptNumber = await this.getNextAttemptNumber(
      assignment.id,
      student.id,
    );

    const attempt = this.attemptRepository.create({
      assignment,
      student,
      attemptNumber,
      status: ExamAttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
      submittedAt: null,
      score: null,
    });

    try {
      const saved = await this.attemptRepository.save(attempt);

      return this.toPublicAttempt(await this.getAttemptEntity(saved.id));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An attempt with this number already exists for the student',
        );
      }

      throw error;
    }
  }

  async findAll(query: QueryExamAttemptsDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.attemptRepository
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.assignment', 'assignment')
      .leftJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('assignment.teacher', 'assignmentTeacher')
      .leftJoinAndSelect('attempt.student', 'student')
      .orderBy('attempt.startedAt', 'DESC')
      .addOrderBy('attempt.id', 'DESC');

    if (query.assignmentId) {
      queryBuilder.andWhere('attempt.assignment_id = :assignmentId', {
        assignmentId: query.assignmentId,
      });
    }

    if (query.studentId) {
      queryBuilder.andWhere('attempt.student_id = :studentId', {
        studentId: query.studentId,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('attempt.status = :status', {
        status: query.status,
      });
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);
      queryBuilder.andWhere('classTeacher.id = :actorTeacherId', {
        actorTeacherId: teacher.id,
      });
    } else if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);
      queryBuilder.andWhere('attempt.student_id = :actorStudentId', {
        actorStudentId: student.id,
      });
    }

    if (query.assignmentId) {
      await this.access.assertCanAccessClass(
        actor,
        await this.access.getSchoolClass(
          (await this.getAssignmentEntity(query.assignmentId)).schoolClass.id,
        ),
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [attempts, total] = await queryBuilder.getManyAndCount();

    return {
      data: attempts.map((attempt) => this.toPublicAttempt(attempt)),
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

  async findByAssignment(assignmentId: string, actor: AcademicActor) {
    const assignment = await this.getAssignmentEntity(assignmentId);
    await this.access.assertCanAccessClass(actor, assignment.schoolClass);

    return this.findAll({ assignmentId, limit: 100 }, actor);
  }

  async findOne(id: string, actor: AcademicActor) {
    const attempt = await this.getAttemptEntity(id);
    await this.assertCanAccessAttempt(actor, attempt);

    return this.toPublicAttempt(attempt);
  }

  async update(id: string, dto: UpdateExamAttemptDto, actor: AcademicActor) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const attempt = await this.getAttemptEntity(id);

    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (attempt.student.id !== student.id) {
        throw new ForbiddenException('You can only update your own attempts');
      }

      if (dto.score !== undefined) {
        throw new ForbiddenException(
          'Students cannot grade their own attempts',
        );
      }

      if (
        dto.status !== undefined &&
        dto.status !== ExamAttemptStatus.SUBMITTED
      ) {
        throw new ForbiddenException('Students can only submit an attempt');
      }
    } else {
      await this.access.assertCanManageClass(
        actor,
        attempt.assignment.schoolClass,
      );
    }

    if (dto.status !== undefined) {
      attempt.status = dto.status;

      if (
        (dto.status === ExamAttemptStatus.SUBMITTED ||
          dto.status === ExamAttemptStatus.GRADED) &&
        !attempt.submittedAt
      ) {
        attempt.submittedAt = new Date();
      }
    }

    if (dto.score !== undefined) {
      this.assertValidScore(dto.score, attempt.assignment.maxScore);
      attempt.score = dto.score;

      if (dto.status === undefined) {
        attempt.status = ExamAttemptStatus.GRADED;
        attempt.submittedAt ??= new Date();
      }
    }

    await this.attemptRepository.save(attempt);

    return this.toPublicAttempt(await this.getAttemptEntity(id));
  }

  async submit(id: string, dto: SubmitExamAttemptDto, actor: AcademicActor) {
    const attempt = await this.getAttemptEntity(id);

    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (attempt.student.id !== student.id) {
        throw new ForbiddenException('You can only submit your own attempts');
      }

      if (dto.score !== undefined) {
        throw new ForbiddenException(
          'Students cannot grade their own attempts',
        );
      }
    } else {
      await this.access.assertCanManageClass(
        actor,
        attempt.assignment.schoolClass,
      );
    }

    if (
      attempt.status === ExamAttemptStatus.SUBMITTED ||
      attempt.status === ExamAttemptStatus.GRADED
    ) {
      throw new ConflictException('This attempt has already been submitted');
    }

    attempt.status = ExamAttemptStatus.SUBMITTED;
    attempt.submittedAt = new Date();

    if (dto.score !== undefined) {
      this.assertValidScore(dto.score, attempt.assignment.maxScore);
      attempt.score = dto.score;
      attempt.status = ExamAttemptStatus.GRADED;
    }

    await this.attemptRepository.save(attempt);

    return this.toPublicAttempt(await this.getAttemptEntity(id));
  }

  async remove(id: string, actor: AcademicActor) {
    const attempt = await this.getAttemptEntity(id);

    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (attempt.student.id !== student.id) {
        throw new ForbiddenException('You can only delete your own attempts');
      }

      if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
        throw new ForbiddenException(
          'Only in-progress attempts can be deleted',
        );
      }
    } else {
      await this.access.assertCanManageClass(
        actor,
        attempt.assignment.schoolClass,
      );
    }

    await this.attemptRepository.remove(attempt);

    return { message: 'Exam attempt deleted successfully' };
  }

  private async resolveStudentForCreate(
    dto: CreateExamAttemptDto,
    assignment: Assignment,
    actor: AcademicActor,
  ) {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getActiveStudentForActor(actor.userId);

      if (dto.studentId && dto.studentId !== student.id) {
        throw new ForbiddenException(
          'You can only start attempts for yourself',
        );
      }

      await this.access.assertStudentEnrolledInClass(
        actor.userId,
        assignment.schoolClass.id,
      );

      return student;
    }

    await this.access.assertCanManageClass(actor, assignment.schoolClass);

    if (!dto.studentId) {
      throw new BadRequestException(
        'studentId is required when starting an attempt for a student',
      );
    }

    const student = await this.access.getStudent(dto.studentId);
    const enrollment = await this.access.findEnrollment(
      student.id,
      assignment.schoolClass.id,
    );

    if (!enrollment || !this.access.isActiveEnrollment(enrollment)) {
      throw new BadRequestException(
        'The student is not actively enrolled in this class',
      );
    }

    return student;
  }

  private async assertCanAccessAttempt(
    actor: AcademicActor,
    attempt: ExamAttempt,
  ) {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (attempt.student.id !== student.id) {
        throw new ForbiddenException('You can only access your own attempts');
      }

      return;
    }

    await this.access.assertCanAccessClass(
      actor,
      attempt.assignment.schoolClass,
    );
  }

  private async getNextAttemptNumber(assignmentId: string, studentId: string) {
    const result = await this.attemptRepository
      .createQueryBuilder('attempt')
      .select('COALESCE(MAX(attempt.attemptNumber), 0)', 'max')
      .where('attempt.assignment_id = :assignmentId', { assignmentId })
      .andWhere('attempt.student_id = :studentId', { studentId })
      .getRawOne<{ max: string | number }>();

    return Number(result?.max ?? 0) + 1;
  }

  private assertValidScore(score: number, maxScore: number | string) {
    if (!Number.isFinite(score) || score < 0) {
      throw new BadRequestException('score must be zero or greater');
    }

    if (score > Number(maxScore)) {
      throw new BadRequestException(
        `score cannot exceed the assignment maximum of ${maxScore}`,
      );
    }
  }

  private async getAssignmentEntity(id: string) {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: {
        schoolClass: { course: true, teacher: true },
        teacher: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  private async getAttemptEntity(id: string) {
    const attempt = await this.attemptRepository.findOne({
      where: { id },
      relations: {
        assignment: {
          schoolClass: { course: true, teacher: true },
          teacher: true,
        },
        student: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException('Exam attempt not found');
    }

    return attempt;
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

  private toPublicAttempt(attempt: ExamAttempt) {
    return {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score === null ? null : Number(attempt.score),
      assignment: {
        id: attempt.assignment.id,
        title: attempt.assignment.title,
        maxScore: Number(attempt.assignment.maxScore),
        dueAt: attempt.assignment.dueAt,
      },
      class: this.access.toClassSummary(attempt.assignment.schoolClass),
      student: this.access.toStudentSummary(attempt.student),
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }
}
