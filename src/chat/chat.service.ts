import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Readable } from 'stream';
import { ConversationsService } from '../conversations/conversations.service';

type DashScopeStreamChunk = {
  output?: {
    text?: string;
  };
};

@Injectable()
export class ChatService {
  private readonly apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  // ConfigService 来自 @nestjs/config，会自动读取 .env 和 process.env 中的环境变量。
  // 这里用它读取 DASHSCOPE_API_KEY，避免把密钥写死在代码仓库里。
  constructor(
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async *streamChat(message: string): AsyncGenerator<string> {
    // 保留原有接口，调用内部方法实现
    return yield* this.streamFromDashScope([{ role: 'user', content: message }]);
  }

  async *streamWithPersistence(
    userId: number,
    conversationId: number | undefined,
    userContent: string,
  ): AsyncGenerator<string> {
    let currentConversationId: number;

    if (conversationId) {
      // 会话ID已存在，先校验会话归属
      await this.conversationsService.ensureOwnership(userId, conversationId);
      currentConversationId = conversationId;
    } else {
      // 会话ID不存在，创建新会话
      const newConv = await this.conversationsService.createConversation(userId);
      currentConversationId = newConv.id;
    }

    // 先保存用户消息到数据库
    await this.conversationsService.addMessage(userId, currentConversationId, 'user', userContent);
    // 自动设置会话标题（如果标题为空）
    await this.conversationsService.autoSetTitleIfNeeded(userId, currentConversationId, userContent);

    // 获取会话内所有历史消息，用于构建通义千问的上下文
    const historyMessages = await this.conversationsService.getHistoryMessages(currentConversationId);

    // 用于累积AI的完整回复
    let aiReply = '';

    // 调用通义千问获取流式回复
    for await (const text of this.streamFromDashScope(historyMessages)) {
      aiReply += text;
      yield text;
    }

    // 流结束后，把AI的完整回复保存到数据库
    await this.conversationsService.addMessage(userId, currentConversationId, 'assistant', aiReply);
  }

  private async *streamFromDashScope(
    messages: Array<{ role: string; content: string }>,
  ): AsyncGenerator<string> {
    const apiKey = this.configService.get<string>('DASHSCOPE_API_KEY');

    if (!apiKey) {
      throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
    }

    const response = await axios.post<Readable>(
      this.apiUrl,
      {
        model: 'qwen-turbo',
        input: {
          messages,
        },
        parameters: {
          stream: true,
          incremental_output: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      },
    );

    // DashScope 返回的是一段一段的 Buffer，不保证每一段刚好是完整 JSON。
    // 所以这里用 buffer 暂存字符串，再从中切出完整 JSON 对象进行解析。
    let buffer = '';

    for await (const chunk of response.data) {
      buffer += chunk.toString();

      // 一个网络分片里可能包含多个 JSON 对象，因此要循环解析到没有完整 JSON 为止。
      while (true) {
        const jsonEnd = this.findCompleteJsonEnd(buffer);

        if (jsonEnd === -1) {
          break;
        }

        const jsonText = buffer.slice(0, jsonEnd);
        buffer = buffer.slice(jsonEnd);

        const text = this.extractTextFromChunk(jsonText);

        if (text) {
          yield text;
        }
      }
    }
  }

  private findCompleteJsonEnd(buffer: string): number {
    let openBraces = 0;
    let insideString = false;
    let escaped = false;

    // 通过跟踪花括号数量判断一个 JSON 对象是否已经完整。
    // 同时处理字符串和转义字符，避免文本内容中出现 { 或 } 时误判 JSON 结束位置。
    for (let index = 0; index < buffer.length; index += 1) {
      const character = buffer[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === '"') {
        insideString = !insideString;
        continue;
      }

      if (insideString) {
        continue;
      }

      if (character === '{') {
        openBraces += 1;
      }

      if (character === '}') {
        openBraces -= 1;

        if (openBraces === 0) {
          return index + 1;
        }
      }
    }

    return -1;
  }

  private extractTextFromChunk(jsonText: string): string {
    try {
      const chunk = JSON.parse(jsonText) as DashScopeStreamChunk;
      return chunk.output?.text ?? '';
    } catch {
      return '';
    }
  }
}
