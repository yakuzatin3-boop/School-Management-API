import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FloorsService } from './floors.service.js';
import { FloorsController } from './floors.controller.js';
import { Floor } from '../entities/floor.entity/floor.entity.js';
import { Building } from '../entities/building.entity/building.entity.js';
import { CommonModule } from '../../common/common.module.js';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([Floor, Building])],
  providers: [FloorsService],
  controllers: [FloorsController],
  exports: [FloorsService],
})
export class FloorsModule {}
