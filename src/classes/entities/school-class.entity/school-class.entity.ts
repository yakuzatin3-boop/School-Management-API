import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Course } from '../../../courses/entities/course.entity/course.entity.js';
import { Teacher } from '../../../teachers/entities/teacher.entity/teacher.entity.js';
import { ClassSchedule } from '../class-schedule.entity/class-schedule.entity.js';
import { Enrollment } from '../../../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { Lesson } from '../../../lessons/entities/lesson.entity/lesson.entity.js';
import { Assignment } from '../../../assignments/entities/assignment.entity/assignment.entity.js';
import { StudentGroup } from '../../../groups/entities/student-group.entity/student-group.entity.js';
import { CertificateRequest } from '../../../certificates/entities/certificate-request.entity/certificate-request.entity.js';
import { Certificate } from '../../../certificates/entities/certificate.entity/certificate.entity.js';
import { ClassJoinCode } from '../../../class-registration/entities/class-join-code.entity/class-join-code.entity.js';

@Entity({ name: 'classes' })
@Index('IDX_classes_course_id', ['course'])
@Index('IDX_classes_teacher_id', ['teacher'])
export class SchoolClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'class_code',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  classCode: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;

  @ManyToOne(() => Course, (course) => course.classes, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'course_id' })
  course: Relation<Course>;

  @ManyToOne(() => Teacher, (teacher) => teacher.classes, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher | null>;

  @OneToMany(() => ClassSchedule, (schedule) => schedule.schoolClass)
  schedules: Relation<ClassSchedule[]>;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.schoolClass)
  enrollments: Relation<Enrollment[]>;

  @OneToMany(() => Lesson, (lesson) => lesson.schoolClass)
  lessons: Relation<Lesson[]>;

  @OneToMany(() => Assignment, (assignment) => assignment.schoolClass)
  assignments: Relation<Assignment[]>;

  @OneToMany(() => StudentGroup, (group) => group.schoolClass)
  studentGroups: Relation<StudentGroup[]>;

  @OneToMany(
    () => CertificateRequest,
    (request) => request.schoolClass,
  )
  certificateRequests: Relation<CertificateRequest[]>;

  @OneToMany(() => Certificate, (certificate) => certificate.schoolClass)
  certificates: Relation<Certificate[]>;

  @OneToMany(() => ClassJoinCode, (joinCode) => joinCode.schoolClass)
  joinCodes: Relation<ClassJoinCode[]>;
}
