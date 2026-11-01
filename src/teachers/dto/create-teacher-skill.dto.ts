import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { TeacherSkillLevel } from '../entities/teacher-skill.entity/teacher-skill.entity.js';

export class CreateTeacherSkillDto {
  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsEnum(TeacherSkillLevel)
  skillLevel?: TeacherSkillLevel;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999.9)
  yearsExperience?: number;
}
