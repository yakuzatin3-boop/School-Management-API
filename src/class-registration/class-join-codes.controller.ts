import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ClassRegistrationService } from './class-registration.service.js';
import { CreateClassJoinCodeDto } from './dto/create-class-join-code.dto.js';
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
  path: 'classes/:classId/qr',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class ClassJoinCodesController {
  constructor(
    private readonly classRegistrationService: ClassRegistrationService,
  ) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateClassJoinCodeDto,
  ) {
    return this.classRegistrationService.createJoinCode(
      classId,
      this.getActor(request),
      dto,
    );
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classRegistrationService.findJoinCodes(
      classId,
      this.getActor(request),
    );
  }

  @Delete(':qrId')
  revoke(
    @Req() request: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('qrId', ParseUUIDPipe) qrId: string,
  ) {
    return this.classRegistrationService.revokeJoinCode(
      classId,
      qrId,
      this.getActor(request),
    );
  }

  private getActor(request: AuthenticatedRequest) {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Invalid user identity');
    }

    return {
      userId,
      role: request.user?.role,
    };
  }
}
