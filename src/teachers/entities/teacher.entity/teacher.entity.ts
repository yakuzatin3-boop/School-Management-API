import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity/user.entity.js';
import { TeacherSkill } from '../teacher-skill.entity/teacher-skill.entity.js';
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { Lesson } from '../../../lessons/entities/lesson.entity/lesson.entity.js';
import { Assignment } from '../../../assignments/entities/assignment.entity/assignment.entity.js';
import { Score } from '../../../grading/entities/score.entity/score.entity.js';
import { CertificateRequest } from '../../../certificates/entities/certificate-request.entity/certificate-request.entity.js';

export enum TeacherStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
}

@Entity({ name: 'teachers' })
@Check(
  'CHK_teachers_status',
  `"status" IN ('active', 'inactive', 'on_leave')`,
)
@Index('IDX_teachers_status', ['status'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'teacher_number',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  teacherNumber: string;

  @Column({
    name: 'first_name',
    type: 'varchar',
    length: 100,
  })
  firstName: string;

  @Column({
    name: 'last_name',
    type: 'varchar',
    length: 100,
  })
  lastName: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  email: string;

  @Column({
    name: 'phone_number',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  phoneNumber: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: TeacherStatus.ACTIVE,
  })
  status: TeacherStatus;

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

  @OneToOne(() => User, (user) => user.teacher, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User | null>;

  @OneToMany(() => TeacherSkill, (skill) => skill.teacher)
  teacherSkills: Relation<TeacherSkill[]>;

  @OneToMany(() => SchoolClass, (schoolClass) => schoolClass.teacher)
  classes: Relation<SchoolClass[]>;

  @OneToMany(() => Lesson, (lesson) => lesson.teacher)
  lessons: Relation<Lesson[]>;

  @OneToMany(() => Assignment, (assignment) => assignment.teacher)
  assignments: Relation<Assignment[]>;

  @OneToMany(() => Score, (score) => score.gradedByTeacher)
  gradedScores: Relation<Score[]>;

  @OneToMany(
    () => CertificateRequest,
    (request) => request.requestedByTeacher,
  )
  certificateRequests: Relation<CertificateRequest[]>;
}
