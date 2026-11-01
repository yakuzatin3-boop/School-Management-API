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
  Req,
  UseGuards,
} from '@nestjs/common';

import { StudentsService } from './students.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto.js';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto.js';
import { EnrollStudentDto } from './dto/enroll-student.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { CreateScoreDto } from './dto/create-score.dto.js';

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
  path: 'students',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  private getUserId(request: AuthenticatedRequest) {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Invalid user identity');
    }

    return userId;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Post('me')
  @Roles(UserRole.STUDENT)
  createProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStudentProfileDto,
  ) {
    return this.studentsService.createProfile(
      this.getUserId(request),
      dto,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.studentsService.findAll();
  }

  @Get('me')
  @Roles(UserRole.STUDENT)
  findProfile(@Req() request: AuthenticatedRequest) {
    return this.studentsService.findProfile(
      this.getUserId(request),
    );
  }

  @Patch('me')
  @Roles(UserRole.STUDENT)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.studentsService.updateProfile(
      this.getUserId(request),
      dto,
    );
  }

  @Get('me/enrollments')
  @Roles(UserRole.STUDENT)
  async findMyEnrollments(@Req() request: AuthenticatedRequest) {
    const profile = await this.studentsService.findProfile(
      this.getUserId(request),
    );

    return this.studentsService.findEnrollments(profile.id);
  }

  @Get('me/attendance')
  @Roles(UserRole.STUDENT)
  async findMyAttendance(@Req() request: AuthenticatedRequest) {
    const profile = await this.studentsService.findProfile(
      this.getUserId(request),
    );

    return this.studentsService.findAttendance(profile.id);
  }

  @Get('me/scores')
  @Roles(UserRole.STUDENT)
  async findMyScores(@Req() request: AuthenticatedRequest) {
    const profile = await this.studentsService.findProfile(
      this.getUserId(request),
    );

    return this.studentsService.findScores(profile.id);
  }

  @Get('me/academic-history')
  @Roles(UserRole.STUDENT)
  async findMyAcademicHistory(
    @Req() request: AuthenticatedRequest,
  ) {
    const profile = await this.studentsService.findProfile(
      this.getUserId(request),
    );

    return this.studentsService.getAcademicHistory(profile.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.remove(id);
  }

  @Post(':id/enrollments')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  enroll(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollStudentDto,
  ) {
    return this.studentsService.enroll(
      id,
      dto,
      this.getUserId(request),
      request.user?.role,
    );
  }

  @Get(':id/enrollments')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  findEnrollments(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findEnrollments(id);
  }

  @Patch(':id/enrollments/:enrollmentId')
  @Roles(UserRole.ADMIN)
  updateEnrollment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
  ) {
    return this.studentsService.updateEnrollment(
      id,
      enrollmentId,
      dto,
      this.getUserId(request),
    );
  }

  @Post(':id/attendance')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  recordAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.studentsService.recordAttendance(id, dto);
  }

  @Get(':id/attendance')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  findAttendance(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findAttendance(id);
  }

  @Post(':id/scores')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  recordScore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateScoreDto,
  ) {
    return this.studentsService.recordScore(id, dto);
  }

  @Get(':id/scores')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  findScores(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findScores(id);
  }

  @Get(':id/academic-history')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  getAcademicHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.getAcademicHistory(id);
  }

  @Post(':id/graduate')
  @Roles(UserRole.ADMIN)
  graduate(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.graduate(id);
  }
}
