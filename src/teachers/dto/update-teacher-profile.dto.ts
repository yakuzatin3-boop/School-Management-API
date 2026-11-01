import { PartialType } from '@nestjs/mapped-types';

import { CreateTeacherProfileDto } from './create-teacher-profile.dto.js';

export class UpdateTeacherProfileDto extends PartialType(
  CreateTeacherProfileDto,
) {}
