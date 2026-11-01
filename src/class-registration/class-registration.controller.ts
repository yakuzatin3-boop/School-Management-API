import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ClassRegistrationService } from './class-registration.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

interface AuthenticatedRequest {
  user?: {
    sub?: string;
    id?: string;
    role?: UserRole;
  };
}

@Controller({
  path: 'class-registration',
  version: '1',
})
export class ClassRegistrationController {
  constructor(
    private readonly classRegistrationService: ClassRegistrationService,
  ) {}

  @Get(':token')
  validate(@Param('token') token: string) {
    return this.classRegistrationService.validateInvitation(token);
  }

  @Post(':token/join')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  join(
    @Req() request: AuthenticatedRequest,
    @Param('token') token: string,
  ) {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Invalid user identity');
    }

    return this.classRegistrationService.joinClass(token, userId);
  }
}
