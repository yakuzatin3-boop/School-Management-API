import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

import { Attendance } from './entities/attendance.entity/attendance.entity.js';

import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';

import { ClassSchedule } from '../classes/entities/class-schedule.entity/class-schedule.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      Enrollment,
      ClassSchedule,
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}