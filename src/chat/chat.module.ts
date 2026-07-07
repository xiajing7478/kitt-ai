import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [ConversationsModule],
  // controllers 用来声明当前模块对外暴露哪些 HTTP 接口。
  // ChatController 负责接收 /api/chat 请求，并把响应以 SSE 流返回给前端。
  controllers: [ChatController],

  // providers 用来声明当前模块内部可注入的业务服务。
  // ChatService 负责调用通义千问接口，控制器不直接关心第三方接口细节。
  providers: [ChatService],
})
export class ChatModule {}
