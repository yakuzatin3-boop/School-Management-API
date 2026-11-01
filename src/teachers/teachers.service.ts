import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Teacher,
  TeacherStatus,
} from './entities/teacher.entity/teacher.entity.js';
import {
  TeacherSkill,
  TeacherSkillLevel,
} from './entities/teacher-skill.entity/teacher-skill.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateTeacherDto } from './dto/create-teacher.dto.js';
import { UpdateTeacherDto } from './dto/update-teacher.dto.js';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto.js';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto.js';
import { CreateTeacherSkillDto } from './dto/create-teacher-skill.dto.js';
import { UpdateTeacherSkillDto } from './dto/update-teacher-skill.dto.js';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
    @InjectRepository(TeacherSkill)
    private readonly teacherSkillRepository: Repository<TeacherSkill>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // CREATE TEACHER
  async create(createTeacherDto: CreateTeacherDto) {
    const user = await this.resolveTeacherUser(createTeacherDto.userId);

    return this.persistTeacher(createTeacherDto, user);
  }

  // CREATE OWN TEACHER PROFILE FOR AN EXISTING ACCOUNT
  async createProfile(
    userId: string,
    createTeacherProfileDto: CreateTeacherProfileDto,
  ) {
    const user = await this.resolveTeacherUser(userId);

    return this.persistTeacher(createTeacherProfileDto, user);
  }

  // GET OWN TEACHER PROFILE
  async findProfile(userId: string) {
    const teacher = await this.findProfileEntity(userId);

    return this.toPublicTeacher(teacher);
  }

  // UPDATE OWN TEACHER PROFILE
  async updateProfile(
    userId: string,
    updateTeacherProfileDto: UpdateTeacherProfileDto,
  ) {
    const teacher = await this.findProfileEntity(userId);

    return this.update(teacher.id, updateTeacherProfileDto);
  }

  // GET ALL TEACHERS
  async findAll() {
    const teachers = await this.teacherRepository.find({
      relations: {
        user: true,
        teacherSkills: {
          course: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return teachers.map((teacher) => this.toPublicTeacher(teacher));
  }

  // GET TEACHER BY ID
  async findOne(id: string) {
    const teacher = await this.getTeacherEntity(id);

    return this.toPublicTeacher(teacher);
  }

  // UPDATE TEACHER
  async update(id: string, updateTeacherDto: UpdateTeacherDto) {
    const teacher = await this.getTeacherEntity(id);

    if (updateTeacherDto.teacherNumber !== undefined) {
      const teacherNumber = updateTeacherDto.teacherNumber.trim();

      if (teacherNumber !== teacher.teacherNumber) {
        const existingNumber = await this.teacherRepository.findOne({
          where: { teacherNumber },
        });

        if (existingNumber) {
          throw new ConflictException(
            'Teacher number already exists',
          );
        }

        teacher.teacherNumber = teacherNumber;
      }
    }

    if (updateTeacherDto.userId !== undefined) {
      teacher.user = await this.resolveTeacherUser(
        updateTeacherDto.userId,
        id,
      );
    }

    if (updateTeacherDto.firstName !== undefined) {
      teacher.firstName = updateTeacherDto.firstName.trim();
    }

    if (updateTeacherDto.lastName !== undefined) {
      teacher.lastName = updateTeacherDto.lastName.trim();
    }

    if (updateTeacherDto.email !== undefined) {
      teacher.email = updateTeacherDto.email.trim().toLowerCase();
    }

    if (updateTeacherDto.phoneNumber !== undefined) {
      teacher.phoneNumber =
        updateTeacherDto.phoneNumber.trim() || null;
    }

    if (updateTeacherDto.status !== undefined) {
      teacher.status = updateTeacherDto.status;
    }

    return this.toPublicTeacher(
      await this.teacherRepository.save(teacher),
    );
  }

  // ACTIVATE TEACHER
  async activate(id: string) {
    const teacher = await this.getTeacherEntity(id);

    if (teacher.status === TeacherStatus.ACTIVE) {
      throw new BadRequestException(
        'Teacher is already active',
      );
    }

    teacher.status = TeacherStatus.ACTIVE;

    await this.teacherRepository.save(teacher);

    return {
      message: 'Teacher activated successfully',
    };
  }

  // DEACTIVATE TEACHER
  async deactivate(id: string) {
    const teacher = await this.getTeacherEntity(id);

    if (teacher.status === TeacherStatus.INACTIVE) {
      throw new BadRequestException(
        'Teacher is already deactivated',
      );
    }

    teacher.status = TeacherStatus.INACTIVE;

    await this.teacherRepository.save(teacher);

    return {
      message: 'Teacher deactivated successfully',
    };
  }

  // GET TEACHER SKILLS
  async findSkills(teacherId: string) {
    await this.getTeacherEntity(teacherId);

    const skills = await this.teacherSkillRepository.find({
      where: {
        teacher: {
          id: teacherId,
        },
      },
      relations: {
        course: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return skills.map((skill) => this.toPublicTeacherSkill(skill));
  }

  // ADD TEACHER SKILL
  async addSkill(teacherId: string, dto: CreateTeacherSkillDto) {
    const teacher = await this.getTeacherEntity(teacherId);
    const course = await this.getCourse(dto.courseId);

    const existingSkill = await this.teacherSkillRepository.findOne({
      where: {
        teacher: {
          id: teacherId,
        },
        course: {
          id: dto.courseId,
        },
      },
    });

    if (existingSkill) {
      throw new ConflictException(
        'Teacher already has this course skill',
      );
    }

    const skill = this.teacherSkillRepository.create({
      teacher,
      course,
      skillLevel: dto.skillLevel ?? TeacherSkillLevel.INTERMEDIATE,
      yearsExperience: dto.yearsExperience ?? null,
    });

    return this.toPublicTeacherSkill(
      await this.teacherSkillRepository.save(skill),
    );
  }

  // UPDATE TEACHER SKILL
  async updateSkill(
    teacherId: string,
    skillId: string,
    dto: UpdateTeacherSkillDto,
  ) {
    const skill = await this.teacherSkillRepository.findOne({
      where: {
        id: skillId,
        teacher: {
          id: teacherId,
        },
      },
      relations: {
        course: true,
      },
    });

    if (!skill) {
      throw new NotFoundException('Teacher skill not found');
    }

    if (
      dto.courseId !== undefined &&
      dto.courseId !== skill.course.id
    ) {
      const course = await this.getCourse(dto.courseId);

      const existingSkill = await this.teacherSkillRepository.findOne({
        where: {
          teacher: {
            id: teacherId,
          },
          course: {
            id: dto.courseId,
          },
        },
      });

      if (existingSkill) {
        throw new ConflictException(
          'Teacher already has this course skill',
        );
      }

      skill.course = course;
    }

    if (dto.skillLevel !== undefined) {
      skill.skillLevel = dto.skillLevel;
    }

    if (dto.yearsExperience !== undefined) {
      skill.yearsExperience = dto.yearsExperience;
    }

    return this.toPublicTeacherSkill(
      await this.teacherSkillRepository.save(skill),
    );
  }

  // REMOVE TEACHER SKILL
  async removeSkill(teacherId: string, skillId: string) {
    const skill = await this.teacherSkillRepository.findOne({
      where: {
        id: skillId,
        teacher: {
          id: teacherId,
        },
      },
    });

    if (!skill) {
      throw new NotFoundException('Teacher skill not found');
    }

    await this.teacherSkillRepository.remove(skill);

    return {
      message: 'Teacher skill removed successfully',
    };
  }

  private async getCourse(courseId: string) {
    const course = await this.courseRepository.findOneBy({
      id: courseId,
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  private async getTeacherEntity(id: string) {
    const teacher = await this.teacherRepository.findOne({
      where: { id },
      relations: {
        user: true,
        teacherSkills: {
          course: true,
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }

  private async persistTeacher(
    dto: Omit<CreateTeacherDto, 'userId' | 'status' | 'email'> & {
      email?: string;
      status?: TeacherStatus;
    },
    user: User | null,
  ) {
    const teacherNumber = dto.teacherNumber.trim();
    const email = dto.email?.trim().toLowerCase() ?? user?.email;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const existingTeacherNumber = await this.teacherRepository.findOne({
      where: { teacherNumber },
    });

    if (existingTeacherNumber) {
      throw new ConflictException('Teacher number already exists');
    }

    const teacher = this.teacherRepository.create({
      teacherNumber,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email,
      phoneNumber: dto.phoneNumber?.trim() || null,
      status: dto.status ?? TeacherStatus.ACTIVE,
    });

    teacher.user = user;

    return this.toPublicTeacher(
      await this.teacherRepository.save(teacher),
    );
  }

  private async findProfileEntity(userId: string) {
    const teacher = await this.teacherRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: {
        user: true,
        teacherSkills: {
          course: true,
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    return teacher;
  }

  private async resolveTeacherUser(
    userId?: string,
    currentTeacherId?: string,
  ) {
    if (!userId) {
      return null;
    }

    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.TEACHER) {
      throw new BadRequestException(
        'User must have the teacher role',
      );
    }

    const linkedTeacher = await this.teacherRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (linkedTeacher && linkedTeacher.id !== currentTeacherId) {
      throw new ConflictException(
        'User is already linked to another teacher',
      );
    }

    return user;
  }

  private toPublicTeacherSkill(skill: TeacherSkill) {
    const { teacher: _teacher, ...safeSkill } = skill;
    return safeSkill;
  }

  private toPublicTeacher(teacher: Teacher) {
    const { user, ...safeTeacher } = teacher;

    return {
      ...safeTeacher,
      user: user ? this.toPublicUser(user) : null,
    };
  }

  private toPublicUser(user: User) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
