import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAuditLogDto {
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityType: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsObject()
  oldValues?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}
