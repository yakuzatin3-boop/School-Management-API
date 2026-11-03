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

import { GradingService } from './grading.service.js';
import { CreateGradeScaleDto } from './dto/create-grade-scale.dto.js';
import { UpdateGradeScaleDto } from './dto/update-grade-scale.dto.js';
import { QueryGradeScalesDto } from './dto/query-grade-scales.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

@Controller({ path: 'grading/grade-scales', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeScalesController {
  constructor(private readonly gradingService: GradingService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateGradeScaleDto) {
    return this.gradingService.createGradeScale(dto);
  }

  @Get()
  findAll(@Query() query: QueryGradeScalesDto) {
    return this.gradingService.findGradeScales(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradingService.findGradeScale(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeScaleDto,
  ) {
    return this.gradingService.updateGradeScale(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradingService.removeGradeScale(id);
  }
}
