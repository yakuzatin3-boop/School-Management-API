import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { AnnouncementAudience } from '../entities/announcement.entity/announcement.entity.js';

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  return value === true || value === 'true';
};

export class QueryAnnouncementsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  includeExpired?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
