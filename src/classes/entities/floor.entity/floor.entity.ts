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
import { Room } from '../room.entity/room.entity.js';

@Entity({ name: 'floors' })
@Unique('UQ_floors_building_floor_number', ['building', 'floorNumber'])
@Index('IDX_floors_building_id', ['building'])
export class Floor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'floor_number',
    type: 'integer',
  })
  floorNumber: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  name: string | null;

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

  @ManyToOne(() => Building, (building) => building.floors, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'building_id' })
  building: Relation<Building>;

  @OneToMany(() => Room, (room) => room.floor)
  rooms: Relation<Room[]>;
}
