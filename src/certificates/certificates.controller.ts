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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CertificatesService } from './certificates.service.js';
import { CreateCertificateRequestDto } from './dto/create-certificate-request.dto.js';
import { ReviewCertificateRequestDto } from './dto/review-certificate-request.dto.js';
import { QueryCertificateRequestsDto } from './dto/query-certificate-requests.dto.js';
import { QueryCertificatesDto } from './dto/query-certificates.dto.js';
import { UpdateCertificateDto } from './dto/update-certificate.dto.js';
import { IssueCertificateDto } from './dto/issue-certificate.dto.js';
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

@Controller({ path: 'certificates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  // REQUESTS

  @Post('requests')
  createRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCertificateRequestDto,
  ) {
    return this.certificatesService.createRequest(dto, this.getActor(request));
  }

  @Get('requests')
  findAllRequests(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryCertificateRequestsDto,
  ) {
    return this.certificatesService.findAllRequests(
      query,
      this.getActor(request),
    );
  }

  @Get('requests/:id')
  findRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.findRequest(id, this.getActor(request));
  }

  @Patch('requests/:id/review')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  reviewRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewCertificateRequestDto,
  ) {
    return this.certificatesService.reviewRequest(
      id,
      dto,
      this.getActor(request),
    );
  }

  @Post('requests/:id/issue')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  issueCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueCertificateDto,
  ) {
    return this.certificatesService.issueCertificate(
      id,
      dto,
      this.getActor(request),
    );
  }

  @Delete('requests/:id')
  removeRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.removeRequest(id, this.getActor(request));
  }

  // CERTIFICATES

  @Get()
  findAllCertificates(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryCertificatesDto,
  ) {
    return this.certificatesService.findAllCertificates(
      query,
      this.getActor(request),
    );
  }

  @Get(':id')
  findCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.findCertificate(id, this.getActor(request));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  updateCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateDto,
  ) {
    return this.certificatesService.updateCertificate(
      id,
      dto,
      this.getActor(request),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  removeCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.certificatesService.removeCertificate(
      id,
      this.getActor(request),
    );
  }

  private getActor(request: AuthenticatedRequest): {
    userId: string;
    role: UserRole;
  } {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId || !request.user?.role) {
      throw new ForbiddenException('Invalid user identity');
    }

    return { userId, role: request.user.role };
  }
}
