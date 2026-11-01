import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Enrollment } from '../../../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { ClassSchedule } from '../../../classes/entities/class-schedule.entity/class-schedule.entity.js';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

@Entity({ name: 'attendance' })
@Check(
  'CHK_attendance_status',
  `"status" IN ('present', 'absent', 'late', 'excused')`,
)
@Index('IDX_attendance_enrollment_id', ['enrollment'])
@Index('IDX_attendance_class_schedule_id', ['classSchedule'])
@Index('IDX_attendance_date', ['attendanceDate'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'attendance_date',
    type: 'date',
  })
  attendanceDate: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  remarks: string | null;

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

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.attendance, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Relation<Enrollment>;

  @ManyToOne(() => ClassSchedule, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'class_schedule_id' })
  classSchedule: Relation<ClassSchedule | null>;
}
