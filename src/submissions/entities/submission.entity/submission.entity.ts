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
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Assignment } from '../../../assignments/entities/assignment.entity/assignment.entity.js';
import { Student } from '../../../students/entities/student.entity/student.entity.js';
import { StudentGroup } from '../../../groups/entities/student-group.entity/student-group.entity.js';
import { Score } from '../../../grading/entities/score.entity/score.entity.js';
import { SubmissionAttachment } from '../submission-attachment.entity/submission-attachment.entity.js';

@Entity({ name: 'submissions' })
@Check(
  'CHK_submissions_student_or_group',
  '("student_id" IS NOT NULL) <> ("group_id" IS NOT NULL)',
)
@Index('IDX_submissions_assignment_id', ['assignment'])
@Index('IDX_submissions_student_id', ['student'])
@Index('IDX_submissions_group_id', ['studentGroup'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  content: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'submitted',
  })
  status: string;

  @Column({
    name: 'is_late',
    type: 'boolean',
    default: false,
  })
  isLate: boolean;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  submittedAt: Date;

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

  @ManyToOne(() => Assignment, (assignment) => assignment.submissions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Relation<Assignment>;

  @ManyToOne(() => Student, (student) => student.submissions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Relation<Student | null>;

  @ManyToOne(() => StudentGroup, (group) => group.submissions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  studentGroup: Relation<StudentGroup | null>;

  @OneToMany(() => Score, (score) => score.submission)
  scores: Relation<Score[]>;

  @OneToMany(
    () => SubmissionAttachment,
    (attachment) => attachment.submission,
  )
  attachments: Relation<SubmissionAttachment[]>;
}
