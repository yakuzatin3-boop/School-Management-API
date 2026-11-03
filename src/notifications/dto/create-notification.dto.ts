import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const NOTIFICATION_TYPES = [
  'info',
  'success',
  'warning',
  'error',
  'announcement',
  'assignment',
  'grade',
  'attendance',
  'enrollment',
  'certificate',
] as const;

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: string;
}
