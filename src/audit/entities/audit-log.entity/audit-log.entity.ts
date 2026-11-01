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
import { User } from '../../../users/entities/user.entity/user.entity.js';

@Entity({ name: 'audit_logs' })
@Index('IDX_audit_logs_actor_user_id', ['actorUser'])
@Index('IDX_audit_logs_entity', ['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  action: string;

  @Column({
    name: 'entity_type',
    type: 'varchar',
    length: 100,
  })
  entityType: string;

  @Column({
    name: 'entity_id',
    type: 'uuid',
    nullable: true,
  })
  entityId: string | null;

  @Column({
    name: 'old_values',
    type: 'jsonb',
    nullable: true,
  })
  oldValues: Record<string, unknown> | null;

  @Column({
    name: 'new_values',
    type: 'jsonb',
    nullable: true,
  })
  newValues: Record<string, unknown> | null;

  @Column({
    name: 'ip_address',
    type: 'inet',
    nullable: true,
  })
  ipAddress: string | null;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: Relation<User | null>;
}
