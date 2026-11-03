import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { GradeScale } from './entities/grade-scale.entity/grade-scale.entity.js';
import { Score } from './entities/score.entity/score.entity.js';
import { Submission } from '../submissions/entities/submission.entity/submission.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateGradeScaleDto } from './dto/create-grade-scale.dto.js';
import { UpdateGradeScaleDto } from './dto/update-grade-scale.dto.js';
import { QueryGradeScalesDto } from './dto/query-grade-scales.dto.js';
import { CreateScoreDto } from './dto/create-score.dto.js';
import { UpdateScoreDto } from './dto/update-score.dto.js';
import { QueryScoresDto } from './dto/query-scores.dto.js';

@Injectable()
export class GradingService {
  constructor(
    @InjectRepository(GradeScale)
    private readonly gradeScaleRepository: Repository<GradeScale>,
    @InjectRepository(Score)
    private readonly scoreRepository: Repository<Score>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly access: AcademicAccessService,
  ) {}

  // GRADE SCALES

  async createGradeScale(dto: CreateGradeScaleDto) {
    this.assertRange(dto.minScore, dto.maxScore);

    const gradeScale = this.gradeScaleRepository.create({
      name: dto.name.trim(),
      label: dto.label.trim(),
      minScore: dto.minScore,
      maxScore: dto.maxScore,
      description: dto.description?.trim() || null,
    });

    const saved = await this.gradeScaleRepository.save(gradeScale);

    return this.toPublicGradeScale(saved);
  }

