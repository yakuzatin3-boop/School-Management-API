import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { AuditLog } from './entities/audit-log.entity/audit-log.entity.js';
import { User } from '../users/entities/user.entity/user.entity.js';
import { CreateAuditLogDto } from './dto/create-audit-log.dto.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Persist an audit trail entry. Other modules can inject AuditService
   * and call this after mutating sensitive records.
   */
  async record(dto: CreateAuditLogDto) {
    let actorUser: User | null = null;

    if (dto.actorUserId) {
      actorUser = await this.userRepository.findOne({
        where: { id: dto.actorUserId },
      });
    }

    const auditLog = this.auditLogRepository.create({
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      oldValues: dto.oldValues ?? null,
      newValues: dto.newValues ?? null,
      ipAddress: dto.ipAddress ?? null,
      userAgent: dto.userAgent ?? null,
      actorUser,
    });

    const saved = await this.auditLogRepository.save(auditLog);

    return this.toPublicAuditLog(saved);
  }

  async findAll(query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: FindOptionsWhere<AuditLog> = {};

    if (query.actorUserId) {
      where.actorUser = { id: query.actorUserId };
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);

      if (from > to) {
        throw new BadRequestException('from must be before to');
      }

      where.createdAt = Between(from, to);
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(new Date(query.to));
    }

    const [logs, total] = await this.auditLogRepository.findAndCount({
      where,
      relations: { actorUser: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: logs.map((log) => this.toPublicAuditLog(log)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const log = await this.auditLogRepository.findOne({
      where: { id },
      relations: { actorUser: true },
    });

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    return this.toPublicAuditLog(log);
  }

  async getStats() {
    const [total, actions, entityTypes] = await Promise.all([
      this.auditLogRepository.count(),
      this.auditLogRepository
        .createQueryBuilder('log')
        .select('log.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.action')
        .orderBy('count', 'DESC')
        .getRawMany<{ action: string; count: string }>(),
      this.auditLogRepository
        .createQueryBuilder('log')
        .select('log.entity_type', 'entityType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.entity_type')
        .orderBy('count', 'DESC')
        .getRawMany<{ entityType: string; count: string }>(),
    ]);

    return {
      total,
      byAction: actions.map((row) => ({
        action: row.action,
        count: Number(row.count),
      })),
      byEntityType: entityTypes.map((row) => ({
        entityType: row.entityType,
        count: Number(row.count),
      })),
    };
  }

  async remove(id: string) {
    const log = await this.auditLogRepository.findOneBy({ id });

    if (!log) {
      throw new NotFoundException('Audit log not found');
    }

    await this.auditLogRepository.remove(log);

    return { message: 'Audit log deleted successfully' };
  }

  private toPublicAuditLog(log: AuditLog) {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldValues: log.oldValues,
      newValues: log.newValues,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      actor: log.actorUser
        ? {
            id: log.actorUser.id,
            email: log.actorUser.email,
            role: log.actorUser.role,
          }
        : null,
      createdAt: log.createdAt,
    };
  }
}
