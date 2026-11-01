import { IsEnum, IsOptional } from 'class-validator';

import { EnrollmentStatus } from '../../enrollments/entities/enrollment.entity/enrollment.entity.js';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
