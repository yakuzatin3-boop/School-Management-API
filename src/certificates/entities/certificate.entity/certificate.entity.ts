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
import { CertificateRequest } from '../certificate-request.entity/certificate-request.entity.js';

@Entity({ name: 'certificates' })
@Index('IDX_certificates_student_id', ['student'])
@Index('IDX_certificates_class_id', ['schoolClass'])
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'certificate_number',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  certificateNumber: string;

  @Column({
    name: 'file_url',
    type: 'text',
    nullable: true,
  })
  fileUrl: string | null;

  @Column({
    name: 'issued_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  issuedAt: Date;

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

  @ManyToOne(() => Student, (student) => student.certificates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Relation<Student>;

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.certificates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @OneToOne(() => CertificateRequest, (request) => request.certificate, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'certificate_request_id' })
  certificateRequest: Relation<CertificateRequest | null>;
}
