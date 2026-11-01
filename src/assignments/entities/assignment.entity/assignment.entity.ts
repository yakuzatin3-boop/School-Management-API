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
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../../../teachers/entities/teacher.entity/teacher.entity.js';
import { Lesson } from '../../../lessons/entities/lesson.entity/lesson.entity.js';
import { Submission } from '../../../submissions/entities/submission.entity/submission.entity.js';
import { AssignmentComment } from '../assignment-comment.entity/assignment-comment.entity.js';
import { AssignmentAttachment } from '../assignment-attachment.entity/assignment-attachment.entity.js';
import { ExamAttempt } from '../../../exams/entities/exam-attempt.entity/exam-attempt.entity.js';

@Entity({ name: 'assignments' })
@Check('CHK_assignments_max_score', '"max_score" > 0')
@Index('IDX_assignments_class_id', ['schoolClass'])
@Index('IDX_assignments_teacher_id', ['teacher'])
@Index('IDX_assignments_lesson_id', ['lesson'])
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'max_score',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 100,
  })
  maxScore: number;

  @Column({
    name: 'due_at',
    type: 'timestamptz',
    nullable: true,
  })
  dueAt: Date | null;

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

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @ManyToOne(() => Teacher, (teacher) => teacher.assignments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher | null>;

  @ManyToOne(() => Lesson, (lesson) => lesson.assignments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Relation<Lesson | null>;

  @OneToMany(() => Submission, (submission) => submission.assignment)
  submissions: Relation<Submission[]>;

  @OneToMany(() => AssignmentComment, (comment) => comment.assignment)
  comments: Relation<AssignmentComment[]>;

  @OneToMany(() => AssignmentAttachment, (attachment) => attachment.assignment)
  attachments: Relation<AssignmentAttachment[]>;

  @OneToMany(() => ExamAttempt, (attempt) => attempt.assignment)
  examAttempts: Relation<ExamAttempt[]>;
}
