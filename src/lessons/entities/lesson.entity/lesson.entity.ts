import {
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
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { Teacher } from '../../../teachers/entities/teacher.entity/teacher.entity.js';
import { Assignment } from '../../../assignments/entities/assignment.entity/assignment.entity.js';

@Entity({ name: 'lessons' })
@Unique('UQ_lessons_class_lesson_number', ['schoolClass', 'lessonNumber'])
@Index('IDX_lessons_class_id', ['schoolClass'])
@Index('IDX_lessons_teacher_id', ['teacher'])
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'lesson_number',
    type: 'integer',
  })
  lessonNumber: number;

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
    type: 'text',
    nullable: true,
  })
  content: string | null;

  @Column({
    name: 'scheduled_date',
    type: 'date',
    nullable: true,
  })
  scheduledDate: string | null;

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

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.lessons, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @ManyToOne(() => Teacher, (teacher) => teacher.lessons, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher | null>;

  @OneToMany(() => Assignment, (assignment) => assignment.lesson)
  assignments: Relation<Assignment[]>;
}
