import {
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

import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { User } from '../../../users/entities/user.entity/user.entity.js';

@Entity({ name: 'class_join_codes' })
@Unique('UQ_class_join_codes_token_hash', ['tokenHash'])
@Index('IDX_class_join_codes_class_id', ['schoolClass'])
@Index('IDX_class_join_codes_created_by_user_id', ['createdByUser'])
export class ClassJoinCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
  })
  tokenHash: string;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt: Date;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

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

  @ManyToOne(
    () => SchoolClass,
    (schoolClass) => schoolClass.joinCodes,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: Relation<User | null>;
}
