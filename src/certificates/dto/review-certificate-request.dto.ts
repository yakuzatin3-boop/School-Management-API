import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { CertificateRequestStatus } from './certificate-request-status.js';

export class ReviewCertificateRequestDto {
  @IsEnum(CertificateRequestStatus)
  status: CertificateRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reviewNotes?: string | null;
}
