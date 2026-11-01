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
import { Enrollment } from '../../../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { Submission } from '../../../submissions/entities/submission.entity/submission.entity.js';
import { ExamAttempt } from '../../../exams/entities/exam-attempt.entity/exam-attempt.entity.js';
import { CertificateRequest } from '../../../certificates/entities/certificate-request.entity/certificate-request.entity.js';
import { Certificate } from '../../../certificates/entities/certificate.entity/certificate.entity.js';

export enum StudentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  GRADUATED = 'graduated',
}

export enum StudentGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

@Entity({ name: 'students' })
@Check(
  'CHK_students_status',
  `"status" IN ('active', 'inactive', 'suspended', 'graduated')`,
)
@Check(
  'CHK_students_gender',
  `"gender" IS NULL OR "gender" IN ('male', 'female', 'other')`,
)
@Index('IDX_students_status', ['status'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'student_number',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  studentNumber: string;

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
    length: 150,
    unique: true,
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
    name: 'date_of_birth',
    type: 'date',
    nullable: true,
  })
  dateOfBirth: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  gender: StudentGender | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  address: string | null;

  @Column({
    name: 'guardian_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  guardianName: string | null;

  @Column({
    name: 'guardian_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  guardianPhone: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: StudentStatus.ACTIVE,
  })
  status: StudentStatus;

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

  @OneToOne(() => User, (user) => user.student, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User | null>;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments: Relation<Enrollment[]>;

  @OneToMany(() => Submission, (submission) => submission.student)
  submissions: Relation<Submission[]>;

  @OneToMany(() => ExamAttempt, (attempt) => attempt.student)
  examAttempts: Relation<ExamAttempt[]>;

  @OneToMany(() => CertificateRequest, (request) => request.student)
  certificateRequests: Relation<CertificateRequest[]>;

  @OneToMany(() => Certificate, (certificate) => certificate.student)
  certificates: Relation<Certificate[]>;
}
