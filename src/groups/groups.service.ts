import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StudentGroup } from './entities/student-group.entity/student-group.entity.js';
import { GroupMember } from './entities/group-member.entity/group-member.entity.js';
import { GroupMessage } from './entities/group-message.entity/group-message.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  AcademicAccessService,
  type AcademicActor,
} from '../common/academic-access/academic-access.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { QueryGroupsDto } from './dto/query-groups.dto.js';
import { AddGroupMemberDto } from './dto/add-group-member.dto.js';
import { CreateGroupMessageDto } from './dto/create-group-message.dto.js';
import { QueryGroupMessagesDto } from './dto/query-group-messages.dto.js';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(StudentGroup)
    private readonly groupRepository: Repository<StudentGroup>,
    @InjectRepository(GroupMember)
    private readonly memberRepository: Repository<GroupMember>,
    @InjectRepository(GroupMessage)
    private readonly messageRepository: Repository<GroupMessage>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    private readonly access: AcademicAccessService,
  ) {}

  async create(dto: CreateGroupDto, actor: AcademicActor) {
    const schoolClass = await this.access.getSchoolClass(dto.classId);
    await this.access.assertCanManageClass(actor, schoolClass);

    const name = dto.name.trim();
    const existing = await this.groupRepository.findOne({
      where: {
        schoolClass: { id: dto.classId },
        name,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A group with this name already exists in the class',
      );
    }

    const group = this.groupRepository.create({
      name,
      description: dto.description?.trim() || null,
      schoolClass,
    });

    const saved = await this.groupRepository.save(group);

    return this.toPublicGroup(await this.getGroupEntity(saved.id));
  }

  async findAll(query: QueryGroupsDto, actor: AcademicActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.groupRepository
      .createQueryBuilder('group')
      .leftJoinAndSelect('group.schoolClass', 'schoolClass')
      .leftJoinAndSelect('schoolClass.course', 'course')
      .leftJoinAndSelect('schoolClass.teacher', 'classTeacher')
      .leftJoinAndSelect('group.members', 'members')
      .leftJoinAndSelect('members.enrollment', 'memberEnrollment')
      .leftJoinAndSelect('memberEnrollment.student', 'memberStudent')
      .orderBy('group.createdAt', 'DESC')
      .addOrderBy('group.id', 'DESC');

    if (query.classId) {
      queryBuilder.andWhere('group.class_id = :classId', {
        classId: query.classId,
      });
    }

    if (query.search?.trim()) {
      queryBuilder.andWhere(
        '(group.name ILIKE :search OR group.description ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.access.getTeacherForActor(actor.userId);
      queryBuilder.andWhere('classTeacher.id = :actorTeacherId', {
        actorTeacherId: teacher.id,
      });
    } else if (actor.role === UserRole.STUDENT) {
      const student = await this.access.getStudentForActor(actor.userId);
      queryBuilder
        .innerJoin('group.members', 'accessMember')
        .innerJoin('accessMember.enrollment', 'accessEnrollment')
        .innerJoin('accessEnrollment.student', 'accessStudent')
        .andWhere('accessStudent.id = :actorStudentId', {
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

    const [groups, total] = await queryBuilder.getManyAndCount();

    return {
      data: groups.map((group) => this.toPublicGroup(group)),
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
    const group = await this.getGroupEntity(id);
    await this.assertCanAccessGroup(actor, group);

    return this.toPublicGroup(group);
  }

  async update(id: string, dto: UpdateGroupDto, actor: AcademicActor) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const group = await this.getGroupEntity(id);
    await this.access.assertCanManageClass(actor, group.schoolClass);

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('Group name cannot be empty');
      }

      const existing = await this.groupRepository.findOne({
        where: {
          schoolClass: { id: group.schoolClass.id },
          name,
        },
      });

      if (existing && existing.id !== group.id) {
        throw new ConflictException(
          'A group with this name already exists in the class',
        );
      }

      group.name = name;
    }

    if (dto.description !== undefined) {
      group.description = dto.description?.trim() || null;
    }

    await this.groupRepository.save(group);

    return this.toPublicGroup(await this.getGroupEntity(id));
  }

  async remove(id: string, actor: AcademicActor) {
    const group = await this.getGroupEntity(id);
    await this.access.assertCanManageClass(actor, group.schoolClass);

    await this.groupRepository.remove(group);

    return { message: 'Student group deleted successfully' };
  }

  // MEMBERS

  async addMember(id: string, dto: AddGroupMemberDto, actor: AcademicActor) {
    const group = await this.getGroupEntity(id);
    await this.access.assertCanManageClass(actor, group.schoolClass);

    const enrollment = await this.enrollmentRepository.findOne({
      where: { id: dto.enrollmentId },
      relations: { student: true, schoolClass: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.schoolClass.id !== group.schoolClass.id) {
      throw new BadRequestException(
        'The enrollment does not belong to this class',
      );
    }

    if (!this.access.isActiveEnrollment(enrollment)) {
      throw new BadRequestException(
        'Only actively enrolled students can join a group',
      );
    }

    const existing = await this.memberRepository.findOne({
      where: {
        studentGroup: { id },
        enrollment: { id: enrollment.id },
      },
    });

    if (existing) {
      throw new ConflictException('Student is already a member of this group');
    }

    const member = this.memberRepository.create({
      studentGroup: group,
      enrollment,
    });

    const saved = await this.memberRepository.save(member);

    return this.toPublicMember(await this.getMemberEntity(saved.id));
  }

  async findMembers(id: string, actor: AcademicActor) {
    const group = await this.getGroupEntity(id);
    await this.assertCanAccessGroup(actor, group);

    const members = await this.memberRepository.find({
      where: { studentGroup: { id } },
      relations: {
        enrollment: { student: true },
      },
      order: { joinedAt: 'ASC' },
    });

    return members.map((member) => this.toPublicMember(member));
  }

  async removeMember(id: string, memberId: string, actor: AcademicActor) {
    const group = await this.getGroupEntity(id);
    await this.access.assertCanManageClass(actor, group.schoolClass);

    const member = await this.memberRepository.findOne({
      where: { id: memberId, studentGroup: { id } },
      relations: { enrollment: { student: true } },
    });

    if (!member) {
      throw new NotFoundException('Group member not found');
    }

    await this.memberRepository.remove(member);

    return { message: 'Group member removed successfully' };
  }

  // MESSAGES

  async createMessage(
    id: string,
    dto: CreateGroupMessageDto,
    actor: AcademicActor,
  ) {
    const group = await this.getGroupEntity(id);
    await this.assertCanAccessGroup(actor, group);

    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = this.messageRepository.create({
      studentGroup: group,
      sender: { id: actor.userId } as User,
      content,
    });

    const saved = await this.messageRepository.save(message);

    return this.toPublicMessage(await this.getMessageEntity(saved.id));
  }

  async findMessages(
    id: string,
    query: QueryGroupMessagesDto,
    actor: AcademicActor,
  ) {
    const group = await this.getGroupEntity(id);
    await this.assertCanAccessGroup(actor, group);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { studentGroup: { id } },
      relations: { sender: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: messages.map((message) => this.toPublicMessage(message)),
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

  async removeMessage(id: string, messageId: string, actor: AcademicActor) {
    const message = await this.getMessageEntity(messageId);

    if (message.studentGroup.id !== id) {
      throw new NotFoundException('Group message not found');
    }

    if (actor.role === UserRole.ADMIN) {
      // Administrators can moderate any message.
    } else if (message.sender?.id === actor.userId) {
      // Authors can delete their own messages.
    } else if (actor.role === UserRole.TEACHER) {
      await this.access.assertCanManageClass(
        actor,
        message.studentGroup.schoolClass,
      );
    } else {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.remove(message);

    return { message: 'Group message deleted successfully' };
  }

  private async getGroupEntity(id: string) {
    const group = await this.groupRepository.findOne({
      where: { id },
      relations: {
        schoolClass: { course: true, teacher: true },
        members: { enrollment: { student: true } },
      },
    });

    if (!group) {
      throw new NotFoundException('Student group not found');
    }

    return group;
  }

  private async getMemberEntity(id: string) {
    const member = await this.memberRepository.findOne({
      where: { id },
      relations: {
        studentGroup: true,
        enrollment: { student: true },
      },
    });

    if (!member) {
      throw new NotFoundException('Group member not found');
    }

    return member;
  }

  private async getMessageEntity(id: string) {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: {
        sender: true,
        studentGroup: {
          schoolClass: { course: true, teacher: true },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Group message not found');
    }

    return message;
  }

  private async assertCanAccessGroup(
    actor: AcademicActor,
    group: StudentGroup,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.TEACHER) {
      await this.access.assertCanManageClass(actor, group.schoolClass);
      return;
    }

    const student = await this.access.getStudentForActor(actor.userId);
    const enrollment = await this.access.findEnrollment(
      student.id,
      group.schoolClass.id,
    );

    if (!enrollment || !this.access.isActiveEnrollment(enrollment)) {
      throw new ForbiddenException('You are not enrolled in this class');
    }

    const isMember = group.members?.some(
      (member) => member.enrollment?.student?.id === student.id,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }
  }

  private toPublicGroup(group: StudentGroup) {
    const members = group.members ?? [];

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      class: this.access.toClassSummary(group.schoolClass),
      memberCount: members.length,
      members: members.map((member) => this.toPublicMember(member)),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  private toPublicMember(member: GroupMember) {
    return {
      id: member.id,
      joinedAt: member.joinedAt,
      enrollmentId: member.enrollment.id,
      student: this.access.toStudentSummary(member.enrollment.student),
    };
  }

  private toPublicMessage(message: GroupMessage) {
    return {
      id: message.id,
      content: message.content,
      sender: this.access.toUserSummary(message.sender),
      createdAt: message.createdAt,
    };
  }
}
