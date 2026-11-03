import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCertificateRequestDto {
  @IsUUID()
  classId: string;

  /**
   * Students request certificates for themselves. Teachers and
   * administrators must provide the student id.
   */
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
