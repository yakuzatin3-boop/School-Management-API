import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoursesService } from './courses.service.js';
import { CoursesController } from './courses.controller.js';
import { Course } from './entities/course.entity/course.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { TeacherSkill } from '../teachers/entities/teacher-skill.entity/teacher-skill.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Course, SchoolClass, TeacherSkill]),
  ],
  providers: [CoursesService],
  controllers: [CoursesController],
  exports: [CoursesService],
})
export class CoursesModule {}
