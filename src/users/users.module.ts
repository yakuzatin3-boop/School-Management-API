import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity/user.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CommonModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}