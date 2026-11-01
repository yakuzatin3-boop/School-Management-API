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
import { Assignment } from '../assignment.entity/assignment.entity.js';

@Entity({ name: 'assignment_attachments' })
@Index('IDX_assignment_attachments_assignment_id', ['assignment'])
export class AssignmentAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'file_name',
    type: 'varchar',
    length: 255,
  })
  fileName: string;

  @Column({
    name: 'file_url',
    type: 'text',
  })
  fileUrl: string;

  @Column({
    name: 'mime_type',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  mimeType: string | null;

  @Column({
    name: 'file_size',
    type: 'bigint',
    nullable: true,
  })
  fileSize: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @ManyToOne(() => Assignment, (assignment) => assignment.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Relation<Assignment>;
}
