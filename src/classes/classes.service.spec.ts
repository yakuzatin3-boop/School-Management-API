import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassesService } from './classes.service.js';
import { SchoolClass } from './entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from './entities/class-schedule.entity/class-schedule.entity.js';
import { Room } from './entities/room.entity/room.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity/student.entity.js';
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
  } as unknown as SchoolClass;

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
  const enrollmentRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const enrollmentStatusHistoryRepository = {
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const studentRepository = { findOne: vi.fn() };
  const classRegistrationService = {
    createJoinCode: vi.fn().mockResolvedValue({
      id: 'join-code-1',
      classId: 'class-1',
      registrationUrl: 'http://localhost:4200/class-registration/token',
      qrCodeDataUrl: 'data:image/png;base64,qr',
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      isActive: true,
      isExpired: false,
    }),
  };

  const student = {
    id: 'student-1',
    studentNumber: 'S-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    status: StudentStatus.ACTIVE,
  } as Student;

  let service: ClassesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClassesService(
      classRepository as unknown as Repository<SchoolClass>,
      scheduleRepository as unknown as Repository<ClassSchedule>,
      roomRepository as unknown as Repository<Room>,
      courseRepository as unknown as Repository<Course>,
      teacherRepository as unknown as Repository<Teacher>,
      enrollmentRepository as unknown as Repository<Enrollment>,
      enrollmentStatusHistoryRepository as unknown as Repository<EnrollmentStatusHistory>,
      studentRepository as unknown as Repository<Student>,
      classRegistrationService as any,
    );
    classRepository.findOne.mockResolvedValue(schoolClass);
    classRepository.find.mockResolvedValue([schoolClass]);
    courseRepository.findOne.mockResolvedValue(course);
    teacherRepository.findOne.mockResolvedValue(teacher);
    studentRepository.findOne.mockResolvedValue(student);
  });

  it('creates a class with existing course and teacher relations', async () => {
    classRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(schoolClass);

    const result = await service.create(
      {
        classCode: ' MATH-1 ',
        name: ' Algebra ',
        courseId: 'course-1',
        teacherId: 'teacher-1',
      },
      { userId: 'admin-1', role: UserRole.ADMIN },
    );

    expect(classRepository.create).toHaveBeenCalledWith({
      classCode: 'MATH-1',
      name: 'Algebra',
      status: 'active',
      course,
      teacher,
    });
    expect(classRegistrationService.createJoinCode).toHaveBeenCalledWith(
      'class-1',
      { userId: 'admin-1', role: UserRole.ADMIN },
      {},
    );
    expect(result).toMatchObject({
      id: 'class-1',
      classCode: 'MATH-1',
      course: { id: 'course-1', name: 'Mathematics' },
      teacher: { id: 'teacher-1', teacherNumber: 'T-001' },
      registration: {
        id: 'join-code-1',
        qrCodeDataUrl: 'data:image/png;base64,qr',
      },
    });
  });

  it('assigns a teacher creating a class to their own profile', async () => {
    classRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(schoolClass);

    await service.create(
      {
        classCode: 'MATH-2',
        name: 'Geometry',
        courseId: 'course-1',
      },
      { userId: 'user-1', role: UserRole.TEACHER },
    );

    expect(classRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teacher,
      }),
    );
  });

  it('prevents a teacher from creating a class for another teacher', async () => {
    classRepository.findOne.mockResolvedValueOnce(null);
    teacherRepository.findOne
      .mockResolvedValueOnce(
        Object.assign({}, teacher, { id: 'teacher-2' }) as Teacher,
      )
      .mockResolvedValueOnce(teacher);

    await expect(
      service.create(
        {
          classCode: 'MATH-3',
          name: 'Calculus',
          courseId: 'course-1',
          teacherId: 'teacher-2',
        },
        { userId: 'user-1', role: UserRole.TEACHER },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
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

  it('adds a student to the class roster and records history', async () => {
    enrollmentRepository.findOne.mockResolvedValue(null);

    const result = await service.addStudent(
      'class-1',
      { studentId: 'student-1' },
      { userId: 'admin-1', role: UserRole.ADMIN },
    );

    expect(enrollmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        student,
        schoolClass,
        status: EnrollmentStatus.ACTIVE,
      }),
    );
    expect(enrollmentStatusHistoryRepository.save).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: EnrollmentStatus.ACTIVE,
      student: { id: 'student-1' },
    });
  });

  it('rejects a duplicate active enrollment', async () => {
    enrollmentRepository.findOne.mockResolvedValue({
      id: 'enrollment-1',
      status: EnrollmentStatus.ACTIVE,
    });

    await expect(
      service.addStudent(
        'class-1',
        { studentId: 'student-1' },
        { userId: 'admin-1', role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns class summary stats', async () => {
    classRepository.findOne.mockResolvedValue(
      Object.assign({}, schoolClass, {
        enrollments: [
          { id: 'enrollment-1', status: EnrollmentStatus.ACTIVE },
          { id: 'enrollment-2', status: EnrollmentStatus.WITHDRAWN },
        ],
      }) as SchoolClass,
    );

    const result = await service.getSummary('class-1', {
      userId: 'admin-1',
      role: UserRole.ADMIN,
    });

    expect(result.stats).toMatchObject({
      totalEnrollments: 2,
      activeEnrollments: 1,
      withdrawnEnrollments: 1,
      scheduleCount: 0,
      hasTeacher: true,
    });
  });

  it('lets a teacher view the roster of their own class', async () => {
    enrollmentRepository.find.mockResolvedValue([
      {
        id: 'enrollment-1',
        status: EnrollmentStatus.ACTIVE,
        student,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.findStudents('class-1', {
      userId: 'user-1',
      role: UserRole.TEACHER,
    });

    expect(result).toHaveLength(1);
    expect(enrollmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolClass: { id: 'class-1' } },
      }),
    );
  });
});