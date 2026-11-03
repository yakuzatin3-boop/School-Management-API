import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssignmentsController } from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';
import { Assignment } from './entities/assignment.entity/assignment.entity.js';
import { AssignmentAttachment } from './entities/assignment-attachment.entity/assignment-attachment.entity.js';
import { AssignmentComment } from './entities/assignment-comment.entity/assignment-comment.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity/lesson.entity.js';
import { Submission } from '../submissions/entities/submission.entity/submission.entity.js';
import { CommonModule } from '../common/common.module.js';
import { AcademicAccessModule } from '../common/academic-access/academic-access.module.js';

@Module({
  imports: [
    CommonModule,
    AcademicAccessModule,
    TypeOrmModule.forFeature([
      Assignment,
      AssignmentAttachment,
      AssignmentComment,
      Lesson,
      Submission,
    ]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
