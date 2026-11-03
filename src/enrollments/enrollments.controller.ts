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

import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto.js';

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

@Controller({
  path: 'enrollments',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // POST /enrollments
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.create(dto, this.getActor(request));
  }

  // GET /enrollments
  // GET /enrollments?studentId=...
  // GET /enrollments?classId=...
  // GET /enrollments?status=active
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryEnrollmentDto,
  ) {
    return this.enrollmentsService.findAll(query, this.getActor(request));
  }

  // GET /enrollments/student/:studentId
  @Get('student/:studentId')
  findByStudent(
    @Req() request: AuthenticatedRequest,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.enrollmentsService.findByStudent(
      studentId,
      this.getActor(request),
    );
  }

  // GET /enrollments/class/:classId
  @Get('class/:classId')
  findByClass(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.enrollmentsService.findByClass(classId, this.getActor(request));
  }

  // GET /enrollments/:id/history
  @Get(':id/history')
  findHistory(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.enrollmentsService.findHistory(id, this.getActor(request));
  }

  // GET /enrollments/:id
  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.enrollmentsService.findOne(id, this.getActor(request));
  }

  // PATCH /enrollments/:id
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, dto, this.getActor(request));
  }

  // DELETE /enrollments/:id
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.enrollmentsService.remove(id, this.getActor(request));
  }

  private getActor(request: AuthenticatedRequest): {
    userId: string;
    role: UserRole;
  } {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId || !request.user?.role) {
      throw new ForbiddenException('Invalid user identity');
    }

    return {
      userId,
      role: request.user.role,
    };
  }
}
