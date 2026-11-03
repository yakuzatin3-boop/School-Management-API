import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuditService } from './audit.service.js';
import { CreateAuditLogDto } from './dto/create-audit-log.dto.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

@Controller({ path: 'audit-logs', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // POST /audit-logs
  @Post()
  create(@Body() dto: CreateAuditLogDto) {
    return this.auditService.record(dto);
  }

  // GET /audit-logs
  @Get()
  findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditService.findAll(query);
  }

  // GET /audit-logs/stats
  @Get('stats')
  getStats() {
    return this.auditService.getStats();
  }

  // GET /audit-logs/:id
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.findOne(id);
  }

  // DELETE /audit-logs/:id
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.remove(id);
  }
}
