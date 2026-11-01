import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Announcement } from '../announcement.entity/announcement.entity.js';
import { User } from '../../../users/entities/user.entity/user.entity.js';

@Entity({ name: 'announcement_reads' })
@Unique('UQ_announcement_reads_announcement_user', ['announcement', 'user'])
@Index('IDX_announcement_reads_announcement_id', ['announcement'])
@Index('IDX_announcement_reads_user_id', ['user'])
export class AnnouncementRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({
    name: 'read_at',
    type: 'timestamptz',
  })
  readAt: Date;

  @ManyToOne(() => Announcement, (announcement) => announcement.reads, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'announcement_id' })
  announcement: Relation<Announcement>;

  @ManyToOne(() => User, (user) => user.announcementReads, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
}
