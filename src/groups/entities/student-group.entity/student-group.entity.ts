import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { SchoolClass } from '../../../classes/entities/school-class.entity/school-class.entity.js';
import { GroupMember } from '../group-member.entity/group-member.entity.js';
import { GroupMessage } from '../group-message.entity/group-message.entity.js';
import { Submission } from '../../../submissions/entities/submission.entity/submission.entity.js';

@Entity({ name: 'student_groups' })
@Unique('UQ_student_groups_class_name', ['schoolClass', 'name'])
@Index('IDX_student_groups_class_id', ['schoolClass'])
export class StudentGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
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

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.studentGroups, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @OneToMany(() => GroupMember, (member) => member.studentGroup)
  members: Relation<GroupMember[]>;

  @OneToMany(() => GroupMessage, (message) => message.studentGroup)
  messages: Relation<GroupMessage[]>;

  @OneToMany(() => Submission, (submission) => submission.studentGroup)
  submissions: Relation<Submission[]>;
}
