import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { UserRole } from '../../users/entities/user.entity/user.entity.js';
import { NOTIFICATION_TYPES } from './create-notification.dto.js';

export class BroadcastNotificationDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: string;
}
