import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, LessThanOrEqual, Repository } from 'typeorm';

import {
  Announcement,
  AnnouncementAudience,
} from './entities/announcement.entity/announcement.entity.js';
import { AnnouncementRead } from './entities/announcement-read.entity/announcement-read.entity.js';
import { Notification } from '../notifications/entities/notification.entity/notification.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto.js';
import { PublishAnnouncementDto } from './dto/publish-announcement.dto.js';

interface AnnouncementActor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
    @InjectRepository(AnnouncementRead)
    private readonly announcementReadRepository: Repository<AnnouncementRead>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // CREATE ANNOUNCEMENT
  async create(
    createAnnouncementDto: CreateAnnouncementDto,
    actor: AnnouncementActor,
  ) {
    const title = createAnnouncementDto.title.trim();
    const content = createAnnouncementDto.content.trim();

    if (!title || !content) {
      throw new BadRequestException(
        'Announcement title and content are required',
      );
    }

    const expiresAt = createAnnouncementDto.expiresAt
      ? new Date(createAnnouncementDto.expiresAt)
      : null;

    this.assertExpiryIsValid(expiresAt);

    const isPublished = createAnnouncementDto.isPublished ?? false;
    const now = new Date();
    const announcement = this.announcementRepository.create({
      title,
      content,
      audience: createAnnouncementDto.audience ?? AnnouncementAudience.ALL,
      isPublished,
      publishedAt: isPublished ? now : null,
      expiresAt,
      createdByUser: {
        id: actor.userId,
      } as User,
    });

    const savedAnnouncement =
      await this.announcementRepository.save(announcement);

    const notificationsSent = isPublished
      ? await this.notifyAudience(
          savedAnnouncement,
          createAnnouncementDto.notifyUsers !== false,
        )
      : 0;

    const created = await this.getAnnouncementEntity(savedAnnouncement.id);

    return {
      ...this.toPublicAnnouncement(created, null, 0),
      notificationsSent,
    };
  }

  // GET ALL ANNOUNCEMENTS WITH FILTERS AND PAGINATION
  async findAll(query: QueryAnnouncementsDto, actor: AnnouncementActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoinAndSelect('announcement.createdByUser', 'createdByUser')
      .orderBy('announcement.createdAt', 'DESC')
      .addOrderBy('announcement.id', 'DESC');

    if (query.search?.trim()) {
      queryBuilder.andWhere(
        '(announcement.title ILIKE :search OR announcement.content ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (query.audience) {
      queryBuilder.andWhere('announcement.audience = :audience', {
        audience: query.audience,
      });
    }

    if (actor.role === UserRole.ADMIN) {
      if (query.isPublished !== undefined) {
        queryBuilder.andWhere('announcement.isPublished = :isPublished', {
          isPublished: query.isPublished,
        });
      }

      if (query.includeExpired === false) {
        queryBuilder.andWhere(
          '(announcement.expiresAt IS NULL OR announcement.expiresAt > NOW())',
        );
      }
    } else {
      // Non-admins only see announcements that have been published
      // and are still active for their audience.
      queryBuilder
        .andWhere('announcement.isPublished = true')
        .andWhere(
          '(announcement.publishedAt IS NULL OR announcement.publishedAt <= NOW())',
        )
        .andWhere(
          '(announcement.expiresAt IS NULL OR announcement.expiresAt > NOW())',
        )
        .andWhere('announcement.audience IN (:...audiences)', {
          audiences: this.getAudiencesForRole(actor.role),
        });
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [announcements, total] = await queryBuilder.getManyAndCount();
    const announcementIds = announcements.map(
      (announcement) => announcement.id,
    );
    const [readsByAnnouncement, readCounts] = await Promise.all([
      this.findReadsForUser(actor.userId, announcementIds),
      this.countReadsForAnnouncements(announcementIds),
    ]);

    return {
      data: announcements.map((announcement) =>
        this.toPublicAnnouncement(
          announcement,
          readsByAnnouncement.get(announcement.id) ?? null,
          readCounts.get(announcement.id) ?? 0,
        ),
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

  // GET ONE ANNOUNCEMENT
  async findOne(id: string, actor: AnnouncementActor) {
    const announcement = await this.getAnnouncementEntity(id);

    if (actor.role !== UserRole.ADMIN) {
      this.assertVisibleToRole(announcement, actor.role);
    }

    const [read, readCount] = await Promise.all([
      this.announcementReadRepository.findOne({
        where: {
          announcement: { id: announcement.id },
          user: { id: actor.userId },
        },
      }),
      this.announcementReadRepository.count({
        where: {
          announcement: { id: announcement.id },
        },
      }),
    ]);

    return this.toPublicAnnouncement(announcement, read, readCount);
  }

  // UPDATE ANNOUNCEMENT
  async update(
    id: string,
    updateAnnouncementDto: UpdateAnnouncementDto,
    actor: AnnouncementActor,
  ) {
    if (Object.keys(updateAnnouncementDto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const announcement = await this.getManageableAnnouncement(id, actor);

    if (updateAnnouncementDto.title !== undefined) {
      const title = updateAnnouncementDto.title.trim();

      if (!title) {
        throw new BadRequestException('Announcement title cannot be empty');
      }

      announcement.title = title;
    }

    if (updateAnnouncementDto.content !== undefined) {
      const content = updateAnnouncementDto.content.trim();

      if (!content) {
        throw new BadRequestException('Announcement content cannot be empty');
      }

      announcement.content = content;
    }

    if (updateAnnouncementDto.audience !== undefined) {
      announcement.audience = updateAnnouncementDto.audience;
    }

    if (updateAnnouncementDto.expiresAt !== undefined) {
      const expiresAt = updateAnnouncementDto.expiresAt
        ? new Date(updateAnnouncementDto.expiresAt)
        : null;

      this.assertExpiryIsValid(expiresAt);
      announcement.expiresAt = expiresAt;
    }

    await this.announcementRepository.save(announcement);

    const updated = await this.getAnnouncementEntity(id);
    const read = await this.announcementReadRepository.findOne({
      where: {
        announcement: { id },
        user: { id: actor.userId },
      },
    });
    const readCount = await this.announcementReadRepository.count({
      where: {
        announcement: { id },
      },
    });

    return this.toPublicAnnouncement(updated, read, readCount);
  }

  // PUBLISH ANNOUNCEMENT
  async publish(
    id: string,
    publishAnnouncementDto: PublishAnnouncementDto,
    actor: AnnouncementActor,
  ) {
    const announcement = await this.getManageableAnnouncement(id, actor);
    const now = new Date();

    if (announcement.expiresAt && announcement.expiresAt <= now) {
      throw new BadRequestException(
        'An expired announcement cannot be published',
      );
    }

    if (announcement.isPublished && announcement.publishedAt) {
      const current = await this.getAnnouncementEntity(id);
      const readCount = await this.announcementReadRepository.count({
        where: {
          announcement: { id },
        },
      });

      return {
        ...this.toPublicAnnouncement(current, null, readCount),
        notificationsSent: 0,
        alreadyPublished: true,
      };
    }

    const isFirstPublication = announcement.publishedAt === null;

    announcement.isPublished = true;
    announcement.publishedAt = now;

    const savedAnnouncement =
      await this.announcementRepository.save(announcement);

    const notificationsSent =
      isFirstPublication && publishAnnouncementDto.notifyUsers !== false
        ? await this.notifyAudience(savedAnnouncement, true)
        : 0;

    const published = await this.getAnnouncementEntity(id);

    return {
      ...this.toPublicAnnouncement(published, null, 0),
      notificationsSent,
      alreadyPublished: false,
    };
  }

  // UNPUBLISH ANNOUNCEMENT
  async unpublish(id: string, actor: AnnouncementActor) {
    const announcement = await this.getManageableAnnouncement(id, actor);

    announcement.isPublished = false;
    announcement.publishedAt = null;

    await this.announcementRepository.save(announcement);

    const unpublished = await this.getAnnouncementEntity(id);
    const readCount = await this.announcementReadRepository.count({
      where: {
        announcement: { id },
      },
    });

    return this.toPublicAnnouncement(unpublished, null, readCount);
  }

  // DELETE ANNOUNCEMENT
  async remove(id: string, actor: AnnouncementActor) {
    const announcement = await this.getManageableAnnouncement(id, actor);

    await this.announcementRepository.remove(announcement);

    return {
      message: 'Announcement deleted successfully',
    };
  }

  // MARK ANNOUNCEMENT AS READ
  async markAsRead(id: string, actor: AnnouncementActor) {
    const announcement = await this.getAnnouncementEntity(id);

    if (actor.role !== UserRole.ADMIN) {
      this.assertVisibleToRole(announcement, actor.role);
    }

    const existingRead = await this.announcementReadRepository.findOne({
      where: {
        announcement: { id },
        user: { id: actor.userId },
      },
    });

    if (existingRead) {
      return {
        announcementId: id,
        isRead: true,
        readAt: existingRead.readAt,
        alreadyRead: true,
      };
    }

    try {
      const read = await this.announcementReadRepository.save(
        this.announcementReadRepository.create({
          announcement,
          user: { id: actor.userId } as User,
        }),
      );

      return {
        announcementId: id,
        isRead: true,
        readAt: read.readAt,
        alreadyRead: false,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const read = await this.announcementReadRepository.findOne({
          where: {
            announcement: { id },
            user: { id: actor.userId },
          },
        });

        return {
          announcementId: id,
          isRead: true,
          readAt: read?.readAt ?? null,
          alreadyRead: true,
        };
      }

      throw error;
    }
  }

  // GET READ RECEIPTS FOR AN ANNOUNCEMENT
  async findReads(id: string, actor: AnnouncementActor) {
    const announcement = await this.getManageableAnnouncement(id, actor);
    const targetCount = await this.countAudienceUsers(announcement.audience);
    const reads = await this.announcementReadRepository.find({
      where: {
        announcement: { id },
      },
      relations: {
        user: true,
      },
      order: {
        readAt: 'DESC',
      },
    });
    const readCount = reads.length;

    return {
      announcement: {
        id: announcement.id,
        title: announcement.title,
      },
      stats: {
        targetCount,
        readCount,
        unreadCount: Math.max(targetCount - readCount, 0),
        readPercentage:
          targetCount === 0
            ? 0
            : Number(((readCount / targetCount) * 100).toFixed(2)),
      },
      reads: reads.map((read) => ({
        id: read.id,
        readAt: read.readAt,
        user: {
          id: read.user.id,
          email: read.user.email,
          role: read.user.role,
          isActive: read.user.isActive,
        },
      })),
    };
  }

  // GET UNREAD COUNT FOR THE CURRENT USER
  async getUnreadCount(actor: AnnouncementActor) {
    const queryBuilder = this.announcementRepository
      .createQueryBuilder('announcement')
      .leftJoin('announcement.reads', 'read', 'read.user_id = :userId', {
        userId: actor.userId,
      })
      .where('announcement.isPublished = true')
      .andWhere(
        '(announcement.publishedAt IS NULL OR announcement.publishedAt <= NOW())',
      )
      .andWhere(
        '(announcement.expiresAt IS NULL OR announcement.expiresAt > NOW())',
      )
      .andWhere('read.id IS NULL');

    if (actor.role !== UserRole.ADMIN) {
      queryBuilder.andWhere('announcement.audience IN (:...audiences)', {
        audiences: this.getAudiencesForRole(actor.role),
      });
    }

    return {
      unreadCount: await queryBuilder.getCount(),
    };
  }

  // GET ANNOUNCEMENT STATISTICS
  async getStats() {
    const now = new Date();
    const [total, published, drafts, expired, totalReads, active] =
      await Promise.all([
        this.announcementRepository.count(),
        this.announcementRepository.count({
          where: { isPublished: true },
        }),
        this.announcementRepository.count({
          where: { isPublished: false },
        }),
        this.announcementRepository.count({
          where: {
            expiresAt: LessThanOrEqual(now),
          },
        }),
        this.announcementReadRepository.count(),
        this.announcementRepository
          .createQueryBuilder('announcement')
          .where('announcement.isPublished = true')
          .andWhere(
            '(announcement.publishedAt IS NULL OR announcement.publishedAt <= NOW())',
          )
          .andWhere(
            '(announcement.expiresAt IS NULL OR announcement.expiresAt > NOW())',
          )
          .getCount(),
      ]);

    return {
      total,
      published,
      drafts,
      expired,
      active,
      totalReads,
    };
  }

  private async getAnnouncementEntity(id: string) {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
      relations: {
        createdByUser: true,
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return announcement;
  }

  private async getManageableAnnouncement(
    id: string,
    actor: AnnouncementActor,
  ) {
    const announcement = await this.getAnnouncementEntity(id);

    if (actor.role === UserRole.ADMIN) {
      return announcement;
    }

    if (
      actor.role === UserRole.TEACHER &&
      announcement.createdByUser?.id === actor.userId
    ) {
      return announcement;
    }

    throw new ForbiddenException('You can only manage your own announcements');
  }

  private assertVisibleToRole(announcement: Announcement, role: UserRole) {
    const now = new Date();
    const isPublished =
      announcement.isPublished &&
      (!announcement.publishedAt || announcement.publishedAt <= now) &&
      (!announcement.expiresAt || announcement.expiresAt > now);
    const matchesAudience = this.announcementMatchesRole(
      announcement.audience,
      role,
    );

    if (!isPublished || !matchesAudience) {
      throw new NotFoundException('Announcement not found');
    }
  }

  private announcementMatchesRole(
    audience: AnnouncementAudience,
    role: UserRole,
  ) {
    if (audience === AnnouncementAudience.ALL) {
      return true;
    }

    if (audience === AnnouncementAudience.TEACHERS) {
      return role === UserRole.TEACHER;
    }

    if (audience === AnnouncementAudience.STUDENTS) {
      return role === UserRole.STUDENT;
    }

    return false;
  }

  private getAudiencesForRole(role: UserRole) {
    if (role === UserRole.TEACHER) {
      return [AnnouncementAudience.ALL, AnnouncementAudience.TEACHERS];
    }

    if (role === UserRole.STUDENT) {
      return [AnnouncementAudience.ALL, AnnouncementAudience.STUDENTS];
    }

    return [
      AnnouncementAudience.ALL,
      AnnouncementAudience.TEACHERS,
      AnnouncementAudience.STUDENTS,
    ];
  }

  private async notifyAudience(
    announcement: Announcement,
    shouldNotify: boolean,
  ) {
    if (!shouldNotify) {
      return 0;
    }

    const users = await this.userRepository.find({
      where: this.getAudienceUserWhere(announcement.audience),
      select: {
        id: true,
      },
    });

    if (users.length === 0) {
      return 0;
    }

    const notifications = users.map((user) =>
      this.notificationRepository.create({
        user,
        title: announcement.title,
        message: announcement.content,
        type: 'announcement',
        isRead: false,
        readAt: null,
      }),
    );

    await this.notificationRepository.save(notifications);

    return notifications.length;
  }

  private countAudienceUsers(audience: AnnouncementAudience) {
    return this.userRepository.count({
      where: this.getAudienceUserWhere(audience),
    });
  }

  private getAudienceUserWhere(
    audience: AnnouncementAudience,
  ): FindOptionsWhere<User> {
    const where: FindOptionsWhere<User> = {
      isActive: true,
    };

    if (audience === AnnouncementAudience.TEACHERS) {
      where.role = UserRole.TEACHER;
    } else if (audience === AnnouncementAudience.STUDENTS) {
      where.role = UserRole.STUDENT;
    }

    return where;
  }

  private async findReadsForUser(userId: string, announcementIds: string[]) {
    if (announcementIds.length === 0) {
      return new Map<string, AnnouncementRead>();
    }

    const reads = await this.announcementReadRepository.find({
      where: {
        user: { id: userId },
        announcement: { id: In(announcementIds) },
      },
    });

    return new Map(reads.map((read) => [read.announcement.id, read]));
  }

  private async countReadsForAnnouncements(announcementIds: string[]) {
    if (announcementIds.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.announcementReadRepository
      .createQueryBuilder('read')
      .select('read.announcement_id', 'announcementId')
      .addSelect('COUNT(*)', 'count')
      .where('read.announcement_id IN (:...announcementIds)', {
        announcementIds,
      })
      .groupBy('read.announcement_id')
      .getRawMany<{ announcementId: string; count: string }>();

    return new Map(rows.map((row) => [row.announcementId, Number(row.count)]));
  }

  private assertExpiryIsValid(expiresAt: Date | null) {
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future');
    }
  }

  private toPublicAnnouncement(
    announcement: Announcement,
    read: AnnouncementRead | null,
    readCount = 0,
  ) {
    const now = new Date();
    const isExpired =
      announcement.expiresAt !== null && announcement.expiresAt <= now;
    const isVisible =
      announcement.isPublished &&
      (!announcement.publishedAt || announcement.publishedAt <= now) &&
      !isExpired;

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      isPublished: announcement.isPublished,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt,
      isExpired,
      isVisible,
      readCount,
      isRead: Boolean(read),
      readAt: read?.readAt ?? null,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
      author: announcement.createdByUser
        ? {
            id: announcement.createdByUser.id,
            email: announcement.createdByUser.email,
            role: announcement.createdByUser.role,
          }
        : null,
    };
  }

  private isUniqueViolation(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const codedError = error as {
      code?: string;
      driverError?: { code?: string };
    };

    return (
      codedError.code === '23505' || codedError.driverError?.code === '23505'
    );
  }
}
