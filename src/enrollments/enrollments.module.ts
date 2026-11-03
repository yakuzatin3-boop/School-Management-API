import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnrollmentsController } from './enrollments.controller.js';
import { EnrollmentsService } from './enrollments.service.js';
import { Enrollment } from './entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from './entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Enrollment,
      EnrollmentStatusHistory,
      Student,
      SchoolClass,
      Teacher,
    ]),
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
