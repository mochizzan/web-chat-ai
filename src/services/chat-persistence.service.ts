/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatRepository } from '@/repositories/chat.repo';
import { toMySQLDatetime } from '@/lib/db';

// ---------------------------------------------------------------------------
// Retry Options & Helper
// ---------------------------------------------------------------------------
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

/**
 * Executes an async operation with exponential backoff retry.
 * Default: 3 retries, starting at 100ms, max 1000ms delay.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 100, maxDelay = 1000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.warn(
          `[ChatPersistence] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`,
          lastError.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
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
   * Validates that a conversation ID exists in the database.
   * Returns true if the conversation exists, false otherwise.
   */
  async validateConversationId(conversationId: string): Promise<boolean> {
    try {
      const conversation = await ChatRepository.findConversationById(conversationId);
      return conversation !== null;
    } catch {
      return false;
    }
  },

  /**
   * Saves a message to the database with:
   * 1. Validation of conversation_id before insert
   * 2. Auto-retry with exponential backoff on failure
   * 3. Fallback conversation creation if FK fails
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
    // 1. Validasi conversation_id terlebih dahulu
    const isValid = await this.validateConversationId(msg.conversation_id);
    if (!isValid) {
      throw new Error(`INVALID_CONVERSATION: conversation_id "${msg.conversation_id}" tidak ditemukan`);
    }

    // 2. Simpan dengan retry mechanism (3x percobaan)
    return await withRetry(
      () => ChatRepository.saveMessage(msg as any),
      { maxRetries: 3, initialDelay: 100, maxDelay: 1000 }
    );
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
   * Updates conversation category.
   */
  async updateConversationCategory(id: string, category: string): Promise<void> {
    await ChatRepository.updateConversationCategory(id, category);
  },

  /**
   * Ensures conversation exists, creates if not.
   * Handles race condition by retrying find after create failure.
   * Returns conversation ID.
   */
  async ensureConversation(
    conversationId: string | null,
    userId: string | null,
    message: string,
    modelId: string,
    category: string
  ): Promise<string> {
    // Anonymous user — generate temp ID without DB persistence
    if (!userId) {
      return conversationId || `conv_${Date.now()}_${process.hrtime.bigint().toString(36)}_${Math.random().toString(36).slice(2, 4)}`;
    }

    // Use hrtime.bigint() for more unique ID generation
    const genConversationId = conversationId || `conv_${Date.now()}_${process.hrtime.bigint().toString(36)}_${Math.random().toString(36).slice(2, 4)}`;

    // Cek apakah conversation sudah ada
    let existingConv = await ChatRepository.findConversationById(genConversationId);
    if (!existingConv) {
      const title = message.trim().length > 100
        ? message.trim().substring(0, 100) + '...'
        : message.trim();
     
     // Coba buat conversation baru
     try {
       await ChatRepository.createConversation(userId, title, modelId, category, genConversationId);
     } catch (error: any) {
       // Jika gagal karena duplikat (race condition), cari lagi
       if (error.message?.includes('Duplicate entry') || error.code === 'ER_DUP_ENTRY') {
         console.warn('[ChatPersistence] Race condition detected, verifying conversation exists');
       } else {
         console.error('[ChatPersistence] createConversation failed:', error.message);
       }
     }
     
     // Verifikasi akhir - pastikan conversation ada
     existingConv = await ChatRepository.findConversationById(genConversationId);
     if (!existingConv) {
       throw new Error(`Failed to ensure conversation: ${genConversationId} - creation failed and not found`);
     }
   } else {
     // Update title jika conversation sudah ada
     await ChatRepository.updateConversationTitle(genConversationId, message.trim().substring(0, 100));
   }

   return genConversationId;
 },
};
