import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SchoolRulesService } from './school-rules.service.js';
import { CreateSchoolRuleDto } from './dto/create-school-rule.dto.js';
import { UpdateSchoolRuleDto } from './dto/update-school-rule.dto.js';
import { QuerySchoolRulesDto } from './dto/query-school-rules.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

interface AuthenticatedRequest {
  user?: {
    sub?: string;
    id?: string;
    role?: UserRole;
  };
}

@Controller({ path: 'school-rules', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolRulesController {
  constructor(private readonly schoolRulesService: SchoolRulesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSchoolRuleDto,
  ) {
    return this.schoolRulesService.create(dto, this.getActor(request));
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QuerySchoolRulesDto,
  ) {
    return this.schoolRulesService.findAll(query, this.getActor(request));
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schoolRulesService.findOne(id, this.getActor(request));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolRuleDto,
  ) {
    return this.schoolRulesService.update(id, dto, this.getActor(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schoolRulesService.remove(id);
  }

  private getActor(request: AuthenticatedRequest): {
    userId: string;
    role: UserRole;
  } {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId || !request.user?.role) {
      throw new ForbiddenException('Invalid user identity');
    }

    return { userId, role: request.user.role };
  }
}
