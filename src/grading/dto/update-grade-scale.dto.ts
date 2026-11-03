import { PartialType } from '@nestjs/mapped-types';

import { CreateGradeScaleDto } from './create-grade-scale.dto.js';

export class UpdateGradeScaleDto extends PartialType(CreateGradeScaleDto) {}
