import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RoomsService } from './rooms.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../users/entities/user.entity/user.entity.js';

@Controller({ path: 'rooms', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll(@Query() query: ListRoomsQueryDto) {
    return this.roomsService.findAll(query);
  }

  @Get(':roomId')
  findOne(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.roomsService.findOne(roomId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Patch(':roomId')
  @Roles(UserRole.ADMIN)
  update(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(roomId, dto);
  }

  @Delete(':roomId')
  @Roles(UserRole.ADMIN)
  remove(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.roomsService.remove(roomId);
  }
}
