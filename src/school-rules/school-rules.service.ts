import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SchoolRule } from './entities/school-rule.entity/school-rule.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateSchoolRuleDto } from './dto/create-school-rule.dto.js';
import { UpdateSchoolRuleDto } from './dto/update-school-rule.dto.js';
import { QuerySchoolRulesDto } from './dto/query-school-rules.dto.js';

export interface SchoolRuleActor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class SchoolRulesService {
  constructor(
    @InjectRepository(SchoolRule)
    private readonly schoolRuleRepository: Repository<SchoolRule>,
  ) {}

  async create(dto: CreateSchoolRuleDto, actor: SchoolRuleActor) {
    const rule = this.schoolRuleRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      isActive: dto.isActive ?? true,
      createdByUser: { id: actor.userId } as User,
      updatedByUser: { id: actor.userId } as User,
    });

    if (!rule.title || !rule.content) {
      throw new BadRequestException(
        'School rule title and content are required',
      );
    }

    const saved = await this.schoolRuleRepository.save(rule);

    return this.toPublicRule(await this.getRuleEntity(saved.id));
  }

  async findAll(query: QuerySchoolRulesDto, actor: SchoolRuleActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.schoolRuleRepository
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.createdByUser', 'createdByUser')
      .leftJoinAndSelect('rule.updatedByUser', 'updatedByUser')
      .orderBy('rule.createdAt', 'DESC')
      .addOrderBy('rule.id', 'DESC');

    if (query.search?.trim()) {
      queryBuilder.andWhere(
        '(rule.title ILIKE :search OR rule.content ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('rule.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    // Non-admins only ever see active rules.
    if (actor.role !== UserRole.ADMIN) {
      queryBuilder.andWhere('rule.isActive = true');
    }

    queryBuilder.skip((page - 1) * limit).take(limit);

    const [rules, total] = await queryBuilder.getManyAndCount();

    return {
      data: rules.map((rule) => this.toPublicRule(rule)),
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

  async findOne(id: string, actor: SchoolRuleActor) {
    const rule = await this.getRuleEntity(id);

    if (actor.role !== UserRole.ADMIN && !rule.isActive) {
      throw new NotFoundException('School rule not found');
    }

    return this.toPublicRule(rule);
  }

  async update(id: string, dto: UpdateSchoolRuleDto, actor: SchoolRuleActor) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const rule = await this.getRuleEntity(id);

    if (dto.title !== undefined) {
      const title = dto.title.trim();

      if (!title) {
        throw new BadRequestException('School rule title cannot be empty');
      }

      rule.title = title;
    }

    if (dto.content !== undefined) {
      const content = dto.content.trim();

      if (!content) {
        throw new BadRequestException('School rule content cannot be empty');
      }

      rule.content = content;
    }

    if (dto.isActive !== undefined) {
      rule.isActive = dto.isActive;
    }

    rule.updatedByUser = { id: actor.userId } as User;

    await this.schoolRuleRepository.save(rule);

    return this.toPublicRule(await this.getRuleEntity(id));
  }

  async remove(id: string) {
    const rule = await this.getRuleEntity(id);

    await this.schoolRuleRepository.remove(rule);

    return { message: 'School rule deleted successfully' };
  }

  private async getRuleEntity(id: string) {
    const rule = await this.schoolRuleRepository.findOne({
      where: { id },
      relations: { createdByUser: true, updatedByUser: true },
    });

    if (!rule) {
      throw new NotFoundException('School rule not found');
    }

    return rule;
  }

  private toPublicRule(rule: SchoolRule) {
    return {
      id: rule.id,
      title: rule.title,
      content: rule.content,
      isActive: rule.isActive,
      createdBy: rule.createdByUser
        ? {
            id: rule.createdByUser.id,
            email: rule.createdByUser.email,
            role: rule.createdByUser.role,
          }
        : null,
      updatedBy: rule.updatedByUser
        ? {
            id: rule.updatedByUser.id,
            email: rule.updatedByUser.email,
            role: rule.updatedByUser.role,
          }
        : null,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
