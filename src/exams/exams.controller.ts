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

import { ExamsService } from './exams.service.js';
import { CreateExamAttemptDto } from './dto/create-exam-attempt.dto.js';
import { UpdateExamAttemptDto } from './dto/update-exam-attempt.dto.js';
import { SubmitExamAttemptDto } from './dto/submit-exam-attempt.dto.js';
import { QueryExamAttemptsDto } from './dto/query-exam-attempts.dto.js';
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

@Controller({ path: 'exams/attempts', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // POST /exams/attempts
  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateExamAttemptDto,
  ) {
    return this.examsService.create(dto, this.getActor(request));
  }

  // GET /exams/attempts
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryExamAttemptsDto,
  ) {
    return this.examsService.findAll(query, this.getActor(request));
  }

  // GET /exams/attempts/assignment/:assignmentId
  @Get('assignment/:assignmentId')
  findByAssignment(
    @Req() request: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.examsService.findByAssignment(
      assignmentId,
      this.getActor(request),
    );
  }

  // GET /exams/attempts/:id
  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.findOne(id, this.getActor(request));
  }

  // PATCH /exams/attempts/:id
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamAttemptDto,
  ) {
    return this.examsService.update(id, dto, this.getActor(request));
  }

  // POST /exams/attempts/:id/submit
  @Post(':id/submit')
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitExamAttemptDto,
  ) {
    return this.examsService.submit(id, dto, this.getActor(request));
  }

  // DELETE /exams/attempts/:id
  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examsService.remove(id, this.getActor(request));
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