  async findGradeScales(query: QueryGradeScalesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.search?.trim()
      ? [
          { name: ILike(`%${query.search.trim()}%`) },
          { label: ILike(`%${query.search.trim()}%`) },
        ]
      : {};

    const [gradeScales, total] = await this.gradeScaleRepository.findAndCount({
      where,
      order: { minScore: 'DESC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: gradeScales.map((gradeScale) =>
        this.toPublicGradeScale(gradeScale),
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

  async findGradeScale(id: string) {
    return this.toPublicGradeScale(await this.getGradeScaleEntity(id));
  }

  async updateGradeScale(id: string, dto: UpdateGradeScaleDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const gradeScale = await this.getGradeScaleEntity(id);
    const minScore = dto.minScore ?? Number(gradeScale.minScore);
    const maxScore = dto.maxScore ?? Number(gradeScale.maxScore);

    this.assertRange(minScore, maxScore);

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('Grade scale name cannot be empty');
      }

      gradeScale.name = name;
    }

    if (dto.label !== undefined) {
      const label = dto.label.trim();

      if (!label) {
        throw new BadRequestException('Grade scale label cannot be empty');
      }

      gradeScale.label = label;
    }

    if (dto.minScore !== undefined) {
      gradeScale.minScore = dto.minScore;
    }

    if (dto.maxScore !== undefined) {
      gradeScale.maxScore = dto.maxScore;
    }

    if (dto.description !== undefined) {
      gradeScale.description = dto.description?.trim() || null;
    }

    await this.gradeScaleRepository.save(gradeScale);

    return this.toPublicGradeScale(await this.getGradeScaleEntity(id));
  }

  async removeGradeScale(id: string) {
    const gradeScale = await this.getGradeScaleEntity(id);

    await this.gradeScaleRepository.remove(gradeScale);

    return { message: 'Grade scale deleted successfully' };
  }

  // SCORES

  async createScore(dto: CreateScoreDto, actor: AcademicActor) {
    const submission = await this.getSubmissionEntity(dto.submissionId);
    await this.assertCanGradeSubmission(actor, submission);
    this.assertScoreWithinMax(dto.score, submission.assignment.maxScore);

    const gradeScale = dto.gradeScaleId
      ? await this.getGradeScaleEntity(dto.gradeScaleId)
      : null;
    const gradedByTeacher = await this.resolveGradingTeacher(
      actor,
      dto.gradedByTeacherId,
    );

    const score = this.scoreRepository.create({
      submission,
      score: dto.score,
      feedback: dto.feedback?.trim() || null,
      gradeScale,
      gradedByTeacher,
      gradedAt: new Date(),
    });

    const saved = await this.scoreRepository.save(score);

    return this.toPublicScore(await this.getScoreEntity(saved.id));
  }

  async findScores(query: QueryScoresDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.scoreRepository
      .createQueryBuilder('score')
      .leftJoinAndSelect('score.submission', 'submission')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('submission.student', 'student')
      .leftJoinAndSelect('submission.studentGroup', 'studentGroup')
      .leftJoinAndSelect('score.gradedByTeacher', 'gradedByTeacher')
      .leftJoinAndSelect('score.gradeScale', 'gradeScale')
      .orderBy('score.gradedAt', 'DESC')
      .addOrderBy('score.id', 'DESC');

    if (query.submissionId) {
      queryBuilder.andWhere('score.submission_id = :submissionId', {
        submissionId: query.submissionId,
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

    if (query.teacherId) {
      queryBuilder.andWhere('gradedByTeacher.id = :teacherId', {
        teacherId: query.teacherId,
      });
    }

    if (query.gradeScaleId) {
      queryBuilder.andWhere('gradeScale.id = :gradeScaleId', {
        gradeScaleId: query.gradeScaleId,
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

    if (query.submissionId) {
      const submission = await this.getSubmissionEntity(query.submissionId);
      await this.assertCanAccessSubmission(actor, submission);
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [scores, total] = await queryBuilder.getManyAndCount();

    return {
      data: scores.map((score) => this.toPublicScore(score)),
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

  async findScore(id: string, actor: AcademicActor) {
    const score = await this.getScoreEntity(id);
    await this.assertCanAccessSubmission(actor, score.submission);

    return this.toPublicScore(score);
  }

  async updateScore(id: string, dto: UpdateScoreDto, actor: AcademicActor) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const score = await this.getScoreEntity(id);
    await this.assertCanGradeSubmission(actor, score.submission);

    if (dto.score !== undefined) {
      this.assertScoreWithinMax(
        dto.score,
        score.submission.assignment.maxScore,
      );
      score.score = dto.score;
      score.gradedAt = new Date();
    }

    if (dto.feedback !== undefined) {
      score.feedback = dto.feedback?.trim() || null;
    }

    if (dto.gradeScaleId !== undefined) {
      score.gradeScale = dto.gradeScaleId
        ? await this.getGradeScaleEntity(dto.gradeScaleId)
        : null;
    }

    if (dto.gradedByTeacherId !== undefined) {
      score.gradedByTeacher = await this.resolveGradingTeacher(
        actor,
        dto.gradedByTeacherId,
      );
    }

    await this.scoreRepository.save(score);

    return this.toPublicScore(await this.getScoreEntity(id));
  }

  async removeScore(id: string, actor: AcademicActor) {
    const score = await this.getScoreEntity(id);
    await this.assertCanGradeSubmission(actor, score.submission);

    await this.scoreRepository.remove(score);

    return { message: 'Score deleted successfully' };
  }

  async findBySubmission(submissionId: string, actor: AcademicActor) {
    const submission = await this.getSubmissionEntity(submissionId);
    await this.assertCanAccessSubmission(actor, submission);

    return this.findScores({ submissionId, limit: 100 }, actor);
  }

  async findByClass(classId: string, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(classId);
    await this.access.assertCanAccessClass(actor, schoolClass);

    return this.findScores({ classId, limit: 100 }, actor);
  }

  private async getGradeScaleEntity(id: string) {
    const gradeScale = await this.gradeScaleRepository.findOneBy({ id });

    if (!gradeScale) {
      throw new NotFoundException('Grade scale not found');
    }

    return gradeScale;
  }

  private async getScoreEntity(id: string) {
    const score = await this.scoreRepository.findOne({
      where: { id },
      relations: {
        submission: {
          assignment: {
            schoolClass: { course: true, teacher: true },
            teacher: true,
          },
          student: true,
          studentGroup: true,
        },
        gradedByTeacher: true,
        gradeScale: true,
      },
    });

    if (!score) {
      throw new NotFoundException('Score not found');
    }

    return score;
  }

  private async getSubmissionEntity(id: string) {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: {
        assignment: {
          schoolClass: { course: true, teacher: true },
          teacher: true,
        },
        student: true,
        studentGroup: true,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  private async assertCanGradeSubmission(
    actor: AcademicActor,
    submission: Submission,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('You do not have permission to grade');
    }

    const teacher = await this.access.getTeacherForActor(actor.userId);

    if (submission.assignment.schoolClass.teacher?.id !== teacher.id) {
      throw new ForbiddenException(
        'You can only grade submissions in your own classes',
      );
    }
  }

  private async assertCanAccessSubmission(
    actor: AcademicActor,
    submission: Submission,
  ) {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);

      if (submission.student?.id !== student.id) {
        throw new ForbiddenException('You can only access your own scores');
      }

      return;
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);

      if (submission.assignment.schoolClass.teacher?.id !== teacher.id) {
        throw new ForbiddenException(
          'You can only access scores in your own classes',
        );
      }

      return;
    }
  }

  private async resolveGradingTeacher(
    actor: AcademicActor,
    gradedByTeacherId: string | null | undefined,
  ): Promise<Teacher | null> {
    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);

      if (gradedByTeacherId && gradedByTeacherId !== teacher.id) {
        throw new ForbiddenException(
          'You can only attribute grades to yourself',
        );
      }

      return teacher;
    }

    if (gradedByTeacherId) {
      return this.access.getTeacher(gradedByTeacherId);
    }

    return null;
  }

  private assertRange(minScore: number, maxScore: number) {
    if (!Number.isFinite(minScore) || !Number.isFinite(maxScore)) {
      throw new BadRequestException('Grade scale bounds must be numbers');
    }

    if (minScore < 0) {
      throw new BadRequestException('minScore cannot be negative');
    }

    if (minScore > maxScore) {
      throw new BadRequestException('minScore cannot exceed maxScore');
    }
  }

  private assertScoreWithinMax(score: number, maxScore: number | string) {
    if (!Number.isFinite(score) || score < 0) {
      throw new BadRequestException('score must be zero or greater');
    }

    if (score > Number(maxScore)) {
      throw new BadRequestException(
        `score cannot exceed the assignment maximum of ${maxScore}`,
      );
    }
  }

  private toPublicGradeScale(gradeScale: GradeScale) {
    return {
      id: gradeScale.id,
      name: gradeScale.name,
      label: gradeScale.label,
      minScore: Number(gradeScale.minScore),
      maxScore: Number(gradeScale.maxScore),
      description: gradeScale.description,
      createdAt: gradeScale.createdAt,
      updatedAt: gradeScale.updatedAt,
    };
  }

  private toPublicScore(score: Score) {
    return {
      id: score.id,
      score: Number(score.score),
      feedback: score.feedback,
      gradedAt: score.gradedAt,
      submission: {
        id: score.submission.id,
        status: score.submission.status,
        isLate: score.submission.isLate,
        submittedAt: score.submission.submittedAt,
      },
      assignment: {
        id: score.submission.assignment.id,
        title: score.submission.assignment.title,
        maxScore: Number(score.submission.assignment.maxScore),
      },
      class: this.access.toClassSummary(
        score.submission.assignment.schoolClass,
      ),
      student: this.access.toStudentSummary(score.submission.student),
      group: score.submission.studentGroup
        ? {
            id: score.submission.studentGroup.id,
            name: score.submission.studentGroup.name,
          }
        : null,
      gradedByTeacher: this.access.toTeacherSummary(score.gradedByTeacher),
      gradeScale: score.gradeScale
        ? {
            id: score.gradeScale.id,
            name: score.gradeScale.name,
            label: score.gradeScale.label,
          }
        : null,
      createdAt: score.createdAt,
      updatedAt: score.updatedAt,
    };
  }
}
