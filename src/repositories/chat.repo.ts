/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, querySingle } from '@/lib/db';
import { Conversation, Message } from '@/types';

export const ChatRepository = {
  async createConversation(userId: string, title: string, model: string = 'gpt-4o', category: string = 'assistant'): Promise<Conversation> {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await query(
      'INSERT INTO conversations (id, user_id, title, model, category) VALUES (?, ?, ?, ?, ?)',
      [String(id), String(userId), String(title), String(model), String(category)]
    );
    
    const conv = await querySingle<Conversation>('SELECT * FROM conversations WHERE id = ?', [String(id)]);
    if (!conv) throw new Error('Conversation creation failed');
    return conv;
  },

  async getConversationsByUserId(userId: string): Promise<any[]> {
    return await query<any[]>(`
      SELECT
        c.*,
        (SELECT JSON_OBJECT('id', m.id, 'role', m.role, 'content', LEFT(m.content, 200), 'created_at', m.created_at)
         FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.pinned DESC, c.updated_at DESC`, [String(userId)]);
  },

  async findConversationById(id: string): Promise<Conversation | null> {
    return await querySingle<Conversation>('SELECT * FROM conversations WHERE id = ?', [String(id)]);
  },

  async saveMessage(msg: Partial<Message>): Promise<Message> {
    const { id, conversation_id, role, content, thinking_content, input_tokens, output_tokens, input_cost, output_cost, total_cost } = msg;
    
    await query(
      'INSERT INTO messages (id, conversation_id, role, content, thinking_content, input_tokens, output_tokens, input_cost, output_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [String(id ?? ''), String(conversation_id ?? ''), String(role ?? ''), String(content ?? ''), String(thinking_content ?? ''), Number(input_tokens ?? 0), Number(output_tokens ?? 0), Number(input_cost ?? 0), Number(output_cost ?? 0), Number(total_cost ?? 0)]
    );
    
    const message = await querySingle<Message>('SELECT * FROM messages WHERE id = ?', [String(id ?? '')]);
    if (!message) throw new Error('Message save failed');
    return message;
  },

  async getMessagesByConvId(convId: string): Promise<Message[]> {
    return await query<Message[]>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [String(convId)]);
  },

  async findMessagesByConversationId(convId: string): Promise<Message[]> {
    return this.getMessagesByConvId(convId);
  },

  async deleteConversation(id: string): Promise<void> {
    await query('DELETE FROM conversations WHERE id = ?', [String(id)]);
  },

  async updateConversationTitle(id: string, title: string): Promise<void> {
    await query('UPDATE conversations SET title = ? WHERE id = ? AND title = "New Chat"', [String(title), String(id)]);
  },

  async updateConversationUpdatedAt(id: string, updatedAt: string): Promise<void> {
    await query('UPDATE conversations SET updated_at = ? WHERE id = ?', [String(updatedAt), String(id)]);
  },

  async saveUsageLog(log: any): Promise<void> {
    await query(
      'INSERT INTO usage_logs (id, user_id, conversation_id, message_id, model_id, model_name, provider, input_tokens, output_tokens, input_cost, output_cost, total_cost, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        String(log.id), String(log.userId), String(log.conversationId), String(log.messageId),
        String(log.modelId), String(log.modelName), String(log.provider),
        Number(log.inputTokens), Number(log.outputTokens),
        Number(log.inputCost), Number(log.outputCost), Number(log.totalCost),
        String(log.category),
      ]
    );
  },
};
