import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import { EnrollmentStatus } from '../entities/enrollment.entity/enrollment.entity.js';

export class QueryEnrollmentDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
