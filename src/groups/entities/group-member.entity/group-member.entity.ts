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
import { StudentGroup } from '../student-group.entity/student-group.entity.js';
import { Enrollment } from '../../../enrollments/entities/enrollment.entity/enrollment.entity.js';

@Entity({ name: 'group_members' })
@Unique('UQ_group_members_group_enrollment', ['studentGroup', 'enrollment'])
@Index('IDX_group_members_group_id', ['studentGroup'])
@Index('IDX_group_members_enrollment_id', ['enrollment'])
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({
    name: 'joined_at',
    type: 'timestamptz',
  })
  joinedAt: Date;

  @ManyToOne(() => StudentGroup, (group) => group.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  studentGroup: Relation<StudentGroup>;

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.groupMembers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Relation<Enrollment>;
}
