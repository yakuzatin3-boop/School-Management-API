import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScoreDto {
  @IsUUID()
  submissionId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string | null;

  @IsOptional()
  @IsUUID()
  gradeScaleId?: string | null;

  /**
   * Administrators may attribute the grade to a specific teacher.
   */
  @IsOptional()
  @IsUUID()
  gradedByTeacherId?: string | null;
}
