import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLessonDto {
  @IsUUID()
  classId: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  lessonNumber: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  content?: string | null;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string | null;
}
