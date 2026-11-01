import { PartialType } from '@nestjs/mapped-types';

import { CreateTeacherSkillDto } from './create-teacher-skill.dto.js';

export class UpdateTeacherSkillDto extends PartialType(
  CreateTeacherSkillDto,
) {}
