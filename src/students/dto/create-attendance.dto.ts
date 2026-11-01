import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { AttendanceStatus } from '../../attendance/entities/attendance.entity/attendance.entity.js';

export class CreateAttendanceDto {
  @IsUUID()
  enrollmentId: string;

  @IsOptional()
  @IsUUID()
  classScheduleId?: string;

  @IsDateString()
  attendanceDate: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
