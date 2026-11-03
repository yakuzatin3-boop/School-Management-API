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
} from '@nestjs/common';

import { AttendanceService } from './attendance.service.js';

import { CreateAttendanceDto } from './dto/create-attendance.dto.js';

import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';

import { QueryAttendanceDto } from './dto/query-attendance.dto.js';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
  ) {}

  // POST /attendance
  @Post()
  create(
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.create(createAttendanceDto);
  }

  // GET /attendance
  // GET /attendance?status=present
  // GET /attendance?attendanceDate=2026-11-02
  @Get()
  findAll(
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.findAll(query);
  }

  // GET /attendance/enrollment/:enrollmentId
  @Get('enrollment/:enrollmentId')
  findByEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.attendanceService.findByEnrollment(enrollmentId);
  }

  // GET /attendance/class-schedule/:classScheduleId
  @Get('class-schedule/:classScheduleId')
  findByClassSchedule(
    @Param('classScheduleId', ParseUUIDPipe)
    classScheduleId: string,
  ) {
    return this.attendanceService.findByClassSchedule(
      classScheduleId,
    );
  }

  // GET /attendance/:id
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendanceService.findOne(id);
  }

  // PATCH /attendance/:id
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(
      id,
      updateAttendanceDto,
    );
  }

  // DELETE /attendance/:id
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendanceService.remove(id);
  }
}