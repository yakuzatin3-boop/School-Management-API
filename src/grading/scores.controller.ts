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

import { GradingService } from './grading.service.js';
import { CreateScoreDto } from './dto/create-score.dto.js';
import { UpdateScoreDto } from './dto/update-score.dto.js';
import { QueryScoresDto } from './dto/query-scores.dto.js';
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

@Controller({ path: 'grading/scores', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoresController {
  constructor(private readonly gradingService: GradingService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateScoreDto) {
    return this.gradingService.createScore(dto, this.getActor(request));
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryScoresDto,
  ) {
    return this.gradingService.findScores(query, this.getActor(request));
  }

  @Get('class/:classId')
  findByClass(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.gradingService.findByClass(classId, this.getActor(request));
  }

  @Get('submission/:submissionId')
  findBySubmission(
    @Req() request: AuthenticatedRequest,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.gradingService.findBySubmission(
      submissionId,
      this.getActor(request),
    );
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gradingService.findScore(id, this.getActor(request));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScoreDto,
  ) {
    return this.gradingService.updateScore(id, dto, this.getActor(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gradingService.removeScore(id, this.getActor(request));
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
