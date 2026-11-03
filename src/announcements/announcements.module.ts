import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnnouncementsController } from './announcements.controller.js';
import { AnnouncementsService } from './announcements.service.js';
import { Announcement } from './entities/announcement.entity/announcement.entity.js';
import { AnnouncementRead } from './entities/announcement-read.entity/announcement-read.entity.js';
import { Notification } from '../notifications/entities/notification.entity/notification.entity.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Announcement,
      AnnouncementRead,
      Notification,
      User,
    ]),
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
