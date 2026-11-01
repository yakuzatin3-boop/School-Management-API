import { OmitType } from '@nestjs/mapped-types';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

import { CreateStudentDto } from './create-student.dto.js';

export class CreateStudentProfileDto extends OmitType(CreateStudentDto, [
  'userId',
  'status',
  'email',
] as const) {
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;
}
