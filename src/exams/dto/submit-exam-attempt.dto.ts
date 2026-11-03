import { IsNumber, IsOptional, Min } from 'class-validator';

export class SubmitExamAttemptDto {
  /**
   * Only teachers and administrators may submit a score with the attempt.
   * Students submit without a score.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score?: number;
}
