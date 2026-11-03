import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  assignmentId: string;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string | null;

  @IsOptional()
  @IsBoolean()
  markLate?: boolean;
}
