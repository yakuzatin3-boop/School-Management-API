
import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherDto } from './create-teacher.dto.js';

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}
