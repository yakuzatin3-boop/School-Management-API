import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditLog } from './entities/audit-log.entity/audit-log.entity.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { CommonModule } from '../common/common.module.js';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([AuditLog, User])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
