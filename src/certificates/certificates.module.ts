import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CertificatesController } from './certificates.controller.js';
import { CertificatesService } from './certificates.service.js';
import { Certificate } from './entities/certificate.entity/certificate.entity.js';
import { CertificateRequest } from './entities/certificate-request.entity/certificate-request.entity.js';
import { CommonModule } from '../common/common.module.js';
import { AcademicAccessModule } from '../common/academic-access/academic-access.module.js';

@Module({
  imports: [
    CommonModule,
    AcademicAccessModule,
    TypeOrmModule.forFeature([Certificate, CertificateRequest]),
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
