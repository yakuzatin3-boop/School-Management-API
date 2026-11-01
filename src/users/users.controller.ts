
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserRole } from './entities/user.entity/user.entity.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

import { RolesGuard } from '../common/guards/roles.guard.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';

interface AuthenticatedRequest {
  user: {
    sub?: string;
    id?: string;
    role?: UserRole;
  };
}

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // Public registration: the service must assign STUDENT.
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // Only administrators can list all users.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // Administrators can view any user.
  // Other authenticated users can view only themselves.
@Get(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
async findOne(
  @Param('id', ParseUUIDPipe) id: string,
  @Req() request: AuthenticatedRequest,
) {
  console.log('========== USER DEBUG ==========');
  console.log('JWT Payload:', request.user);
  console.log('JWT ID:', request.user.id);
  console.log('JWT SUB:', request.user.sub);
  console.log('JWT ROLE:', request.user.role);
  console.log('URL ID:', id);
  console.log('================================');

  const currentUserId = request.user.sub ?? request.user.id;

console.log({
  currentUserId,
  requestedId: id,
  role: request.user.role,
  sameId: currentUserId === id,
  isAdmin: request.user.role === UserRole.ADMIN,
});

  if (!currentUserId) {
    throw new ForbiddenException('Invalid user identity');
  }

  if (
    request.user.role !== UserRole.ADMIN &&
    currentUserId !== id
  ) {
    throw new ForbiddenException('You cannot view this user');
  }

  return this.usersService.findOne(id);
}

  // Administrators can update any user.
  // Other authenticated users can update only themselves.
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const currentUserId = request.user.sub ?? request.user.id;

    if (!currentUserId) {
      throw new ForbiddenException('Invalid user identity');
    }

    if (
      request.user.role !== UserRole.ADMIN &&
      currentUserId !== id
    ) {
      throw new ForbiddenException('You cannot update this user');
    }

    return this.usersService.update(id, dto);
  }

@Patch(':id/role')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async updateRole(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateUserRoleDto,
) {
  return this.usersService.updateRole(id, dto.role);
}

  // Only administrators can deactivate accounts.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.deactivate(id);
  }
}
