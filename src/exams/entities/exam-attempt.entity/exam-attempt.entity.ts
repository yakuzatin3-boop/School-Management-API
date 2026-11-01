import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Assignment } from '../../../assignments/entities/assignment.entity/assignment.entity.js';
import { Student } from '../../../students/entities/student.entity/student.entity.js';

@Entity({ name: 'exam_attempts' })
@Unique('UQ_exam_attempts_assignment_student_attempt', [
  'assignment',
  'student',
  'attemptNumber',
])
@Check('CHK_exam_attempts_attempt_number', '"attempt_number" > 0')
@Check('CHK_exam_attempts_score', '"score" IS NULL OR "score" >= 0')
@Index('IDX_exam_attempts_assignment_id', ['assignment'])
@Index('IDX_exam_attempts_student_id', ['student'])
export class ExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'attempt_number',
    type: 'integer',
  })
  attemptNumber: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'in_progress',
  })
  status: string;

  @Column({
    name: 'started_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt: Date;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    nullable: true,
  })
  submittedAt: Date | null;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  score: number | null;

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

  @ManyToOne(() => Assignment, (assignment) => assignment.examAttempts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Relation<Assignment>;

  @ManyToOne(() => Student, (student) => student.examAttempts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Relation<Student>;
}
