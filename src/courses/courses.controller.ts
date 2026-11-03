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

import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

@Controller({ path: 'courses', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':courseId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findOne(@Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.coursesService.findOne(courseId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Patch(':courseId')
  @Roles(UserRole.ADMIN)
  update(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(courseId, dto);
  }

  @Delete(':courseId')
  @Roles(UserRole.ADMIN)
  remove(@Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.coursesService.remove(courseId);
  }
}
