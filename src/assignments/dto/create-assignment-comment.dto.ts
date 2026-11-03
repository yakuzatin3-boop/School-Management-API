import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssignmentCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content: string;

  @IsOptional()
  @IsUUID()
  submissionId?: string | null;
}
