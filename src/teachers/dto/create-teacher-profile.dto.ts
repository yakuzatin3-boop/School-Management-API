import { OmitType } from '@nestjs/mapped-types';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';

import { CreateTeacherDto } from './create-teacher.dto.js';

export class CreateTeacherProfileDto extends OmitType(CreateTeacherDto, [
  'userId',
  'status',
  'email',
] as const) {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
