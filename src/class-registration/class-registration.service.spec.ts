import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClassRegistrationService } from './class-registration.service.js';
import { ClassJoinCode } from './entities/class-join-code.entity/class-join-code.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity/student.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';

describe('ClassRegistrationService', () => {
  const futureDate = new Date(Date.now() + 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 60 * 60 * 1000);
  const course = { id: 'course-1', name: 'Mathematics' };

  const schoolClass = {
    id: 'class-1',
    classCode: 'MATH-1',
    name: 'Algebra',
    status: 'active',
    course,
    teacher: { id: 'teacher-1' },
  } as unknown as SchoolClass;

  const joinCode = {
    id: '11111111-1111-4111-8111-111111111111',
    schoolClass,
    tokenHash: 'a'.repeat(64),
    expiresAt: futureDate,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as ClassJoinCode;

  const student = {
    id: 'student-1',
    status: StudentStatus.ACTIVE,
  } as Student;

  const joinCodeRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const schoolClassRepository = { findOne: vi.fn() };
  const teacherRepository = { findOne: vi.fn() };
  const studentRepository = { findOne: vi.fn() };
  const enrollmentRepository = {
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
  };
  const historyRepository = {
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };

  const manager = {
    getRepository: vi.fn((entity: unknown) => {
      if (entity === ClassJoinCode) {
        return { findOne: vi.fn().mockResolvedValue(joinCode) };
      }
      if (entity === Enrollment) return enrollmentRepository;
      if (entity === EnrollmentStatusHistory) return historyRepository;
      throw new Error('Unexpected repository');
    }),
  };

  const dataSource = {
    transaction: vi.fn((callback) => callback(manager)),
  };

  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:4200';
      if (key === 'JWT_SECRET') return 'test-secret';
      return undefined;
    }),
  };

  let service: ClassRegistrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClassRegistrationService(
      joinCodeRepository as unknown as Repository<ClassJoinCode>,
      schoolClassRepository as unknown as Repository<SchoolClass>,
      teacherRepository as unknown as Repository<Teacher>,
      studentRepository as unknown as Repository<Student>,
      enrollmentRepository as unknown as Repository<Enrollment>,
      dataSource as unknown as DataSource,
      configService as unknown as ConfigService,
    );

    schoolClassRepository.findOne.mockResolvedValue(schoolClass);
    joinCodeRepository.findOne.mockResolvedValue(joinCode);
    joinCodeRepository.find.mockResolvedValue([joinCode]);
    studentRepository.findOne.mockResolvedValue(student);
    manager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === ClassJoinCode) {
        return { findOne: vi.fn().mockResolvedValue(joinCode) };
      }
      if (entity === Enrollment) return enrollmentRepository;
      if (entity === EnrollmentStatusHistory) return historyRepository;
      throw new Error('Unexpected repository');
    });
    enrollmentRepository.findOne.mockResolvedValue(null);
  });

  it('creates a join code with a scannable QR image', async () => {
    const result = await service.createJoinCode(
      'class-1',
      { userId: 'admin-1', role: UserRole.ADMIN },
      {},
    );

    const created = joinCodeRepository.create.mock.calls[0][0];
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result).toMatchObject({
      classId: 'class-1',
      isActive: true,
      isExpired: false,
    });
    expect(result.registrationUrl).toContain(
      'http://localhost:4200/class-registration/',
    );
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('rebuilds the registration URL and QR when listing codes', async () => {
    const [result] = await service.findJoinCodes('class-1', {
      userId: 'admin-1',
      role: UserRole.ADMIN,
    });

    expect(result.registrationUrl).toContain(
      'http://localhost:4200/class-registration/',
    );
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('does not expose a registration URL for expired codes', async () => {
    joinCodeRepository.find.mockResolvedValue([
      Object.assign({}, joinCode, { expiresAt: pastDate }),
    ]);

    const [result] = await service.findJoinCodes('class-1', {
      userId: 'admin-1',
      role: UserRole.ADMIN,
    });

    expect(result).toMatchObject({
      registrationUrl: null,
      qrCodeDataUrl: null,
      isExpired: true,
    });
  });

  it('validates a registration token and returns class details', async () => {
    const result = await service.validateInvitation('token');

    expect(result).toMatchObject({
      valid: true,
      class: {
        id: 'class-1',
        classCode: 'MATH-1',
        name: 'Algebra',
        course: { id: 'course-1', name: 'Mathematics' },
      },
    });
  });

  it('enrolls an authenticated student through a registration token', async () => {
    const result = await service.joinClass('token', 'user-1');

    expect(enrollmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        student,
        schoolClass,
        status: EnrollmentStatus.ACTIVE,
      }),
    );
    expect(historyRepository.save).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      id: 'enrollment-1',
      status: EnrollmentStatus.ACTIVE,
      class: { id: 'class-1', classCode: 'MATH-1' },
    });
  });

  it('rejects a student who is already actively enrolled', async () => {
    enrollmentRepository.findOne.mockResolvedValue({
      id: 'enrollment-1',
      status: EnrollmentStatus.ACTIVE,
    });

    await expect(service.joinClass('token', 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects inactive students', async () => {
    studentRepository.findOne.mockResolvedValue(
      Object.assign({}, student, { status: StudentStatus.INACTIVE }),
    );

    await expect(service.joinClass('token', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects revoked or expired invitations', async () => {
    joinCodeRepository.findOne.mockResolvedValue(
      Object.assign({}, joinCode, { isActive: false }),
    );

    await expect(service.validateInvitation('token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prevents a teacher from managing another teacher class', async () => {
    teacherRepository.findOne.mockResolvedValue({
      id: 'teacher-2',
    } as Teacher);

    await expect(
      service.findJoinCodes('class-1', {
        userId: 'user-1',
        role: UserRole.TEACHER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the owning teacher manage their class invitations', async () => {
    teacherRepository.findOne.mockResolvedValue({
      id: 'teacher-1',
    } as Teacher);

    await expect(
      service.findJoinCodes('class-1', {
        userId: 'user-1',
        role: UserRole.TEACHER,
      }),
    ).resolves.toHaveLength(1);
  });

  it('does not allow students to manage invitations', async () => {
    await expect(
      service.findJoinCodes('class-1', {
        userId: 'user-1',
        role: UserRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records who created the join code', async () => {
    await service.createJoinCode(
      'class-1',
      { userId: 'admin-1', role: UserRole.ADMIN },
      { expiresInHours: 2 },
    );

    const created = joinCodeRepository.create.mock.calls[0][0];
    expect(created.createdByUser).toEqual({ id: 'admin-1' } as User);
  });
});
