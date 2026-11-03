import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { StudentGroup } from './entities/student-group.entity/student-group.entity.js';
import { GroupMember } from './entities/group-member.entity/group-member.entity.js';
import { GroupMessage } from './entities/group-message.entity/group-message.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { CommonModule } from '../common/common.module.js';
import { AcademicAccessModule } from '../common/academic-access/academic-access.module.js';

@Module({
  imports: [
    CommonModule,
    AcademicAccessModule,
    TypeOrmModule.forFeature([
      StudentGroup,
      GroupMember,
      GroupMessage,
      Enrollment,
    ]),
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
