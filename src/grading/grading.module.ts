import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GradeScalesController } from './grade-scales.controller.js';
import { ScoresController } from './scores.controller.js';
import { GradingService } from './grading.service.js';
import { GradeScale } from './entities/grade-scale.entity/grade-scale.entity.js';
import { Score } from './entities/score.entity/score.entity.js';
import { Submission } from '../submissions/entities/submission.entity/submission.entity.js';
import { CommonModule } from '../common/common.module.js';
import { AcademicAccessModule } from '../common/academic-access/academic-access.module.js';

@Module({
  imports: [
    CommonModule,
    AcademicAccessModule,
    TypeOrmModule.forFeature([GradeScale, Score, Submission]),
  ],
  controllers: [GradeScalesController, ScoresController],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
