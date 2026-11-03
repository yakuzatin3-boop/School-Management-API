import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { EnrollmentStatus } from '../entities/enrollment.entity/enrollment.entity.js';

export class CreateEnrollmentDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  classId: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
