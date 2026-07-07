import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../users/types/authenticated-request.type';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  // 注入会话服务
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  getConversations(@Req() req: AuthenticatedRequest) {
    // 获取当前用户的所有会话
    return this.conversationsService.getConversations(req.user.userId);
  }

  @Get(':id')
  getConversation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    // 获取指定会话的详情和历史消息
    return this.conversationsService.getConversation(req.user.userId, Number(id));
  }

  @Post()
  createConversation(@Req() req: AuthenticatedRequest, @Body() createDto: CreateConversationDto) {
    // 创建新会话
    return this.conversationsService.createConversation(req.user.userId, createDto.title);
  }

  @Patch(':id')
  updateTitle(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateDto: UpdateConversationDto,
  ) {
    // 更新会话标题
    return this.conversationsService.updateTitle(req.user.userId, Number(id), updateDto.title);
  }

  @Delete(':id')
  async deleteConversation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    // 删除会话
    await this.conversationsService.deleteConversation(req.user.userId, Number(id));
    return { message: '删除成功' };
  }
}
