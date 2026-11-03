import { IsUUID } from 'class-validator';

export class AddClassStudentDto {
  @IsUUID()
  studentId: string;
}
