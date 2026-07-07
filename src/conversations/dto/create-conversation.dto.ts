import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 创建会话的 DTO */
export class CreateConversationDto {
  /** 会话标题，可选，建议限制长度不超过 200 字符 */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
