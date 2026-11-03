import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course } from './entities/course.entity/course.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { TeacherSkill } from '../teachers/entities/teacher-skill.entity/teacher-skill.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(SchoolClass)
    private readonly classRepository: Repository<SchoolClass>,
    @InjectRepository(TeacherSkill)
    private readonly teacherSkillRepository: Repository<TeacherSkill>,
  ) {}

  async create(dto: CreateCourseDto) {
    const course = this.courseRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
    });

    return this.toPublicCourse(await this.courseRepository.save(course));
  }

  async findAll() {
    const courses = await this.courseRepository.find({
      relations: { classes: true },
      order: { createdAt: 'DESC' },
    });

    return courses.map((course) => this.toPublicCourse(course));
  }

  async findOne(courseId: string) {
    const course = await this.getCourseEntity(courseId);

    return this.toPublicCourse(course, true);
  }

  async update(courseId: string, dto: UpdateCourseDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const course = await this.getCourseEntity(courseId);

    if (dto.name !== undefined) course.name = dto.name.trim();
    if (dto.description !== undefined) {
      course.description = dto.description?.trim() || null;
    }

    return this.toPublicCourse(await this.courseRepository.save(course), true);
  }

  async remove(courseId: string) {
    const course = await this.getCourseEntity(courseId);
    const [classCount, skillCount] = await Promise.all([
      this.classRepository.count({ where: { course: { id: courseId } } }),
      this.teacherSkillRepository.count({
        where: { course: { id: courseId } },
      }),
    ]);

    if (classCount > 0 || skillCount > 0) {
      throw new ConflictException(
        'Course cannot be deleted while it is assigned to classes or teacher skills',
      );
    }

    await this.courseRepository.remove(course);

    return { message: 'Course deleted successfully' };
  }

  private async getCourseEntity(courseId: string) {
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
      relations: { classes: true, teacherSkills: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  private toPublicCourse(course: Course, includeClasses = false) {
    return {
      id: course.id,
      name: course.name,
      description: course.description,
      classCount: course.classes?.length ?? 0,
      teacherSkillCount: course.teacherSkills?.length ?? 0,
      ...(includeClasses
        ? {
            classes: (course.classes ?? []).map((schoolClass) => ({
              id: schoolClass.id,
              classCode: schoolClass.classCode,
              name: schoolClass.name,
              status: schoolClass.status,
            })),
          }
        : {}),
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
