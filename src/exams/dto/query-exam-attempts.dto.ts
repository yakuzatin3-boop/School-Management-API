import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ExamAttemptStatus } from './exam-attempt-status.js';

export class QueryExamAttemptsDto {
  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsEnum(ExamAttemptStatus)
  status?: ExamAttemptStatus;

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
