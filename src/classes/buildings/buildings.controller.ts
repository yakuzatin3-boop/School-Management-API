import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { BuildingsService } from './buildings.service.js';
import { CreateBuildingDto } from './dto/create-building.dto.js';
import { UpdateBuildingDto } from './dto/update-building.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../users/entities/user.entity/user.entity.js';

@Controller({ path: 'buildings', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  findAll() {
    return this.buildingsService.findAll();
  }

  @Get(':buildingId')
  findOne(@Param('buildingId', ParseUUIDPipe) buildingId: string) {
    return this.buildingsService.findOne(buildingId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingsService.create(dto);
  }

  @Patch(':buildingId')
  @Roles(UserRole.ADMIN)
  update(
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildingsService.update(buildingId, dto);
  }

  @Delete(':buildingId')
  @Roles(UserRole.ADMIN)
  remove(@Param('buildingId', ParseUUIDPipe) buildingId: string) {
    return this.buildingsService.remove(buildingId);
  }
}
