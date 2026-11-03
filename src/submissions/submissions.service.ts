import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Submission } from './entities/submission.entity/submission.entity.js';
import { SubmissionAttachment } from './entities/submission-attachment.entity/submission-attachment.entity.js';
import { Assignment } from '../assignments/entities/assignment.entity/assignment.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { GroupMember } from '../groups/entities/group-member.entity/group-member.entity.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import {
  SubmissionStatus,
  UpdateSubmissionDto,
} from './dto/update-submission.dto.js';
import { QuerySubmissionsDto } from './dto/query-submission.dto.js';
import { CreateSubmissionAttachmentDto } from './dto/create-submission-attachment.dto.js';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(SubmissionAttachment)
    private readonly attachmentRepository: Repository<SubmissionAttachment>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly access: AcademicAccessService,
  ) {}

  async create(dto: CreateSubmissionDto, actor: AcademicActor) {
    const assignment = await this.getAssignment(dto.assignmentId);
    const student = await this.resolveStudentForCreate(actor);
    const group = await this.resolveGroup(
      dto.groupId,
      student,
      assignment.schoolClass.id,
    );

    await this.assertCanSubmit(actor, assignment, student);

    const existing = await this.submissionRepository.findOne({
      where: group
        ? { assignment: { id: assignment.id }, studentGroup: { id: group.id } }
        : { assignment: { id: assignment.id }, student: { id: student.id } },
    });

    if (existing) {
      throw new ConflictException(
        'A submission already exists for this assignment',
      );
    }

    const isLate = this.isLate(assignment.dueAt) || dto.markLate === true;

    const submission = this.submissionRepository.create({
      assignment,
      student: group ? null : student,
      studentGroup: group,
      content: dto.content?.trim() || null,
      status: isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
      isLate,
      submittedAt: new Date(),
    });

    const saved = await this.submissionRepository.save(submission);

    return this.toPublicSubmission(
      await this.getSubmissionEntity(saved.id),
      true,
    );
  }

  async findAll(query: QuerySubmissionsDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('assignment.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('assignment.teacher', 'assignmentTeacher')
      .leftJoinAndSelect('submission.student', 'student')
      .leftJoinAndSelect('submission.studentGroup', 'studentGroup')
      .leftJoinAndSelect('submission.scores', 'scores')
      .leftJoinAndSelect('submission.attachments', 'attachments')
      .orderBy('submission.submittedAt', 'DESC');

    if (query.assignmentId) {
      queryBuilder.andWhere('submission.assignment_id = :assignmentId', {
        assignmentId: query.assignmentId,
      });
    }

    if (query.studentId) {
      queryBuilder.andWhere('submission.student_id = :studentId', {
        studentId: query.studentId,
      });
    }

    if (query.groupId) {
      queryBuilder.andWhere('submission.group_id = :groupId', {
        groupId: query.groupId,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('submission.status = :status', {
        status: query.status,
      });
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);
      queryBuilder.andWhere(
        '(classTeacher.id = :actorTeacherId OR assignmentTeacher.id = :actorTeacherId)',
        { actorTeacherId: teacher.id },
      );
    } else if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);
      queryBuilder
        .leftJoin('studentGroup.members', 'groupMember')
        .leftJoin('groupMember.enrollment', 'groupEnrollment')
        .andWhere(
          '(student.id = :studentId OR groupEnrollment.student_id = :studentId)',
          { studentId: student.id },
        );
    }

    queryBuilder.skip((page - 1) * limit).take(limit).distinct(true);

    const [submissions, total] = await queryBuilder.getManyAndCount();

    if (query.assignmentId && actor.role !== UserRole.ADMIN) {
      await this.assertCanAccessAssignment(actor, query.assignmentId);
    }

    return {
      data: submissions.map((submission) =>
        this.toPublicSubmission(submission, false),
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

  async findByAssignment(assignmentId: string, actor: AcademicActor) {
    await this.assertCanAccessAssignment(actor, assignmentId);

    return this.findAll({ assignmentId, limit: 100 }, actor);
  }

  async findOne(id: string, actor: AcademicActor) {
    const submission = await this.getSubmissionEntity(id);
    await this.assertCanAccessSubmission(actor, submission);

    return this.toPublicSubmission(submission, true);
  }

  async update(
    id: string,
    dto: UpdateSubmissionDto,
    actor: AcademicActor,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const submission = await this.getSubmissionEntity(id);
    await this.assertCanAccessSubmission(actor, submission);

    const isTeacherOrAdmin =
      actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER;

    if (
      !isTeacherOrAdmin &&
      dto.status !== undefined &&
      dto.status === SubmissionStatus.RETURNED
    ) {
      throw new ForbiddenException(
        'Students cannot mark a submission as returned',
      );
    }

    if (dto.content !== undefined) {
      submission.content = dto.content?.trim() || null;
    }

    if (dto.status !== undefined) {
      submission.status = dto.status;

      if (
        dto.status === SubmissionStatus.SUBMITTED ||
        dto.status === SubmissionStatus.RESUBMITTED
      ) {
        submission.submittedAt = new Date();
        submission.isLate = this.isLate(submission.assignment.dueAt);
      } else if (dto.status === SubmissionStatus.LATE) {
        submission.isLate = true;
      } else if (dto.status === SubmissionStatus.DRAFT) {
        submission.isLate = false;
      }
    }

    await this.submissionRepository.save(submission);

    return this.toPublicSubmission(
      await this.getSubmissionEntity(id),
      true,
    );
  }

  async remove(id: string, actor: AcademicActor) {
    const submission = await this.getSubmissionEntity(id);
    await this.assertCanAccessSubmission(actor, submission);

    if (
      actor.role !== UserRole.ADMIN &&
      submission.student?.user?.id !== actor.userId
    ) {
      throw new ForbiddenException(
        'Only the submitting student or an administrator can delete this submission',
      );
    }

    await this.submissionRepository.remove(submission);

    return { message: 'Submission deleted successfully' };
  }

  // ATTACHMENTS

  async addAttachment(
    id: string,
    dto: CreateSubmissionAttachmentDto,
    actor: AcademicActor,
  ) {
    const submission = await this.getSubmissionEntity(id);
    await this.assertCanAccessSubmission(actor, submission);

    const attachment = this.attachmentRepository.create({
      submission,
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
    const submission = await this.getSubmissionEntity(id);
    await this.assertCanAccessSubmission(actor, submission);

    const attachments = await this.attachmentRepository.find({
      where: { submission: { id } },
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
    const submission = await this.getSubmissionEntity(id);
    await this.assertCanAccessSubmission(actor, submission);

    if (
      actor.role !== UserRole.ADMIN &&
      submission.student?.user?.id !== actor.userId
    ) {
      throw new ForbiddenException(
        'Only the submitting student or an administrator can remove attachments',
      );
    }

    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, submission: { id } },
    });

    if (!attachment) {
      throw new NotFoundException('Submission attachment not found');
    }

    await this.attachmentRepository.remove(attachment);

    return { message: 'Submission attachment deleted successfully' };
  }

  private async resolveStudentForCreate(actor: AcademicActor) {
    if (actor.role === UserRole.STUDENT) {
      return this.access.getStudentForActor(actor.userId);
    }

    throw new ForbiddenException(
      'Only students can create submissions',
    );
  }

  private async resolveGroup(
    groupId: string | null | undefined,
    student: Student,
    classId: string,
  ) {
    if (!groupId) {
      return null;
    }

    const group = await this.groupMemberRepository.manager
      .getRepository('student_groups')
      .findOne({ where: { id: groupId } });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const typedGroup = group as unknown as {
      id: string;
      schoolClass?: { id: string };
    };

    const groupMember = await this.groupMemberRepository.findOne({
      where: {
        studentGroup: { id: groupId },
        enrollment: {
          student: { id: student.id },
          schoolClass: { id: classId },
        },
      },
      relations: {
        studentGroup: { schoolClass: true } as never,
      },
    });

    if (!groupMember) {
      throw new ForbiddenException(
        'You are not a member of this group',
      );
    }

    if (
      typedGroup.schoolClass?.id &&
      typedGroup.schoolClass.id !== classId
    ) {
      throw new BadRequestException(
        'The group does not belong to this class',
      );
    }

    return groupMember.studentGroup;
  }

  private async assertCanSubmit(
    actor: AcademicActor,
    assignment: Assignment,
    student: Student,
  ) {
    const enrollment = await this.access.findEnrollment(
      student.id,
      assignment.schoolClass.id,
    );

    if (!this.access.isActiveEnrollment(enrollment)) {
      throw new ForbiddenException(
        'You are not actively enrolled in this class',
      );
    }

    if (actor.role !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can submit work');
    }
  }

  private async assertCanAccessAssignment(
    actor: AcademicActor,
    assignmentId: string,
  ) {
    const assignment = await this.getAssignment(assignmentId);
    await this.access.assertCanAccessClass(actor, assignment.schoolClass);
  }

  private async assertCanAccessSubmission(
    actor: AcademicActor,
    submission: Submission,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    const schoolClass = submission.assignment.schoolClass;

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);

      if (
        schoolClass.teacher?.id === teacher.id ||
        submission.assignment.teacher?.id === teacher.id
      ) {
        return;
      }

      throw new ForbiddenException(
        'You can only access submissions for your own classes',
      );
    }

    const student = await this.access.getStudentForActor(actor.userId);

    if (submission.student?.id === student.id) {
      return;
    }

    if (submission.studentGroup) {
      const membership = await this.groupMemberRepository.findOne({
        where: {
          studentGroup: { id: submission.studentGroup.id },
          enrollment: { student: { id: student.id } },
        },
      });

      if (membership) {
        return;
      }
    }

    throw new ForbiddenException(
      'You can only access your own submissions',
    );
  }

  private async getAssignment(id: string) {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: {
        schoolClass: {
          course: true,
          teacher: true,
        },
        teacher: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  private async getSubmissionEntity(id: string) {
    const submission = await this.submissionRepository.findOne({
      where: { id },
      relations: {
        assignment: {
          schoolClass: {
            course: true,
            teacher: true,
          },
          teacher: true,
        },
        student: { user: true },
        studentGroup: true,
        attachments: true,
        scores: {
          gradeScale: true,
          gradedByTeacher: true,
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  private isLate(dueAt: Date | null) {
    return dueAt !== null && new Date() > dueAt;
  }

  private toPublicSubmission(
    submission: Submission,
    includeDetails: boolean,
  ) {
    return {
      id: submission.id,
      content: submission.content,
      status: submission.status,
      isLate: submission.isLate,
      submittedAt: submission.submittedAt,
      assignment: submission.assignment
        ? {
            id: submission.assignment.id,
            title: submission.assignment.title,
            maxScore: Number(submission.assignment.maxScore),
            dueAt: submission.assignment.dueAt,
            class: this.access.toClassSummary(
              submission.assignment.schoolClass,
            ),
            teacher: this.access.toTeacherSummary(
              submission.assignment.teacher,
            ),
          }
        : null,
      student: this.access.toStudentSummary(submission.student),
      group: submission.studentGroup
        ? {
            id: submission.studentGroup.id,
            name: submission.studentGroup.name,
            description: submission.studentGroup.description,
          }
        : null,
      scores: (submission.scores ?? []).map((score) => ({
        id: score.id,
        score: Number(score.score),
        feedback: score.feedback,
        gradedAt: score.gradedAt,
        gradeScale: score.gradeScale
          ? {
              id: score.gradeScale.id,
              name: score.gradeScale.name,
              label: score.gradeScale.label,
            }
          : null,
        gradedByTeacher: this.access.toTeacherSummary(
          score.gradedByTeacher,
        ),
      })),
      ...(includeDetails
        ? {
            attachments: (submission.attachments ?? []).map((attachment) =>
              this.toPublicAttachment(attachment),
            ),
          }
        : { attachmentCount: submission.attachments?.length ?? 0 }),
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }

  private toPublicAttachment(attachment: SubmissionAttachment) {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt,
    };
  }
}
