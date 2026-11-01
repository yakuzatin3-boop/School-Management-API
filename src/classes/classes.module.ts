import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassesService } from './classes.service.js';
import { ClassesController } from './classes.controller.js';
import { CommonModule } from '../common/common.module.js';
import { SchoolClass } from './entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from './entities/class-schedule.entity/class-schedule.entity.js';
import { Room } from './entities/room.entity/room.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      SchoolClass,
      ClassSchedule,
      Room,
      Course,
      Teacher,
    ]),
  ],
  providers: [ClassesService],
  controllers: [ClassesController],
})
export class ClassesModule {}
