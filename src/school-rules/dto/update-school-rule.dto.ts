import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateSchoolRuleDto } from './create-school-rule.dto.js';

export class UpdateSchoolRuleDto extends PartialType(
  OmitType(CreateSchoolRuleDto, [] as const),
) {}
