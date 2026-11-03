import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAssignmentAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  fileUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mimeType?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null
      ? value
      : String(value as string | number | boolean),
  )
  @IsString()
  @MaxLength(30)
  fileSize?: string | null;
}
