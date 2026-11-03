import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateFloorDto {
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floorNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;
}
