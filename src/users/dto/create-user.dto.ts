import { UserRole } from '../entities/user.entity/user.entity.js';

import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
export class CreateUserDto {
  @IsEmail()
  @MaxLength(150)
  email: string;

  @IsString()
  @Length(8, 72)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
