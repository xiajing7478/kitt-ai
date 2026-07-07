import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import type { ConversationRecord, MessageRecord, SafeConversation } from './types/conversation.type';

@Injectable()
export class ConversationsService {
  // DATABASE_POOL 注入 PostgreSQL 连接池
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async getConversations(userId: number): Promise<SafeConversation[]> {
    // 获取当前用户的所有会话，按最近活跃排序
    const result = await this.pool.query<ConversationRecord>(
      `SELECT id, title, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async getConversation(userId: number, conversationId: number): Promise<SafeConversation & {messages: MessageRecord[]}> {
    // 获取会话元数据
    const convResult = await this.pool.query<ConversationRecord>(
      `SELECT id, title, created_at, updated_at
       FROM conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId],
    );

    if (convResult.rowCount === 0) {
      throw new NotFoundException('会话不存在或无权限访问');
    }

    // 获取会话内的所有消息，按时间升序排列
    const msgResult = await this.pool.query<MessageRecord>(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );

    return { ...convResult.rows[0], messages: msgResult.rows };
  }

  async createConversation(userId: number, title?: string): Promise<SafeConversation> {
    // 创建新会话，标题可选
    const result = await this.pool.query<ConversationRecord>(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, title, created_at, updated_at`,
      [userId, title || null],
    );
    return result.rows[0];
  }

  async updateTitle(userId: number, conversationId: number, title?: string): Promise<SafeConversation> {
    // 更新会话标题，同时更新 updated_at
    const result = await this.pool.query<ConversationRecord>(
      `UPDATE conversations
       SET title = COALESCE($1, title), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, created_at, updated_at`,
      [title, conversationId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('会话不存在或无权限访问');
    }

    return result.rows[0];
  }

  async deleteConversation(userId: number, conversationId: number): Promise<void> {
    // 删除会话（数据库会级联删除关联的 messages）
    const result = await this.pool.query(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('会话不存在或无权限访问');
    }
  }

  async addMessage(
    userId: number,
    conversationId: number,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<MessageRecord> {
    // 添加消息前先校验会话归属
    await this.ensureOwnership(userId, conversationId);

    // 插入新消息
    const result = await this.pool.query<MessageRecord>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING id, role, content, created_at`,
      [conversationId, role, content],
    );

    // 同步更新会话的 updated_at
    await this.pool.query(
      `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [conversationId],
    );

    return result.rows[0];
  }

  async getHistoryMessages(conversationId: number): Promise<Array<{role: string; content: string}>> {
    // 获取会话内的历史消息，用于构建通义千问的上下文
    const result = await this.pool.query<MessageRecord>(
      `SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId],
    );
    return result.rows;
  }

  async ensureOwnership(userId: number, conversationId: number): Promise<void> {
    // 校验会话是否属于当前用户，防止越权访问
    const result = await this.pool.query(
      `SELECT id FROM conversations WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [conversationId, userId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('会话不存在或无权限访问');
    }
  }

  async autoSetTitleIfNeeded(userId: number, conversationId: number, userContent: string): Promise<void> {
    // 如果会话标题为空，自动用第一条用户消息的前 200 字符作为标题
    const convResult = await this.pool.query<ConversationRecord>(
      `SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId],
    );

    if (convResult.rowCount === 0) {
      return;
    }

    const conv = convResult.rows[0];
    if (conv.title !== null) {
      return;
    }

    const title = userContent.slice(0, 200).trim();
    await this.pool.query(
      `UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [title, conversationId],
    );
  }
}
