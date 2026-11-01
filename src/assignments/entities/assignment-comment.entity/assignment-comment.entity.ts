import {
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
import { Assignment } from '../assignment.entity/assignment.entity.js';
import { Submission } from '../../../submissions/entities/submission.entity/submission.entity.js';
import { User } from '../../../users/entities/user.entity/user.entity.js';

@Entity({ name: 'assignment_comments' })
@Index('IDX_assignment_comments_assignment_id', ['assignment'])
@Index('IDX_assignment_comments_submission_id', ['submission'])
@Index('IDX_assignment_comments_author_user_id', ['author'])
export class AssignmentComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'text',
  })
  content: string;

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

  @ManyToOne(() => Assignment, (assignment) => assignment.comments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Relation<Assignment>;

  @ManyToOne(() => Submission, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'submission_id' })
  submission: Relation<Submission | null>;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'author_user_id' })
  author: Relation<User | null>;
}
