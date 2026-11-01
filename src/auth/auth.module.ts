import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshToken } from './entities/refresh-token.entity/refresh-token.entity.js';
import { CommonModule } from '../common/common.module.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    UsersModule,
    TypeOrmModule.forFeature([User, Student, RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
