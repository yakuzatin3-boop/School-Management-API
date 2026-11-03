import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { EnrollmentStatus } from '../../enrollments/entities/enrollment.entity/enrollment.entity.js';

export class UpdateClassEnrollmentDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
