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

import { AnnouncementsService } from './announcements.service.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto.js';
import { QueryAnnouncementsDto } from './dto/query-announcements.dto.js';
import { PublishAnnouncementDto } from './dto/publish-announcement.dto.js';

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
  path: 'announcements',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  // POST /announcements
  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(dto, this.getActor(request));
  }

  // GET /announcements
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryAnnouncementsDto,
  ) {
    return this.announcementsService.findAll(query, this.getActor(request));
  }

  // GET /announcements/unread-count
  @Get('unread-count')
  getUnreadCount(@Req() request: AuthenticatedRequest) {
    return this.announcementsService.getUnreadCount(this.getActor(request));
  }

  // GET /announcements/stats
  @Get('stats')
  @Roles(UserRole.ADMIN)
  getStats() {
    return this.announcementsService.getStats();
  }

  // GET /announcements/:id
  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementsService.findOne(id, this.getActor(request));
  }

  // PATCH /announcements/:id
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, dto, this.getActor(request));
  }

  // PATCH /announcements/:id/publish
  @Patch(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  publish(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishAnnouncementDto,
  ) {
    return this.announcementsService.publish(id, dto, this.getActor(request));
  }

  // PATCH /announcements/:id/unpublish
  @Patch(':id/unpublish')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  unpublish(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementsService.unpublish(id, this.getActor(request));
  }

  // POST /announcements/:id/read
  @Post(':id/read')
  markAsRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementsService.markAsRead(id, this.getActor(request));
  }

  // GET /announcements/:id/reads
  @Get(':id/reads')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  findReads(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementsService.findReads(id, this.getActor(request));
  }

  // DELETE /announcements/:id
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.announcementsService.remove(id, this.getActor(request));
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
