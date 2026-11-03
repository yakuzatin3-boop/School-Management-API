import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { Notification } from './entities/notification.entity/notification.entity.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([Notification, User])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
