export class ChatMessageDto {
  // message 对应前端传来的用户输入内容，例如：{ "message": "你好" }。
  // 这里先保持 DTO 简单，不引入额外校验库；控制器会做基础的字符串校验。
  message!: string;
}
