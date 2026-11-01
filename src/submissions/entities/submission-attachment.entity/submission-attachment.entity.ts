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
import { Submission } from '../submission.entity/submission.entity.js';

@Entity({ name: 'submission_attachments' })
@Index('IDX_submission_attachments_submission_id', ['submission'])
export class SubmissionAttachment {
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

  @ManyToOne(() => Submission, (submission) => submission.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'submission_id' })
  submission: Relation<Submission>;
}
