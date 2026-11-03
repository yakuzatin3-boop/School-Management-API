import { IsOptional, IsUUID } from 'class-validator';

export class CreateExamAttemptDto {
  @IsUUID()
  assignmentId: string;

  /**
   * Required when a teacher or administrator starts an attempt for a
   * student. Students can only start attempts for themselves.
   */
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
