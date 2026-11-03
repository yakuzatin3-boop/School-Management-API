import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFloorDto {
  @IsUUID()
  buildingId: string;

  @Type(() => Number)
  @IsInt()
  floorNumber: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;
}
