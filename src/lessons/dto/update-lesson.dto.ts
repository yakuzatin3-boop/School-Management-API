import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateLessonDto } from './create-lesson.dto.js';

export class UpdateLessonDto extends PartialType(
  OmitType(CreateLessonDto, ['classId'] as const),
) {}
