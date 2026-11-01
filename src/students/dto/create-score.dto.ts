import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScoreDto {
  @IsUUID()
  assignmentId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  score: number;

  @IsOptional()
  @IsUUID()
  gradeScaleId?: string;

  @IsOptional()
  @IsUUID()
  gradedByTeacherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  feedback?: string;
}
