import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { TeachersModule } from './teachers/teachers.module.js';
import { StudentsModule } from './students/students.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClassRegistrationModule } from './class-registration/class-registration.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { ExamsModule } from './exams/exams.module.js';
import { GradingModule } from './grading/grading.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { CertificatesModule } from './certificates/certificates.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SchoolRulesModule } from './school-rules/school-rules.module.js';
import { AuditModule } from './audit/audit.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    DatabaseModule,

    TeachersModule,

    StudentsModule,

    LessonsModule,

    AssignmentsModule,

    SubmissionsModule,

    ClassesModule,

    CoursesModule,

    UsersModule,

    AuthModule,

    ClassRegistrationModule,

    AttendanceModule,

    EnrollmentsModule,

    AnnouncementsModule,

    NotificationsModule,

    ExamsModule,

    GradingModule,

    GroupsModule,

    CertificatesModule,

    SchoolRulesModule,

    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
