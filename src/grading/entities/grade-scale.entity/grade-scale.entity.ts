import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Score } from '../score.entity/score.entity.js';

@Entity({ name: 'grade_scales' })
@Unique('UQ_grade_scales_name_label', ['name', 'label'])
@Check('CHK_grade_scales_range', '"min_score" <= "max_score"')
@Index('IDX_grade_scales_name', ['name'])
export class GradeScale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  label: string;

  @Column({
    name: 'min_score',
    type: 'numeric',
    precision: 6,
    scale: 2,
  })
  minScore: number;

  @Column({
    name: 'max_score',
    type: 'numeric',
    precision: 6,
    scale: 2,
  })
  maxScore: number;

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

  @OneToMany(() => Score, (score) => score.gradeScale)
  scores: Relation<Score[]>;
}
