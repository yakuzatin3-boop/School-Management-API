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

import { GroupsService } from './groups.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { QueryGroupsDto } from './dto/query-groups.dto.js';
import { AddGroupMemberDto } from './dto/add-group-member.dto.js';
import { CreateGroupMessageDto } from './dto/create-group-message.dto.js';
import { QueryGroupMessagesDto } from './dto/query-group-messages.dto.js';
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

@Controller({ path: 'groups', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto, this.getActor(request));
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryGroupsDto,
  ) {
    return this.groupsService.findAll(query, this.getActor(request));
  }

  @Get('class/:classId')
  findByClass(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.groupsService.findByClass(classId, this.getActor(request));
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.findOne(id, this.getActor(request));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(id, dto, this.getActor(request));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.remove(id, this.getActor(request));
  }

  // MEMBERS

  @Post(':id/members')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  addMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(id, dto, this.getActor(request));
  }

  @Get(':id/members')
  findMembers(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groupsService.findMembers(id, this.getActor(request));
  }

  @Delete(':id/members/:memberId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.groupsService.removeMember(
      id,
      memberId,
      this.getActor(request),
    );
  }

  // MESSAGES

  @Post(':id/messages')
  createMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGroupMessageDto,
  ) {
    return this.groupsService.createMessage(id, dto, this.getActor(request));
  }

  @Get(':id/messages')
  findMessages(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryGroupMessagesDto,
  ) {
    return this.groupsService.findMessages(id, query, this.getActor(request));
  }

  @Delete(':id/messages/:messageId')
  removeMessage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.groupsService.removeMessage(
      id,
      messageId,
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
