import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { SchoolClass } from '../school-class.entity/school-class.entity.js';
import { Room } from '../room.entity/room.entity.js';

@Entity({ name: 'class_schedules' })
@Check('CHK_class_schedules_day_of_week', '"day_of_week" BETWEEN 1 AND 7')
@Check(
  'CHK_class_schedules_time_range',
  '"end_time" > "start_time"',
)
@Index('IDX_class_schedules_class_id', ['schoolClass'])
@Index('IDX_class_schedules_room_id', ['room'])
export class ClassSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'day_of_week',
    type: 'smallint',
  })
  dayOfWeek: number;

  @Column({
    name: 'start_time',
    type: 'time',
  })
  startTime: string;

  @Column({
    name: 'end_time',
    type: 'time',
  })
  endTime: string;

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

  @ManyToOne(() => SchoolClass, (schoolClass) => schoolClass.schedules, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  schoolClass: Relation<SchoolClass>;

  @ManyToOne(() => Room, (room) => room.schedules, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'room_id' })
  room: Relation<Room | null>;
}
