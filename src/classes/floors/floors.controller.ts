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

import { FloorsService } from './floors.service.js';
import { CreateFloorDto } from './dto/create-floor.dto.js';
import { UpdateFloorDto } from './dto/update-floor.dto.js';
import { ListFloorsQueryDto } from './dto/list-floors-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../users/entities/user.entity/user.entity.js';

@Controller({ path: 'floors', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  findAll(@Query() query: ListFloorsQueryDto) {
    return this.floorsService.findAll(query);
  }

  @Get(':floorId')
  findOne(@Param('floorId', ParseUUIDPipe) floorId: string) {
    return this.floorsService.findOne(floorId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateFloorDto) {
    return this.floorsService.create(dto);
  }

  @Patch(':floorId')
  @Roles(UserRole.ADMIN)
  update(
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.floorsService.update(floorId, dto);
  }

  @Delete(':floorId')
  @Roles(UserRole.ADMIN)
  remove(@Param('floorId', ParseUUIDPipe) floorId: string) {
    return this.floorsService.remove(floorId);
  }
}
