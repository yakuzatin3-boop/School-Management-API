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
  type Relation,
} from 'typeorm';
import { Teacher } from '../teacher.entity/teacher.entity.js';
import { Course } from '../../../courses/entities/course.entity/course.entity.js';

export enum TeacherSkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

@Entity({ name: 'teacher_skills' })
@Unique('UQ_teacher_skills_teacher_course', ['teacher', 'course'])
@Index('IDX_teacher_skills_course_id', ['course'])
@Check(
  'CHK_teacher_skills_skill_level',
  `"skill_level" IN ('beginner', 'intermediate', 'advanced', 'expert')`,
)
@Check(
  'CHK_teacher_skills_years_experience',
  `"years_experience" IS NULL OR "years_experience" >= 0`,
)
export class TeacherSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'skill_level',
    type: 'varchar',
    length: 20,
    default: TeacherSkillLevel.INTERMEDIATE,
  })
  skillLevel: TeacherSkillLevel;

  @Column({
    name: 'years_experience',
    type: 'numeric',
    precision: 4,
    scale: 1,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | null) =>
        value === null ? null : Number(value),
    },
  })
  yearsExperience: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @ManyToOne(() => Teacher, (teacher) => teacher.teacherSkills, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher>;

  @ManyToOne(() => Course, (course) => course.teacherSkills, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'course_id' })
  course: Relation<Course>;
}
