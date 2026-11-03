import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGroupMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
