import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeachersService } from './teachers.service.js';
import { TeachersController } from './teachers.controller.js';
import { Teacher } from './entities/teacher.entity/teacher.entity.js';
import { TeacherSkill } from './entities/teacher-skill.entity/teacher-skill.entity.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Teacher, TeacherSkill, User, Course]),
  ],
  providers: [TeachersService],
  controllers: [TeachersController],
  exports: [TeachersService],
})
export class TeachersModule {}
