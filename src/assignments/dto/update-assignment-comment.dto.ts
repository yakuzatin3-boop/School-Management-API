import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateAssignmentCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content: string;
}
