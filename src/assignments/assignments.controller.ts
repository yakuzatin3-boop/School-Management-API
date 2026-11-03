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

import { AssignmentsService } from './assignments.service.js';
import { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import { UpdateAssignmentDto } from './dto/update-assignment.dto.js';
import { QueryAssignmentsDto } from './dto/query-assignment.dto.js';
import { CreateAssignmentAttachmentDto } from './dto/create-assignment-attachment.dto.js';
import { CreateAssignmentCommentDto } from './dto/create-assignment-comment.dto.js';
import { UpdateAssignmentCommentDto } from './dto/update-assignment-comment.dto.js';

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

@Controller({ path: 'assignments', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentsService.create(dto, this.getActor(request));
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryAssignmentsDto,
  ) {
    return this.assignmentsService.findAll(query, this.getActor(request));
  }

  @Get('class/:classId')
  findByClass(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.assignmentsService.findByClass(
      classId,
      this.getActor(request),
    );
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findOne(id, this.getActor(request));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.update(
      id,
      dto,
      this.getActor(request),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.remove(id, this.getActor(request));
  }

  // ATTACHMENTS

  @Post(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  addAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssignmentAttachmentDto,
  ) {
    return this.assignmentsService.addAttachment(
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
    return this.assignmentsService.findAttachments(
      id,
      this.getActor(request),
    );
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  removeAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.assignmentsService.removeAttachment(
      id,
      attachmentId,
      this.getActor(request),
    );
  }

  // COMMENTS

  @Post(':id/comments')
  createComment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssignmentCommentDto,
  ) {
    return this.assignmentsService.createComment(
      id,
      dto,
      this.getActor(request),
    );
  }

  @Get(':id/comments')
  findComments(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignmentsService.findComments(
      id,
      this.getActor(request),
    );
  }

  @Patch(':id/comments/:commentId')
  updateComment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateAssignmentCommentDto,
  ) {
    return this.assignmentsService.updateComment(
      id,
      commentId,
      dto,
      this.getActor(request),
    );
  }

  @Delete(':id/comments/:commentId')
  removeComment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.assignmentsService.removeComment(
      id,
      commentId,
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
