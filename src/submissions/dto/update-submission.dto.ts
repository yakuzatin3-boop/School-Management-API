import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  LATE = 'late',
  RETURNED = 'returned',
  RESUBMITTED = 'resubmitted',
}

export class UpdateSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string | null;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}
