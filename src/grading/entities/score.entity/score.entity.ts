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
import { Submission } from '../../../submissions/entities/submission.entity/submission.entity.js';
import { Teacher } from '../../../teachers/entities/teacher.entity/teacher.entity.js';
import { GradeScale } from '../grade-scale.entity/grade-scale.entity.js';

@Entity({ name: 'scores' })
@Check('CHK_scores_score', '"score" >= 0')
@Index('IDX_scores_submission_id', ['submission'])
@Index('IDX_scores_graded_by_teacher_id', ['gradedByTeacher'])
@Index('IDX_scores_grade_scale_id', ['gradeScale'])
export class Score {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
  })
  score: number;

  @Column({
    type: 'text',
    nullable: true,
  })
  feedback: string | null;

  @Column({
    name: 'graded_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  gradedAt: Date;

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

  @ManyToOne(() => Submission, (submission) => submission.scores, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'submission_id' })
  submission: Relation<Submission>;

  @ManyToOne(() => Teacher, (teacher) => teacher.gradedScores, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'graded_by_teacher_id' })
  gradedByTeacher: Relation<Teacher | null>;

  @ManyToOne(() => GradeScale, (gradeScale) => gradeScale.scores, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'grade_scale_id' })
  gradeScale: Relation<GradeScale | null>;
}
