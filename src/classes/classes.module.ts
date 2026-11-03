import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesService } from './classes.service.js';
import { ClassesController } from './classes.controller.js';
import { CommonModule } from '../common/common.module.js';
import { SchoolClass } from './entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from './entities/class-schedule.entity/class-schedule.entity.js';
import { Room } from './entities/room.entity/room.entity.js';
import { Building } from './entities/building.entity/building.entity.js';
import { Floor } from './entities/floor.entity/floor.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { BuildingsModule } from './buildings/buildings.module.js';
import { FloorsModule } from './floors/floors.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { ClassRegistrationModule } from '../class-registration/class-registration.module.js';

@Module({
  imports: [
    CommonModule,
    ClassRegistrationModule,
    BuildingsModule,
    FloorsModule,
    RoomsModule,
    TypeOrmModule.forFeature([
      SchoolClass,
      ClassSchedule,
      Room,
      Building,
      Floor,
      Course,
      Teacher,
      Enrollment,
      EnrollmentStatusHistory,
      Student,
    ]),
  ],
  providers: [ClassesService],
  controllers: [ClassesController],
  exports: [ClassesService],
})
export class ClassesModule {}
