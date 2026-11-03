import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGradeScaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  label: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minScore: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
