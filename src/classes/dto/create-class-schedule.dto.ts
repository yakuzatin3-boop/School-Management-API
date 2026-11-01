import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;

export class CreateClassScheduleDto {
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @Matches(TIME_PATTERN)
  startTime: string;

  @Matches(TIME_PATTERN)
  endTime: string;

  @IsOptional()
  @IsUUID()
  roomId?: string | null;
}