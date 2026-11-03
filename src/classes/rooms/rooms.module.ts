import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoomsService } from './rooms.service.js';
import { RoomsController } from './rooms.controller.js';
import { Room } from '../entities/room.entity/room.entity.js';
import { Building } from '../entities/building.entity/building.entity.js';
import { Floor } from '../entities/floor.entity/floor.entity.js';
import { CommonModule } from '../../common/common.module.js';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([Room, Building, Floor]),
  ],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
