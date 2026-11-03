import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnrollmentsService } from './enrollments.service.js';
import {
  Enrollment,
  EnrollmentStatus,
} from './entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from './entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';

describe('EnrollmentsService', () => {
  const course = { id: 'course-1', name: 'Mathematics' };
  const teacher = {
    id: 'teacher-1',
    teacherNumber: 'T-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
  } as unknown as Teacher;
  const schoolClass = {
    id: 'class-1',
    classCode: 'MATH-1',
    name: 'Algebra',
    status: 'active',
    course,
    teacher,
  } as unknown as SchoolClass;
  const student = {
    id: 'student-1',
    studentNumber: 'S-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    status: StudentStatus.ACTIVE,
  } as Student;
  const changedByUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    passwordHash: 'secret',
  } as User;

  const enrollment = {
    id: 'enrollment-1',
    status: EnrollmentStatus.ACTIVE,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    student,
    schoolClass,
    statusHistory: [],
  } as unknown as Enrollment;

  const enrollmentRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) =>
      Promise.resolve({
        ...value,
        id: 'enrollment-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ),
    remove: vi.fn((value) => Promise.resolve(value)),
  };
  const historyRepository = {
    find: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const studentRepository = { findOneBy: vi.fn() };
  const schoolClassRepository = { findOne: vi.fn() };
  const teacherRepository = { findOne: vi.fn() };

  let service: EnrollmentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EnrollmentsService(
      enrollmentRepository as unknown as Repository<Enrollment>,
      historyRepository as unknown as Repository<EnrollmentStatusHistory>,
      studentRepository as unknown as Repository<Student>,
      schoolClassRepository as unknown as Repository<SchoolClass>,
      teacherRepository as unknown as Repository<Teacher>,
    );

    studentRepository.findOneBy.mockResolvedValue(student);
    schoolClassRepository.findOne.mockResolvedValue(schoolClass);
    teacherRepository.findOne.mockResolvedValue(teacher);
    enrollmentRepository.find.mockResolvedValue([enrollment]);
    enrollmentRepository.findOne.mockResolvedValue(enrollment);
    historyRepository.find.mockResolvedValue([]);
  });

  it('creates an enrollment and records its status history', async () => {
    enrollmentRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(enrollment);

    const result = await service.create(
      {
        studentId: 'student-1',
        classId: 'class-1',
        reason: 'Approved by administrator',
      },
      { userId: 'user-1', role: UserRole.ADMIN },
    );

    expect(enrollmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        student,
        schoolClass,
        status: EnrollmentStatus.ACTIVE,
        completedAt: null,
      }),
    );
    expect(historyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollment: expect.objectContaining({ id: 'enrollment-1' }),
        oldStatus: null,
        newStatus: EnrollmentStatus.ACTIVE,
        reason: 'Approved by administrator',
      }),
    );
    expect(result).toMatchObject({
      id: 'enrollment-1',
      status: EnrollmentStatus.ACTIVE,
      student: {
        id: 'student-1',
        studentNumber: 'S-001',
      },
      class: {
        id: 'class-1',
        classCode: 'MATH-1',
        course: { id: 'course-1', name: 'Mathematics' },
      },
    });
  });

  it('reactivates a previously withdrawn enrollment', async () => {
    const withdrawnEnrollment = Object.assign({}, enrollment, {
      status: EnrollmentStatus.WITHDRAWN,
      completedAt: new Date('2026-01-02T00:00:00.000Z'),
    }) as Enrollment;

    enrollmentRepository.findOne
      .mockResolvedValueOnce(withdrawnEnrollment)
      .mockResolvedValueOnce(enrollment);

    await service.create(
      {
        studentId: 'student-1',
        classId: 'class-1',
      },
      { userId: 'user-1', role: UserRole.ADMIN },
    );

    expect(enrollmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: EnrollmentStatus.ACTIVE,
        completedAt: null,
      }),
    );
    expect(historyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        oldStatus: EnrollmentStatus.WITHDRAWN,
        newStatus: EnrollmentStatus.ACTIVE,
      }),
    );
  });

  it('rejects a duplicate active enrollment', async () => {
    await expect(
      service.create(
        {
          studentId: 'student-1',
          classId: 'class-1',
        },
        { userId: 'user-1', role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects enrolling a graduated student', async () => {
    studentRepository.findOneBy.mockResolvedValue(
      Object.assign({}, student, {
        status: StudentStatus.GRADUATED,
      }),
    );

    await expect(
      service.create(
        {
          studentId: 'student-1',
          classId: 'class-1',
        },
        { userId: 'user-1', role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a teacher to enroll a student in their own class', async () => {
    enrollmentRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(enrollment);

    await expect(
      service.create(
        {
          studentId: 'student-1',
          classId: 'class-1',
        },
        { userId: 'user-1', role: UserRole.TEACHER },
      ),
    ).resolves.toMatchObject({ id: 'enrollment-1' });
  });

  it('prevents a teacher from enrolling into another teacher class', async () => {
    teacherRepository.findOne.mockResolvedValue(
      Object.assign({}, teacher, {
        id: 'teacher-2',
      }),
    );

    await expect(
      service.create(
        {
          studentId: 'student-1',
          classId: 'class-1',
        },
        { userId: 'user-1', role: UserRole.TEACHER },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters enrollments for a teacher to their own classes', async () => {
    await service.findAll(
      { status: EnrollmentStatus.ACTIVE },
      { userId: 'user-1', role: UserRole.TEACHER },
    );

    expect(enrollmentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: EnrollmentStatus.ACTIVE,
          schoolClass: {
            teacher: { id: 'teacher-1' },
          },
        },
      }),
    );
  });

  it('returns a friendly error when an enrollment does not exist', async () => {
    enrollmentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findOne('missing', {
        userId: 'user-1',
        role: UserRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates status, completion date, and history', async () => {
    await service.update(
      'enrollment-1',
      {
        status: EnrollmentStatus.WITHDRAWN,
        reason: 'Student requested withdrawal',
      },
      { userId: 'user-1', role: UserRole.ADMIN },
    );

    expect(enrollmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: EnrollmentStatus.WITHDRAWN,
        completedAt: expect.any(Date),
      }),
    );
    expect(historyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        oldStatus: EnrollmentStatus.ACTIVE,
        newStatus: EnrollmentStatus.WITHDRAWN,
        reason: 'Student requested withdrawal',
      }),
    );
  });

  it('requires at least one field when updating', async () => {
    await expect(
      service.update(
        'enrollment-1',
        {},
        { userId: 'user-1', role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns mapped status history without private user fields', async () => {
    historyRepository.find.mockResolvedValue([
      {
        id: 'history-1',
        oldStatus: null,
        newStatus: EnrollmentStatus.ACTIVE,
        reason: 'Student enrolled in class',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        changedByUser,
      },
    ]);

    const [entry] = await service.findHistory('enrollment-1', {
      userId: 'user-1',
      role: UserRole.ADMIN,
    });

    expect(entry).toMatchObject({
      id: 'history-1',
      newStatus: EnrollmentStatus.ACTIVE,
      changedBy: {
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
    });
    expect(entry.changedBy).not.toHaveProperty('passwordHash');
  });

  it('deletes an enrollment for an administrator', async () => {
    await expect(
      service.remove('enrollment-1', {
        userId: 'user-1',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      message: 'Enrollment deleted successfully',
    });

    expect(enrollmentRepository.remove).toHaveBeenCalledWith(enrollment);
  });

  it('prevents a teacher from deleting an enrollment', async () => {
    await expect(
      service.remove('enrollment-1', {
        userId: 'user-1',
        role: UserRole.TEACHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
