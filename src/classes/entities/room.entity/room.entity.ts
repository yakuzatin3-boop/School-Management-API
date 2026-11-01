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
import { Building } from '../building.entity/building.entity.js';
import { Floor } from '../floor.entity/floor.entity.js';
import { ClassSchedule } from '../class-schedule.entity/class-schedule.entity.js';

@Entity({ name: 'rooms' })
@Unique('UQ_rooms_building_room_code', ['building', 'roomCode'])
@Index('IDX_rooms_building_id', ['building'])
@Index('IDX_rooms_floor_id', ['floor'])
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'room_code',
    type: 'varchar',
    length: 30,
  })
  roomCode: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  name: string | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  capacity: number | null;

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

  @ManyToOne(() => Building, (building) => building.rooms, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'building_id' })
  building: Relation<Building>;

  @ManyToOne(() => Floor, (floor) => floor.rooms, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'floor_id' })
  floor: Relation<Floor>;

  @OneToMany(() => ClassSchedule, (schedule) => schedule.room)
  schedules: Relation<ClassSchedule[]>;
}
