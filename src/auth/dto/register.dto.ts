import { PickType } from '@nestjs/mapped-types';

import { CreateUserDto } from '../../users/dto/create-user.dto.js';

export class RegisterDto extends PickType(CreateUserDto, [
  'email',
  'password',
] as const) {}
