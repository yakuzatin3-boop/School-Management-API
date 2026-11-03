import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';
import { ExamAttempt } from './entities/exam-attempt.entity/exam-attempt.entity.js';
import { Assignment } from '../assignments/entities/assignment.entity/assignment.entity.js';
import { CommonModule } from '../common/common.module.js';
import { AcademicAccessModule } from '../common/academic-access/academic-access.module.js';

@Module({
  imports: [
    CommonModule,
    AcademicAccessModule,
    TypeOrmModule.forFeature([ExamAttempt, Assignment]),
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
