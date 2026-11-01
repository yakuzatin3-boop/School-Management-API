import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClassRegistrationService } from './class-registration.service.js';
import { ClassJoinCodesController } from './class-join-codes.controller.js';
import { ClassRegistrationController } from './class-registration.controller.js';
import { ClassJoinCode } from './entities/class-join-code.entity/class-join-code.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      ClassJoinCode,
      SchoolClass,
      Teacher,
      Student,
      Enrollment,
    ]),
  ],
  providers: [ClassRegistrationService],
  controllers: [
    ClassJoinCodesController,
    ClassRegistrationController,
  ],
})
export class ClassRegistrationModule {}
