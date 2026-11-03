import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Lesson } from './entities/lesson.entity/lesson.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { QueryLessonsDto } from './dto/query-lesson.dto.js';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly access: AcademicAccessService,
  ) {}

  async create(dto: CreateLessonDto, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(dto.classId);
    await this.access.assertCanManageClass(actor, schoolClass);

    const teacher = await this.resolveTeacher(dto.teacherId, actor, schoolClass.teacher);

    await this.assertLessonNumberAvailable(
      dto.classId,
      dto.lessonNumber,
    );

    const lesson = this.lessonRepository.create({
      lessonNumber: dto.lessonNumber,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      content: dto.content?.trim() || null,
      scheduledDate: dto.scheduledDate ?? null,
      schoolClass,
      teacher,
    });

    return this.toPublicLesson(
      await this.getLessonEntity((await this.lessonRepository.save(lesson)).id),
    );
  }

  async findAll(query: QueryLessonsDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.lessonRepository
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('lesson.teacher', 'teacher')
      .leftJoinAndSelect('lesson.assignments', 'assignments')
      .orderBy('lesson.lessonNumber', 'ASC')
      .addOrderBy('lesson.createdAt', 'DESC');

    if (query.classId) {
      queryBuilder.andWhere('lesson.class_id = :classId', {
        classId: query.classId,
      });
    }

    if (query.teacherId) {
      queryBuilder.andWhere('lesson.teacher_id = :teacherId', {
        teacherId: query.teacherId,
      });
    }

    if (query.search?.trim()) {
      queryBuilder.andWhere(
        '(lesson.title ILIKE :search OR lesson.description ILIKE :search OR lesson.content ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);
      queryBuilder.andWhere(
        '(classTeacher.id = :actorTeacherId OR teacher.id = :actorTeacherId)',
        { actorTeacherId: teacher.id },
      );
    } else if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);
      queryBuilder
        .innerJoin('schoolClass.enrollments', 'accessEnrollment')
        .andWhere('accessEnrollment.student_id = :studentId', {
          studentId: student.id,
        })
        .andWhere('accessEnrollment.status = :activeStatus', {
          activeStatus: 'active',
        });
    }

    if (query.classId) {
      await this.access.assertCanAccessClass(
        actor,
        await this.access.getSchoolClass(query.classId),
      );
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [lessons, total] = await queryBuilder.getManyAndCount();

    return {
      data: lessons.map((lesson) => this.toPublicLesson(lesson)),
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

  async findByClass(classId: string, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(classId);
    await this.access.assertCanAccessClass(actor, schoolClass);

    return this.findAll({ classId, limit: 100 }, actor);
  }

  async findOne(id: string, actor: AcademicActor) {
    const lesson = await this.getLessonEntity(id);
    await this.access.assertCanAccessClass(actor, lesson.schoolClass);

    return this.toPublicLesson(lesson);
  }

  async update(id: string, dto: UpdateLessonDto, actor: AcademicActor) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const lesson = await this.getLessonEntity(id);
    await this.access.assertCanManageClass(actor, lesson.schoolClass);

    if (dto.lessonNumber !== undefined) {
      await this.assertLessonNumberAvailable(
        lesson.schoolClass.id,
        dto.lessonNumber,
        lesson.id,
      );
      lesson.lessonNumber = dto.lessonNumber;
    }

    if (dto.teacherId !== undefined) {
      lesson.teacher = await this.resolveTeacher(
        dto.teacherId,
        actor,
        lesson.schoolClass.teacher,
      );
    }

    if (dto.title !== undefined) {
      const title = dto.title.trim();

      if (!title) {
        throw new BadRequestException('Lesson title cannot be empty');
      }

      lesson.title = title;
    }

    if (dto.description !== undefined) {
      lesson.description = dto.description?.trim() || null;
    }

    if (dto.content !== undefined) {
      lesson.content = dto.content?.trim() || null;
    }

    if (dto.scheduledDate !== undefined) {
      lesson.scheduledDate = dto.scheduledDate;
    }

    await this.lessonRepository.save(lesson);

    return this.toPublicLesson(await this.getLessonEntity(id));
  }

  async remove(id: string, actor: AcademicActor) {
    const lesson = await this.getLessonEntity(id);
    await this.access.assertCanManageClass(actor, lesson.schoolClass);

    await this.lessonRepository.remove(lesson);

    return { message: 'Lesson deleted successfully' };
  }

  private async resolveTeacher(
    teacherId: string | undefined,
    actor: AcademicActor,
    classTeacher: Teacher | null,
  ) {
    if (actor.role === UserRole.TEACHER) {
      const ownTeacher = await this.access.getTeacherForActor(actor.userId);

      if (teacherId && teacherId !== ownTeacher.id) {
        throw new ForbiddenException(
          'You can only assign lessons to yourself',
        );
      }

      return ownTeacher;
    }

    if (teacherId) {
      return this.access.getTeacher(teacherId);
    }

    return classTeacher;
  }

  private async assertLessonNumberAvailable(
    classId: string,
    lessonNumber: number,
    currentLessonId?: string,
  ) {
    const existing = await this.lessonRepository.findOne({
      where: {
        schoolClass: { id: classId },
        lessonNumber,
      },
    });

    if (existing && existing.id !== currentLessonId) {
      throw new ConflictException(
        'A lesson with this number already exists for the class',
      );
    }
  }

  private async getLessonEntity(id: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id },
      relations: {
        schoolClass: {
          course: true,
          teacher: true,
        },
        teacher: true,
        assignments: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return lesson;
  }

  private toPublicLesson(lesson: Lesson) {
    return {
      id: lesson.id,
      lessonNumber: lesson.lessonNumber,
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      scheduledDate: lesson.scheduledDate,
      class: this.access.toClassSummary(lesson.schoolClass),
      teacher: this.access.toTeacherSummary(lesson.teacher),
      assignmentCount: lesson.assignments?.length ?? 0,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }
}
