
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';

import { TeachersService } from './teachers.service.js';
import { CreateTeacherDto } from './dto/create-teacher.dto.js';
import { UpdateTeacherDto } from './dto/update-teacher.dto.js';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto.js';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto.js';
import { CreateTeacherSkillDto } from './dto/create-teacher-skill.dto.js';
import { UpdateTeacherSkillDto } from './dto/update-teacher-skill.dto.js';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

interface AuthenticatedRequest {
  user?: {
    sub?: string;
    id?: string;
  };
}

@Controller({
  path: 'teachers',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  private getUserId(request: AuthenticatedRequest) {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Invalid user identity');
    }

    return userId;
  }

  // CREATE TEACHER
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  // CREATE OWN TEACHER PROFILE FOR AN EXISTING ACCOUNT
  @Post('me')
  @Roles(UserRole.TEACHER)
  createProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTeacherProfileDto,
  ) {
    return this.teachersService.createProfile(
      this.getUserId(request),
      dto,
    );
  }

  // GET ALL TEACHERS
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.teachersService.findAll();
  }

  // GET OWN TEACHER PROFILE
  @Get('me')
  @Roles(UserRole.TEACHER)
  findProfile(@Req() request: AuthenticatedRequest) {
    return this.teachersService.findProfile(this.getUserId(request));
  }

  // UPDATE OWN TEACHER PROFILE
  @Patch('me')
  @Roles(UserRole.TEACHER)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateTeacherProfileDto,
  ) {
    return this.teachersService.updateProfile(
      this.getUserId(request),
      dto,
    );
  }

  // GET TEACHER BY ID
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.findOne(id);
  }

  // UPDATE TEACHER
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.update(id, dto);
  }

  // GET TEACHER SKILLS
  @Get(':id/skills')
  @Roles(UserRole.ADMIN)
  findSkills(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.findSkills(id);
  }

  // ADD TEACHER SKILL
  @Post(':id/skills')
  @Roles(UserRole.ADMIN)
  addSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeacherSkillDto,
  ) {
    return this.teachersService.addSkill(id, dto);
  }

  // UPDATE TEACHER SKILL
  @Patch(':id/skills/:skillId')
  @Roles(UserRole.ADMIN)
  updateSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Body() dto: UpdateTeacherSkillDto,
  ) {
    return this.teachersService.updateSkill(id, skillId, dto);
  }

  // REMOVE TEACHER SKILL
  @Delete(':id/skills/:skillId')
  @Roles(UserRole.ADMIN)
  removeSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ) {
    return this.teachersService.removeSkill(id, skillId);
  }

  // ACTIVATE TEACHER
  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.activate(id);
  }

  // DEACTIVATE TEACHER
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivateTeacher(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.deactivate(id);
  }

  // DEACTIVATE TEACHER (LEGACY)
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.deactivate(id);
  }
}
