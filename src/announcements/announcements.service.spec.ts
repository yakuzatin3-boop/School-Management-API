import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnnouncementsService } from './announcements.service.js';
import {
  Announcement,
  AnnouncementAudience,
} from './entities/announcement.entity/announcement.entity.js';
import { AnnouncementRead } from './entities/announcement-read.entity/announcement-read.entity.js';
import { Notification } from '../notifications/entities/notification.entity/notification.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';

describe('AnnouncementsService', () => {
  const admin = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    isActive: true,
    passwordHash: 'secret',
  } as User;
  const teacher = {
    id: 'teacher-user-1',
    email: 'teacher@example.com',
    role: UserRole.TEACHER,
    isActive: true,
  } as User;

  const makeAnnouncement = (overrides: Partial<Announcement> = {}) =>
    Object.assign(
      {
        id: 'announcement-1',
        title: 'Exam schedule',
        content: 'The final exam starts next Monday.',
        audience: AnnouncementAudience.ALL,
        isPublished: true,
        publishedAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdByUser: admin,
      },
      overrides,
    ) as Announcement;

  const announcementQueryBuilder = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
    getCount: vi.fn(),
  };
  const readCountQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(),
  };

  const announcementRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) =>
      Promise.resolve(
        Object.assign({}, value, {
          id: 'announcement-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    ),
    remove: vi.fn((value) => Promise.resolve(value)),
    count: vi.fn(),
    createQueryBuilder: vi.fn(() => announcementQueryBuilder),
  };
  const announcementReadRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
    count: vi.fn(),
    createQueryBuilder: vi.fn(() => readCountQueryBuilder),
  };
  const notificationRepository = {
    create: vi.fn((value) => value),
    save: vi.fn((value) => Promise.resolve(value)),
  };
  const userRepository = {
    find: vi.fn(),
    count: vi.fn(),
  };

  let service: AnnouncementsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnnouncementsService(
      announcementRepository as unknown as Repository<Announcement>,
      announcementReadRepository as unknown as Repository<AnnouncementRead>,
      notificationRepository as unknown as Repository<Notification>,
      userRepository as unknown as Repository<User>,
    );

    announcementRepository.findOne.mockResolvedValue(makeAnnouncement());
    announcementRepository.count.mockResolvedValue(0);
    announcementReadRepository.find.mockResolvedValue([]);
    announcementReadRepository.findOne.mockResolvedValue(null);
    announcementReadRepository.count.mockResolvedValue(0);
    announcementQueryBuilder.getManyAndCount.mockResolvedValue([
      [makeAnnouncement()],
      1,
    ]);
    announcementQueryBuilder.getCount.mockResolvedValue(1);
    readCountQueryBuilder.getRawMany.mockResolvedValue([]);
    userRepository.find.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
    userRepository.count.mockResolvedValue(10);
  });

  it('creates a draft announcement', async () => {
    announcementRepository.findOne.mockResolvedValue(
      makeAnnouncement({
        isPublished: false,
        publishedAt: null,
      }),
    );

    const result = await service.create(
      {
        title: '  Exam schedule  ',
        content: '  Final exam next Monday.  ',
      },
      { userId: 'admin-1', role: UserRole.ADMIN },
    );

    expect(announcementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Exam schedule',
        content: 'Final exam next Monday.',
        audience: AnnouncementAudience.ALL,
        isPublished: false,
        publishedAt: null,
      }),
    );
    expect(result).toMatchObject({
      id: 'announcement-1',
      isPublished: false,
      notificationsSent: 0,
    });
  });

  it('publishes immediately and notifies the target audience', async () => {
    announcementRepository.findOne.mockResolvedValue(
      makeAnnouncement({ title: 'Exam schedule' }),
    );

    const result = await service.create(
      {
        title: 'Exam schedule',
        content: 'Final exam next Monday.',
        audience: AnnouncementAudience.STUDENTS,
        isPublished: true,
      },
      { userId: 'admin-1', role: UserRole.ADMIN },
    );

    expect(notificationRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Exam schedule',
          type: 'announcement',
          isRead: false,
        }),
      ]),
    );
    expect(result.notificationsSent).toBe(2);
  });

  it('rejects an expiry date in the past', async () => {
    await expect(
      service.create(
        {
          title: 'Old news',
          content: 'This has already expired.',
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
        { userId: 'admin-1', role: UserRole.ADMIN },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns paginated visible announcements for a student', async () => {
    announcementReadRepository.find.mockResolvedValue([]);
    readCountQueryBuilder.getRawMany.mockResolvedValue([
      { announcementId: 'announcement-1', count: '4' },
    ]);

    const result = await service.findAll(
      { page: 1, limit: 10 },
      { userId: 'student-user-1', role: UserRole.STUDENT },
    );

    expect(announcementQueryBuilder.andWhere).toHaveBeenCalledWith(
      'announcement.audience IN (:...audiences)',
      {
        audiences: [AnnouncementAudience.ALL, AnnouncementAudience.STUDENTS],
      },
    );
    expect(result).toMatchObject({
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
      data: [
        {
          id: 'announcement-1',
          readCount: 4,
          isRead: false,
        },
      ],
    });
  });

  it('hides drafts from students', async () => {
    announcementRepository.findOne.mockResolvedValue(
      makeAnnouncement({ isPublished: false }),
    );

    await expect(
      service.findOne('announcement-1', {
        userId: 'student-user-1',
        role: UserRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides teacher-only announcements from students', async () => {
    announcementRepository.findOne.mockResolvedValue(
      makeAnnouncement({
        audience: AnnouncementAudience.TEACHERS,
      }),
    );

    await expect(
      service.findOne('announcement-1', {
        userId: 'student-user-1',
        role: UserRole.STUDENT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a teacher to update their own announcement', async () => {
    announcementRepository.findOne.mockResolvedValue(
      makeAnnouncement({ createdByUser: teacher }),
    );

    const result = await service.update(
      'announcement-1',
      { title: 'Updated title' },
      { userId: 'teacher-user-1', role: UserRole.TEACHER },
    );

    expect(announcementRepository.save).toHaveBeenCalled();
    expect(result.title).toBe('Updated title');
  });

  it('prevents a teacher from updating another author announcement', async () => {
    await expect(
      service.update(
        'announcement-1',
        { title: 'Hijacked' },
        { userId: 'teacher-user-1', role: UserRole.TEACHER },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('publishes a draft and sends notifications', async () => {
    const draft = makeAnnouncement({
      isPublished: false,
      publishedAt: null,
    });
    const published = makeAnnouncement();

    announcementRepository.findOne
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(published);

    const result = await service.publish(
      'announcement-1',
      {},
      { userId: 'admin-1', role: UserRole.ADMIN },
    );

    expect(announcementRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isPublished: true,
        publishedAt: expect.any(Date),
      }),
    );
    expect(notificationRepository.save).toHaveBeenCalledOnce();
    expect(result.notificationsSent).toBe(2);
    expect(result.alreadyPublished).toBe(false);
  });

  it('does not send duplicate notifications when already published', async () => {
    const result = await service.publish(
      'announcement-1',
      {},
      { userId: 'admin-1', role: UserRole.ADMIN },
    );

    expect(notificationRepository.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      alreadyPublished: true,
      notificationsSent: 0,
    });
  });

  it('marks an announcement as read', async () => {
    const readAt = new Date('2026-01-03T00:00:00.000Z');
    announcementReadRepository.save.mockResolvedValue({
      id: 'read-1',
      readAt,
    });

    const result = await service.markAsRead('announcement-1', {
      userId: 'student-user-1',
      role: UserRole.STUDENT,
    });

    expect(announcementReadRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        announcement: expect.objectContaining({
          id: 'announcement-1',
        }),
        user: { id: 'student-user-1' },
      }),
    );
    expect(result).toMatchObject({
      isRead: true,
      alreadyRead: false,
      readAt,
    });
  });

  it('returns read receipts with audience statistics', async () => {
    announcementReadRepository.find.mockResolvedValue([
      {
        id: 'read-1',
        readAt: new Date('2026-01-03T00:00:00.000Z'),
        user: {
          id: 'student-user-1',
          email: 'student@example.com',
          role: UserRole.STUDENT,
          isActive: true,
          passwordHash: 'secret',
        },
      },
    ]);

    const result = await service.findReads('announcement-1', {
      userId: 'admin-1',
      role: UserRole.ADMIN,
    });

    expect(result.stats).toEqual({
      targetCount: 10,
      readCount: 1,
      unreadCount: 9,
      readPercentage: 10,
    });
    expect(result.reads[0].user).not.toHaveProperty('passwordHash');
  });

  it('counts unread announcements for the current user', async () => {
    announcementQueryBuilder.getCount.mockResolvedValue(3);

    const result = await service.getUnreadCount({
      userId: 'student-user-1',
      role: UserRole.STUDENT,
    });

    expect(result).toEqual({ unreadCount: 3 });
    expect(announcementQueryBuilder.andWhere).toHaveBeenCalledWith(
      'read.id IS NULL',
    );
  });

  it('returns announcement statistics', async () => {
    announcementRepository.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    announcementReadRepository.count.mockResolvedValue(30);
    announcementQueryBuilder.getCount.mockResolvedValue(6);

    await expect(service.getStats()).resolves.toEqual({
      total: 12,
      published: 8,
      drafts: 4,
      expired: 2,
      active: 6,
      totalReads: 30,
    });
  });
});
