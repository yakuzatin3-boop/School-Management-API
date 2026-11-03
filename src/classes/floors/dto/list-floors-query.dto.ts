import { IsOptional, IsUUID } from 'class-validator';

export class ListFloorsQueryDto {
  @IsOptional()
  @IsUUID()
  buildingId?: string;
}
