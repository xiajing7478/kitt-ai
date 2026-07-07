export type ConversationRecord = {
  id: number;
  user_id: number;
  title: string | null;
  created_at: Date;
  updated_at: Date;
};

/** 安全的会话对象，不包含 user_id 等内部字段 */
export type SafeConversation = Omit<ConversationRecord, 'user_id'>;

export type MessageRecord = {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
};