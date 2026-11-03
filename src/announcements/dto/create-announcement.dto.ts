import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { AnnouncementAudience } from '../entities/announcement.entity/announcement.entity.js';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  content: string;

  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  /**
   * When publishing immediately, notify the target audience.
   * Defaults to true.
   */
  @IsOptional()
  @IsBoolean()
  notifyUsers?: boolean;
}
