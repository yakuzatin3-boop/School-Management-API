import { PartialType } from '@nestjs/mapped-types';

import { CreateStudentProfileDto } from './create-student-profile.dto.js';

export class UpdateStudentProfileDto extends PartialType(
  CreateStudentProfileDto,
) {}
