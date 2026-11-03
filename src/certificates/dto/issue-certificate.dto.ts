import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueCertificateDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fileUrl?: string | null;
}
