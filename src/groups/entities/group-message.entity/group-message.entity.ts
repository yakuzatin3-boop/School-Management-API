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
import { StudentGroup } from '../student-group.entity/student-group.entity.js';
import { User } from '../../../users/entities/user.entity/user.entity.js';

@Entity({ name: 'group_messages' })
@Index('IDX_group_messages_group_id', ['studentGroup'])
@Index('IDX_group_messages_sender_user_id', ['sender'])
export class GroupMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'text',
  })
  content: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @ManyToOne(() => StudentGroup, (group) => group.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  studentGroup: Relation<StudentGroup>;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'sender_user_id' })
  sender: Relation<User | null>;
}
