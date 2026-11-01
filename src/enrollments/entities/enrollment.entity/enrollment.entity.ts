import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Student } from '../../../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { EnrollmentStatusHistory } from '../enrollment-status-history.entity/enrollment-status-history.entity.js';
import { GroupMember } from '../../../groups/entities/group-member.entity/group-member.entity.js';
import { Attendance } from '../../../attendance/entities/attendance.entity/attendance.entity.js';

export enum EnrollmentStatus {
  ACTIVE = 'active',
  WITHDRAWN = 'withdrawn',
  SUSPENDED = 'suspended',
}

@Entity({ name: 'enrollments' })
@Unique('UQ_enrollments_student_class', ['student', 'schoolClass'])
@Check(
  'CHK_enrollments_status',
  `"status" IN ('active', 'withdrawn', 'suspended')`,
)
@Index('IDX_enrollments_student_id', ['student'])
@Index('IDX_enrollments_class_id', ['schoolClass'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: EnrollmentStatus.ACTIVE,
  })
  status: EnrollmentStatus;

  @Column({
    name: 'completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  completedAt: Date | null;

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

  @ManyToOne(() => Student, (student) => student.enrollments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Relation<Student>;

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.enrollments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @OneToMany(
    () => EnrollmentStatusHistory,
    (history) => history.enrollment,
  )
  statusHistory: Relation<EnrollmentStatusHistory[]>;

  @OneToMany(() => GroupMember, (member) => member.enrollment)
  groupMembers: Relation<GroupMember[]>;

  @OneToMany(() => Attendance, (attendance) => attendance.enrollment)
  attendance: Relation<Attendance[]>;
}
