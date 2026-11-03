import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { Notification } from './entities/notification.entity/notification.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';

export interface NotificationActor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateNotificationDto) {
    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const notification = this.notificationRepository.create({
      user,
      title: dto.title.trim(),
      message: dto.message.trim(),
      type: dto.type ?? 'info',
      isRead: false,
      readAt: null,
    });

    return this.toPublicNotification(
      await this.notificationRepository.save(notification),
    );
  }

  async broadcast(dto: BroadcastNotificationDto) {
    const where: FindOptionsWhere<User> = { isActive: true };

    if (dto.role) {
      where.role = dto.role;
    }

    const users = await this.userRepository.find({
      where,
      select: { id: true, role: true },
    });

    if (users.length === 0) {
      return { recipients: 0, notificationsCreated: 0 };
    }

    const notifications = users.map((user) =>
      this.notificationRepository.create({
        user,
        title: dto.title.trim(),
        message: dto.message.trim(),
        type: dto.type ?? 'info',
        isRead: false,
        readAt: null,
      }),
    );

    await this.notificationRepository.save(notifications);

    return {
      recipients: users.length,
      notificationsCreated: notifications.length,
    };
  }

  async findAll(query: QueryNotificationsDto, actor: NotificationActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: FindOptionsWhere<Notification> = {
      user: { id: actor.userId },
    };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where,
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      data: notifications.map((notification) =>
        this.toPublicNotification(notification),
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

  async findOne(id: string, actor: NotificationActor) {
    const notification = await this.getNotificationEntity(id);
    this.assertCanAccessNotification(notification, actor);

    return this.toPublicNotification(notification);
  }

  async getUnreadCount(actor: NotificationActor) {
    const unreadCount = await this.notificationRepository.count({
      where: {
        user: { id: actor.userId },
        isRead: false,
      },
    });

    return { unreadCount };
  }

  async markAsRead(id: string, actor: NotificationActor) {
    const notification = await this.getNotificationEntity(id);
    this.assertCanAccessNotification(notification, actor);

    if (notification.isRead) {
      return {
        ...this.toPublicNotification(notification),
        alreadyRead: true,
      };
    }

    notification.isRead = true;
    notification.readAt = new Date();

    const saved = await this.notificationRepository.save(notification);

    return {
      ...this.toPublicNotification(saved),
      alreadyRead: false,
    };
  }

  async markAllAsRead(actor: NotificationActor) {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('user_id = :userId', { userId: actor.userId })
      .andWhere('is_read = false')
      .execute();

    return {
      updated: result.affected ?? 0,
      message: 'All notifications marked as read',
    };
  }

  async remove(id: string, actor: NotificationActor) {
    const notification = await this.getNotificationEntity(id);
    this.assertCanAccessNotification(notification, actor);

    await this.notificationRepository.remove(notification);

    return { message: 'Notification deleted successfully' };
  }

  async clearRead(actor: NotificationActor) {
    const result = await this.notificationRepository.delete({
      user: { id: actor.userId },
      isRead: true,
    });

    return {
      deleted: result.affected ?? 0,
      message: 'Read notifications cleared',
    };
  }

  private async getNotificationEntity(id: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private assertCanAccessNotification(
    notification: Notification,
    actor: NotificationActor,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (notification.user.id !== actor.userId) {
      throw new ForbiddenException(
        'You can only access your own notifications',
      );
    }
  }

  private toPublicNotification(notification: Notification) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      readAt: notification.readAt,
      userId: notification.user?.id ?? null,
      createdAt: notification.createdAt,
    };
  }
}
