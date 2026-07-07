import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [DatabaseModule],
  // 会话控制器，提供会话管理的 HTTP 接口
  controllers: [ConversationsController],
  // 会话服务，实现会话相关的业务逻辑
  providers: [ConversationsService],
  // 导出会话服务，供聊天模块使用
  exports: [ConversationsService],
})
export class ConversationsModule {}
