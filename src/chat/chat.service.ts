import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Readable } from 'stream';

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
  constructor(private readonly configService: ConfigService) {}

  async *streamChat(message: string): AsyncGenerator<string> {
    const apiKey = this.configService.get<string>('DASHSCOPE_API_KEY');

    // 原项目里把通义千问 API Key 写在 server.js 中，这样有泄露风险。
    // NestJS 版本改为从环境变量读取：DASHSCOPE_API_KEY=你的密钥。
    if (!apiKey) {
      throw new Error('缺少 DASHSCOPE_API_KEY 环境变量');
    }

    const response = await axios.post<Readable>(
      this.apiUrl,
      {
        model: 'qwen-turbo',
        input: {
          messages: [{ role: 'user', content: message }],
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

  private extractTextFromChunk(jsonText: string): string {
    try {
      const chunk = JSON.parse(jsonText) as DashScopeStreamChunk;
      return chunk.output?.text ?? '';
    } catch {
      // 流式接口偶尔可能出现非 JSON 片段，直接忽略即可，避免中断整个 SSE 连接。
      return '';
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
}
