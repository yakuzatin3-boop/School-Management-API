import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';
import { Submission } from './entities/submission.entity/submission.entity.js';
import { SubmissionAttachment } from './entities/submission-attachment.entity/submission-attachment.entity.js';
import { Assignment } from '../assignments/entities/assignment.entity/assignment.entity.js';
import { GroupMember } from '../groups/entities/group-member.entity/group-member.entity.js';
import { CommonModule } from '../common/common.module.js';
import { AcademicAccessModule } from '../common/academic-access/academic-access.module.js';

@Module({
  imports: [
    CommonModule,
    AcademicAccessModule,
    TypeOrmModule.forFeature([
      Submission,
      SubmissionAttachment,
      Assignment,
      GroupMember,
    ]),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
