import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StudentsService } from './students.service.js';
import { StudentsController } from './students.controller.js';
import { Student } from './entities/student.entity/student.entity.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from '../classes/entities/class-schedule.entity/class-schedule.entity.js';
import { Attendance } from '../attendance/entities/attendance.entity/attendance.entity.js';
import { Assignment } from '../assignments/entities/assignment.entity/assignment.entity.js';
import { Submission } from '../submissions/entities/submission.entity/submission.entity.js';
import { Score } from '../grading/entities/score.entity/score.entity.js';
import { GradeScale } from '../grading/entities/grade-scale.entity/grade-scale.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Student,
      User,
      Enrollment,
      EnrollmentStatusHistory,
      SchoolClass,
      ClassSchedule,
      Attendance,
      Assignment,
      Submission,
      Score,
      GradeScale,
      Teacher,
    ]),
  ],
  providers: [StudentsService],
  controllers: [StudentsController],
  exports: [StudentsService],
})
export class StudentsModule {}
