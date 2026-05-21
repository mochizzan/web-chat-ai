/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatRepository } from '@/repositories/chat.repo';
import { toMySQLDatetime } from '@/lib/db';

export const ChatPersistenceService = {
  /**
   * Fetches all conversations for a user with their last message.
   */
  async getUserConversations(userId: string): Promise<any[]> {
    const conversations = await ChatRepository.getConversationsByUserId(userId);
    return conversations.map(c => ({
      id: c.id,
      title: c.title || 'New Chat',
      model: c.model || 'gpt-4o',
      category: c.category || 'assistant',
      pinned: Boolean(c.pinned),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      lastMessage: c.last_message ? {
        id: c.last_message.id,
        role: c.last_message.role,
        content: c.last_message.content,
        createdAt: c.last_message.created_at, // Mapping dari snake_case ke camelCase
      } : null,
    }));
  },

  /**
   * Creates a new conversation.
   */
  async createConversation(
    userId: string,
    data: { title?: string; model?: string; category?: string }
  ) {
    return await ChatRepository.createConversation(
      userId,
      data.title || 'New Chat',
      data.model || 'gpt-4o',
      data.category || 'assistant'
    );
  },

  /**
   * Fetches detailed conversation data including messages.
   */
  async getConversationDetails(conversationId: string) {
    const conversation = await ChatRepository.findConversationById(conversationId);
    if (!conversation) return null;

    const messages = await ChatRepository.findMessagesByConversationId(conversationId);

    return {
      conversation: {
        id: conversation.id,
        userId: conversation.user_id,
        title: conversation.title,
        model: conversation.model,
        category: conversation.category,
        pinned: Boolean(conversation.pinned),
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        thinkingContent: m.thinking_content,
        createdAt: m.created_at,
      })),
    };
  },

  /**
   * Deletes a conversation.
   */
  async deleteConversation(conversationId: string) {
    return await ChatRepository.deleteConversation(conversationId);
  },

  /**
   * Saves a message to the database.
   */
  async saveMessage(msg: {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    thinking_content?: string | null;
    input_tokens?: number;
    output_tokens?: number;
    input_cost?: number;
    output_cost?: number;
    total_cost?: number;
    created_at?: string;
  }) {
    return await ChatRepository.saveMessage(msg as any);
  },

  /**
   * Updates conversation title (only if still "New Chat").
   */
  async updateConversationTitle(id: string, title: string): Promise<void> {
    await ChatRepository.updateConversationTitle(id, title);
  },

  /**
   * Updates conversation's updated_at timestamp.
   */
  async updateConversationUpdatedAt(id: string): Promise<void> {
    await ChatRepository.updateConversationUpdatedAt(id, toMySQLDatetime());
  },

  /**
   * Ensures conversation exists, creates if not.
   * Returns conversation ID.
   */
  async ensureConversation(
    conversationId: string | null,
    userId: string,
    message: string,
    modelId: string,
    category: string
  ): Promise<string> {
    const genConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const existingConv = await ChatRepository.findConversationById(genConversationId);
    if (!existingConv) {
      const title = message.trim().length > 100
        ? message.trim().substring(0, 100) + '...'
        : message.trim();
      await ChatRepository.createConversation(userId, title, modelId, category);
    } else {
      await ChatRepository.updateConversationTitle(genConversationId, message.trim().substring(0, 100));
    }
    
    return genConversationId;
  },
};
