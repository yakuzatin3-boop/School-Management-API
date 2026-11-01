import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Student } from '../../../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../../../teachers/entities/teacher.entity/teacher.entity.js';
import { User } from '../../../users/entities/user.entity/user.entity.js';
import { Certificate } from '../certificate.entity/certificate.entity.js';

@Entity({ name: 'certificate_requests' })
@Index('IDX_certificate_requests_student_id', ['student'])
@Index('IDX_certificate_requests_class_id', ['schoolClass'])
@Index('IDX_certificate_requests_requested_by_teacher_id', [
  'requestedByTeacher',
])
@Index('IDX_certificate_requests_reviewed_by_user_id', ['reviewedByUser'])
export class CertificateRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  reason: string | null;

  @Column({
    name: 'review_notes',
    type: 'text',
    nullable: true,
  })
  reviewNotes: string | null;

  @Column({
    name: 'requested_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  requestedAt: Date;

  @Column({
    name: 'reviewed_at',
    type: 'timestamptz',
    nullable: true,
  })
  reviewedAt: Date | null;

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

  @ManyToOne(() => Student, (student) => student.certificateRequests, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Relation<Student>;

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.certificateRequests, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @ManyToOne(() => Teacher, (teacher) => teacher.certificateRequests, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'requested_by_teacher_id' })
  requestedByTeacher: Relation<Teacher | null>;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedByUser: Relation<User | null>;

  @OneToOne(() => Certificate, (certificate) => certificate.certificateRequest)
  certificate: Relation<Certificate | null>;
}
