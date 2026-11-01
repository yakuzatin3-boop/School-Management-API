import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Enrollment } from '../enrollment.entity/enrollment.entity.js';
import { User } from '../../../users/entities/user.entity/user.entity.js';

@Entity({ name: 'enrollment_status_history' })
@Index('IDX_enrollment_status_history_enrollment_id', ['enrollment'])
@Index('IDX_enrollment_status_history_changed_by_user_id', ['changedByUser'])
export class EnrollmentStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'old_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  oldStatus: string | null;

  @Column({
    name: 'new_status',
    type: 'varchar',
    length: 20,
  })
  newStatus: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  reason: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.statusHistory, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Relation<Enrollment>;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser: Relation<User | null>;
}
