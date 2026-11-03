import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BuildingsService } from './buildings.service.js';
import { BuildingsController } from './buildings.controller.js';
import { Building } from '../entities/building.entity/building.entity.js';
import { CommonModule } from '../../common/common.module.js';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([Building])],
  providers: [BuildingsService],
  controllers: [BuildingsController],
  exports: [BuildingsService],
})
export class BuildingsModule {}
