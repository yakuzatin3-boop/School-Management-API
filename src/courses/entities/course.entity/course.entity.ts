import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { TeacherSkill } from '../../../teachers/entities/teacher-skill.entity/teacher-skill.entity.js';
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';

@Entity({ name: 'courses' })
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

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

  @OneToMany(() => TeacherSkill, (skill) => skill.course)
  teacherSkills: Relation<TeacherSkill[]>;

  @OneToMany(() => SchoolClass, (schoolClass) => schoolClass.course)
  classes: Relation<SchoolClass[]>;
}
