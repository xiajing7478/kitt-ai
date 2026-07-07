import { BadRequestException, Body, Controller, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../users/types/authenticated-request.type';
import { ChatMessageDto } from './chat-message.dto';
import { ChatService } from './chat.service';

@Controller('api')
export class ChatController {
  // NestJS 会通过构造函数自动注入 ChatService。
  // 控制器只处理 HTTP 层逻辑，真正调用 AI 的业务逻辑放在 service 中，方便后续维护和测试。
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async streamChat(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChatMessageDto,
    @Res() res: Response,
  ) {
    // 保留原 Express 版本的接口格式：前端 POST /api/chat，并在 body 中传入 message。
    // 如果 message 为空，直接返回 400，避免把无效请求转发给通义千问。
    if (!body?.message || typeof body.message !== 'string') {
      throw new BadRequestException('message 不能为空');
    }

    // SSE（Server-Sent Events）要求响应头使用 text/event-stream。
    // 这样前端可以持续接收服务端逐步写入的内容，而不是等待整个 AI 回复完成。
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      // ChatService 内部会把通义千问返回的流转换成一个异步迭代器。
      // for await...of 可以像读取数组一样逐段读取流式文本，每拿到一段就立刻写给前端。
      for await (const text of this.chatService.streamWithPersistence(
        req.user.userId,
        undefined,
        body.message,
      )) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      // 前端通常会用 [DONE] 判断 SSE 流已经结束。
      res.write('data: [DONE]\n\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 请求失败';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  async streamToConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() body: ChatMessageDto,
    @Res() res: Response,
  ) {
    // 在指定会话中发送消息，复用原有流式处理逻辑
    if (!body?.message || typeof body.message !== 'string') {
      throw new BadRequestException('message 不能为空');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    try {
      for await (const text of this.chatService.streamWithPersistence(
        req.user.userId,
        Number(conversationId),
        body.message,
      )) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 请求失败';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }
}
