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

import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/create-submission.dto.js';
import { UpdateSubmissionDto } from './dto/update-submission.dto.js';
import { QuerySubmissionsDto } from './dto/query-submission.dto.js';
import { CreateSubmissionAttachmentDto } from './dto/create-submission-attachment.dto.js';

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

@Controller({ path: 'submissions', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionsService.create(dto, this.getActor(request));
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QuerySubmissionsDto,
  ) {
    return this.submissionsService.findAll(query, this.getActor(request));
  }

  @Get('assignment/:assignmentId')
  findByAssignment(
    @Req() request: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.submissionsService.findByAssignment(
      assignmentId,
      this.getActor(request),
    );
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionsService.findOne(id, this.getActor(request));
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.submissionsService.update(id, dto, this.getActor(request));
  }

  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionsService.remove(id, this.getActor(request));
  }

  // ATTACHMENTS

  @Post(':id/attachments')
  @Roles(UserRole.STUDENT, UserRole.ADMIN)
  addAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubmissionAttachmentDto,
  ) {
    return this.submissionsService.addAttachment(
      id,
      dto,
      this.getActor(request),
    );
  }

  @Get(':id/attachments')
  findAttachments(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.submissionsService.findAttachments(
      id,
      this.getActor(request),
    );
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(UserRole.STUDENT, UserRole.ADMIN)
  removeAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.submissionsService.removeAttachment(
      id,
      attachmentId,
      this.getActor(request),
    );
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
