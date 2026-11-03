import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SchoolRulesController } from './school-rules.controller.js';
import { SchoolRulesService } from './school-rules.service.js';
import { SchoolRule } from './entities/school-rule.entity/school-rule.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([SchoolRule])],
  controllers: [SchoolRulesController],
  providers: [SchoolRulesService],
  exports: [SchoolRulesService],
})
export class SchoolRulesModule {}
