import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassesService } from './classes.service.js';
import { SchoolClass } from './entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from './entities/class-schedule.entity/class-schedule.entity.js';
import { Room } from './entities/room.entity/room.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

describe('ClassesService', () => {
  const course = { id: 'course-1', name: 'Mathematics' } as Course;
  const teacher = {
    id: 'teacher-1',
    teacherNumber: 'T-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
  } as Teacher;
  const schoolClass = {
    id: 'class-1',
    classCode: 'MATH-1',
    name: 'Algebra',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    course,
    teacher,
    schedules: [],
  } as SchoolClass;

  const classRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
    delete: vi.fn(),
  };
  const scheduleRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
    delete: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const roomRepository = { findOne: vi.fn() };
  const courseRepository = { findOne: vi.fn() };
  const teacherRepository = { findOne: vi.fn() };

  let service: ClassesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClassesService(
      classRepository as unknown as Repository<SchoolClass>,
      scheduleRepository as unknown as Repository<ClassSchedule>,
      roomRepository as unknown as Repository<Room>,
      courseRepository as unknown as Repository<Course>,
      teacherRepository as unknown as Repository<Teacher>,
    );
    classRepository.findOne.mockResolvedValue(schoolClass);
    classRepository.find.mockResolvedValue([schoolClass]);
    courseRepository.findOne.mockResolvedValue(course);
    teacherRepository.findOne.mockResolvedValue(teacher);
  });

  it('creates a class with existing course and teacher relations', async () => {
    classRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(schoolClass);

    const result = await service.create({
      classCode: ' MATH-1 ',
      name: ' Algebra ',
      courseId: 'course-1',
      teacherId: 'teacher-1',
    });

    expect(classRepository.create).toHaveBeenCalledWith({
      classCode: 'MATH-1',
      name: 'Algebra',
      status: 'active',
      course,
      teacher,
    });
    expect(result).toMatchObject({
      id: 'class-1',
      classCode: 'MATH-1',
      course: { id: 'course-1', name: 'Mathematics' },
      teacher: { id: 'teacher-1', teacherNumber: 'T-001' },
    });
  });

  it('limits teacher class listings to the linked teacher profile', async () => {
    await service.findAll({ userId: 'user-1', role: UserRole.TEACHER });

    expect(classRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacher: { id: 'teacher-1' } } }),
    );
  });

  it('prevents a teacher from viewing another teacher class', async () => {
    classRepository.findOne.mockResolvedValue(
      Object.assign({}, schoolClass, {
        teacher: Object.assign({}, teacher, { id: 'teacher-2' }),
      }) as SchoolClass,
    );

    await expect(
      service.findOne('class-1', {
        userId: 'user-1',
        role: UserRole.TEACHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects schedule times that end before they start', async () => {
    await expect(
      service.createSchedule('class-1', {
        dayOfWeek: 1,
        startTime: '15:00',
        endTime: '14:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scheduleRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects overlapping class, teacher, or room schedules', async () => {
    const queryBuilder = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ id: 'schedule-existing' }),
    };
    scheduleRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    roomRepository.findOne.mockResolvedValue({ id: 'room-1' } as Room);

    await expect(
      service.createSchedule('class-1', {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
        roomId: 'room-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(queryBuilder.getOne).toHaveBeenCalledOnce();
  });
});