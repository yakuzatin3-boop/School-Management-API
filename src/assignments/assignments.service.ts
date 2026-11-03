import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Assignment } from './entities/assignment.entity/assignment.entity.js';
import { AssignmentAttachment } from './entities/assignment-attachment.entity/assignment-attachment.entity.js';
import { AssignmentComment } from './entities/assignment-comment.entity/assignment-comment.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity/lesson.entity.js';
import { Submission } from '../submissions/entities/submission.entity/submission.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { UpdateAssignmentDto } from './dto/update-assignment.dto.js';
import { QueryAssignmentsDto } from './dto/query-assignment.dto.js';
import { CreateAssignmentAttachmentDto } from './dto/create-assignment-attachment.dto.js';
import { CreateAssignmentCommentDto } from './dto/create-assignment-comment.dto.js';
import { UpdateAssignmentCommentDto } from './dto/update-assignment-comment.dto.js';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(AssignmentAttachment)
    private readonly attachmentRepository: Repository<AssignmentAttachment>,
    @InjectRepository(AssignmentComment)
    private readonly commentRepository: Repository<AssignmentComment>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly access: AcademicAccessService,
  ) {}

  async create(dto: CreateAssignmentDto, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(dto.classId);
    await this.access.assertCanManageClass(actor, schoolClass);

    const teacher = await this.resolveTeacher(
      dto.teacherId,
      actor,
      schoolClass.teacher,
    );
    const lesson = dto.lessonId
      ? await this.getLessonForClass(dto.lessonId, dto.classId)
      : null;

    const maxScore = dto.maxScore ?? 100;
    this.assertMaxScore(maxScore);

    const assignment = this.assignmentRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      maxScore,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      schoolClass,
      teacher,
      lesson,
    });

    const saved = await this.assignmentRepository.save(assignment);

    return this.toPublicAssignment(
      await this.getAssignmentEntity(saved.id),
      true,
    );
  }

  async findAll(query: QueryAssignmentsDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.assignmentRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('assignment.teacher', 'teacher')
      .leftJoinAndSelect('assignment.lesson', 'lesson')
      .leftJoinAndSelect('assignment.submissions', 'submissions')
      .orderBy('assignment.dueAt', 'ASC', 'NULLS LAST')
      .addOrderBy('assignment.createdAt', 'DESC');

    if (query.classId) {
      queryBuilder.andWhere('assignment.class_id = :classId', {
        classId: query.classId,
      });
    }

    if (query.teacherId) {
      queryBuilder.andWhere('assignment.teacher_id = :teacherId', {
        teacherId: query.teacherId,
      });
    }

    if (query.lessonId) {
      queryBuilder.andWhere('assignment.lesson_id = :lessonId', {
        lessonId: query.lessonId,
      });
    }

    if (query.search?.trim()) {
      queryBuilder.andWhere(
        '(assignment.title ILIKE :search OR assignment.description ILIKE :search)',
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

    const [assignments, total] = await queryBuilder.getManyAndCount();

    return {
      data: assignments.map((assignment) =>
        this.toPublicAssignment(assignment, false),
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

  async findByClass(classId: string, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(classId);
    await this.access.assertCanAccessClass(actor, schoolClass);

    return this.findAll({ classId, limit: 100 }, actor);
  }

  async findOne(id: string, actor: AcademicActor) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanAccessClass(actor, assignment.schoolClass);

    return this.toPublicAssignment(assignment, true);
  }

  async update(id: string, dto: UpdateAssignmentDto, actor: AcademicActor) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanManageClass(actor, assignment.schoolClass);

    if (dto.title !== undefined) {
      const title = dto.title.trim();

      if (!title) {
        throw new BadRequestException('Assignment title cannot be empty');
      }

      assignment.title = title;
    }

    if (dto.description !== undefined) {
      assignment.description = dto.description?.trim() || null;
    }

    if (dto.maxScore !== undefined) {
      this.assertMaxScore(dto.maxScore);
      assignment.maxScore = dto.maxScore;
    }

    if (dto.dueAt !== undefined) {
      assignment.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    }

    if (dto.lessonId !== undefined) {
      assignment.lesson = dto.lessonId
        ? await this.getLessonForClass(
            dto.lessonId,
            assignment.schoolClass.id,
          )
        : null;
    }

    if (dto.teacherId !== undefined) {
      assignment.teacher = await this.resolveTeacher(
        dto.teacherId,
        actor,
        assignment.schoolClass.teacher,
      );
    }

    await this.assignmentRepository.save(assignment);

    return this.toPublicAssignment(
      await this.getAssignmentEntity(id),
      true,
    );
  }

  async remove(id: string, actor: AcademicActor) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanManageClass(actor, assignment.schoolClass);

    await this.assignmentRepository.remove(assignment);

    return { message: 'Assignment deleted successfully' };
  }

  // ATTACHMENTS

  async addAttachment(
    id: string,
    dto: CreateAssignmentAttachmentDto,
    actor: AcademicActor,
  ) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanManageClass(actor, assignment.schoolClass);

    const attachment = this.attachmentRepository.create({
      assignment,
      fileName: dto.fileName.trim(),
      fileUrl: dto.fileUrl.trim(),
      mimeType: dto.mimeType?.trim() || null,
      fileSize: dto.fileSize ?? null,
    });

    return this.toPublicAttachment(
      await this.attachmentRepository.save(attachment),
    );
  }

  async findAttachments(id: string, actor: AcademicActor) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanAccessClass(actor, assignment.schoolClass);

    const attachments = await this.attachmentRepository.find({
      where: { assignment: { id } },
      order: { createdAt: 'DESC' },
    });

    return attachments.map((attachment) =>
      this.toPublicAttachment(attachment),
    );
  }

  async removeAttachment(
    id: string,
    attachmentId: string,
    actor: AcademicActor,
  ) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanManageClass(actor, assignment.schoolClass);

    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, assignment: { id } },
    });

    if (!attachment) {
      throw new NotFoundException('Assignment attachment not found');
    }

    await this.attachmentRepository.remove(attachment);

    return { message: 'Assignment attachment deleted successfully' };
  }

  // COMMENTS

  async createComment(
    id: string,
    dto: CreateAssignmentCommentDto,
    actor: AcademicActor,
  ) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanAccessClass(actor, assignment.schoolClass);

    const submission = dto.submissionId
      ? await this.getSubmissionForAssignment(dto.submissionId, id)
      : null;

    const comment = this.commentRepository.create({
      assignment,
      submission,
      author: { id: actor.userId } as User,
      content: dto.content.trim(),
    });

    return this.toPublicComment(
      await this.commentRepository.save(comment),
    );
  }

  async findComments(id: string, actor: AcademicActor) {
    const assignment = await this.getAssignmentEntity(id);
    await this.access.assertCanAccessClass(actor, assignment.schoolClass);

    const comments = await this.commentRepository.find({
      where: { assignment: { id } },
      relations: { author: true, submission: true },
      order: { createdAt: 'ASC' },
    });

    return comments.map((comment) => this.toPublicComment(comment));
  }

  async updateComment(
    id: string,
    commentId: string,
    dto: UpdateAssignmentCommentDto,
    actor: AcademicActor,
  ) {
    const comment = await this.getCommentEntity(id, commentId);
    await this.assertCanManageComment(comment, actor);

    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    comment.content = content;
    await this.commentRepository.save(comment);

    return this.toPublicComment(
      await this.getCommentEntity(id, commentId),
    );
  }

  async removeComment(
    id: string,
    commentId: string,
    actor: AcademicActor,
  ) {
    const comment = await this.getCommentEntity(id, commentId);
    await this.assertCanManageComment(comment, actor);

    await this.commentRepository.remove(comment);

    return { message: 'Comment deleted successfully' };
  }

  private async resolveTeacher(
    teacherId: string | null | undefined,
    actor: AcademicActor,
    classTeacher: Teacher | null,
  ) {
    if (actor.role === UserRole.TEACHER) {
      const ownTeacher = await this.access.getTeacherForActor(actor.userId);

      if (teacherId && teacherId !== ownTeacher.id) {
        throw new ForbiddenException(
          'You can only assign work to yourself',
        );
      }

      return ownTeacher;
    }

    if (teacherId) {
      return this.access.getTeacher(teacherId);
    }

    return classTeacher;
  }

  private assertMaxScore(maxScore: number) {
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      throw new BadRequestException('maxScore must be greater than zero');
    }
  }

  private async getLessonForClass(lessonId: string, classId: string) {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
      relations: { schoolClass: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (lesson.schoolClass.id !== classId) {
      throw new BadRequestException(
        'The lesson does not belong to this class',
      );
    }

    return lesson;
  }

  private async getSubmissionForAssignment(
    submissionId: string,
    assignmentId: string,
  ) {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: { assignment: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.assignment.id !== assignmentId) {
      throw new BadRequestException(
        'The submission does not belong to this assignment',
      );
    }

    return submission;
  }

  private async getAssignmentEntity(id: string) {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: {
        schoolClass: {
          course: true,
          teacher: true,
        },
        teacher: true,
        lesson: true,
        attachments: true,
        comments: {
          author: true,
          submission: true,
        },
        submissions: {
          student: true,
          studentGroup: true,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  private async getCommentEntity(assignmentId: string, commentId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, assignment: { id: assignmentId } },
      relations: {
        assignment: {
          schoolClass: {
            course: true,
            teacher: true,
          },
        },
        author: true,
        submission: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  private async assertCanManageComment(
    comment: AssignmentComment,
    actor: AcademicActor,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (comment.author?.id === actor.userId) {
      return;
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);

      if (comment.assignment.schoolClass.teacher?.id === teacher.id) {
        return;
      }
    }

    throw new ForbiddenException(
      'You can only manage your own comments',
    );
  }

  private toPublicAssignment(assignment: Assignment, includeDetails: boolean) {
    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      maxScore: Number(assignment.maxScore),
      dueAt: assignment.dueAt,
      isOverdue:
        assignment.dueAt !== null && assignment.dueAt < new Date(),
      class: this.access.toClassSummary(assignment.schoolClass),
      teacher: this.access.toTeacherSummary(assignment.teacher),
      lesson: assignment.lesson
        ? {
            id: assignment.lesson.id,
            lessonNumber: assignment.lesson.lessonNumber,
            title: assignment.lesson.title,
          }
        : null,
      submissionCount: assignment.submissions?.length ?? 0,
      ...(includeDetails
        ? {
            attachments: (assignment.attachments ?? []).map((attachment) =>
              this.toPublicAttachment(attachment),
            ),
            comments: (assignment.comments ?? [])
              .slice()
              .sort(
                (first, second) =>
                  first.createdAt.getTime() - second.createdAt.getTime(),
              )
              .map((comment) => this.toPublicComment(comment)),
          }
        : {}),
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private toPublicAttachment(attachment: AssignmentAttachment) {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt,
    };
  }

  private toPublicComment(comment: AssignmentComment) {
    return {
      id: comment.id,
      content: comment.content,
      submissionId: comment.submission?.id ?? null,
      author: this.access.toUserSummary(comment.author),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
