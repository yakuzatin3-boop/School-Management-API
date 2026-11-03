import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

import { ExamAttemptStatus } from './exam-attempt-status.js';

export class UpdateExamAttemptDto {
  @IsOptional()
  @IsEnum(ExamAttemptStatus)
  status?: ExamAttemptStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score?: number;
}
