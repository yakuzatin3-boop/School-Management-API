import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateScoreDto } from './create-score.dto.js';

export class UpdateScoreDto extends PartialType(
  OmitType(CreateScoreDto, ['submissionId'] as const),
) {}
