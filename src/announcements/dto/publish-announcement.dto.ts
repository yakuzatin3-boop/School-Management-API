import { IsBoolean, IsOptional } from 'class-validator';

export class PublishAnnouncementDto {
  /**
   * Send in-app notifications to the target audience.
   * Defaults to true.
   */
  @IsOptional()
  @IsBoolean()
  notifyUsers?: boolean;
}
