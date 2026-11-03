import { IsOptional, IsUUID } from 'class-validator';

export class ListRoomsQueryDto {
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @IsUUID()
  floorId?: string;
}
