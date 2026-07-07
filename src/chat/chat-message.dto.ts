import { IsString, MinLength } from 'class-validator';

export class ChatMessageDto {
  @IsString({ message: '消息必须是字符串' })
  @MinLength(1, { message: '消息不能为空' })
  message!: string;
}
