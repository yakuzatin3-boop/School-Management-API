import {
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
import { User } from '../../../users/entities/user.entity/user.entity.js';
import { AnnouncementRead } from '../announcement-read.entity/announcement-read.entity.js';

@Entity({ name: 'announcements' })
@Index('IDX_announcements_created_by_user_id', ['createdByUser'])
@Index('IDX_announcements_is_published', ['isPublished'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title: string;

  @Column({
    type: 'text',
  })
  content: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'all',
  })
  audience: string;

  @Column({
    name: 'is_published',
    type: 'boolean',
    default: false,
  })
  isPublished: boolean;

  @Column({
    name: 'published_at',
    type: 'timestamptz',
    nullable: true,
  })
  publishedAt: Date | null;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt: Date | null;

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

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: Relation<User | null>;

  @OneToMany(() => AnnouncementRead, (read) => read.announcement)
  reads: Relation<AnnouncementRead[]>;
}
