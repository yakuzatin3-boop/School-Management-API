import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { AttendanceStatus } from '../entities/attendance.entity/attendance.entity.js';

export class CreateAttendanceDto {
  @IsDateString()
  attendanceDate: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string | null;

  @IsUUID()
  enrollmentId: string;

  @IsOptional()
  @IsUUID()
  classScheduleId?: string | null;
}