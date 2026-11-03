import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity/user.entity.js';
import { Teacher } from '../../teachers/entities/teacher.entity/teacher.entity.js';
import { Student } from '../../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../../classes/entities/school-class.entity/school-class.entity.js';
import { Enrollment } from '../../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { AcademicAccessService } from './academic-access.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Teacher,
      Student,
      SchoolClass,
      Enrollment,
    ]),
  ],
  providers: [AcademicAccessService],
  exports: [AcademicAccessService],
})
export class AcademicAccessModule {}
