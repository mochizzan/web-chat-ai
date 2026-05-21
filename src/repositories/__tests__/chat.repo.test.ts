import { ChatRepository } from '../chat.repo';
import { query, querySingle, querySimple } from '@/lib/db';

// Mock db
jest.mock('@/lib/db');

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedQuerySingle = querySingle as jest.MockedFunction<typeof querySingle>;
const mockedQuerySimple = querySimple as jest.MockedFunction<typeof querySimple>;

describe('ChatRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should create conversation and return it', async () => {
      const userId = 'user-123';
      const title = 'Test Chat';
      const model = 'gpt-4o';
      const category = 'assistant';

      const mockConv = {
        id: 'conv-123',
        user_id: userId,
        title,
        model,
        category,
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedQuery.mockResolvedValue(undefined);
      mockedQuerySingle.mockResolvedValue(mockConv);

      const result = await ChatRepository.createConversation(userId, title, model, category);

      expect(mockedQuery).toHaveBeenCalledWith(
        'INSERT INTO conversations (id, user_id, title, model, category) VALUES (?, ?, ?, ?, ?)',
        expect.arrayContaining([expect.stringMatching(/^conv_/), userId, title, model, category])
      );
      expect(mockedQuerySingle).toHaveBeenCalledWith(
        'SELECT * FROM conversations WHERE id = ?',
        [expect.stringMatching(/^conv_/)]
      );
      expect(result).toEqual(mockConv);
    });

    it('should throw error if conversation creation fails', async () => {
      const userId = 'user-123';
      const title = 'Test Chat';

      mockedQuery.mockResolvedValue(undefined);
      mockedQuerySingle.mockResolvedValue(null);

      await expect(
        ChatRepository.createConversation(userId, title)
      ).rejects.toThrow('Conversation creation failed');
    });
  });

  describe('getConversationsByUserId', () => {
    it('should return conversations with last message', async () => {
      const userId = 'user-123';
      const mockConversations = [
        {
          id: 'conv-1',
          user_id: userId,
          title: 'Chat 1',
          model: 'gpt-4o',
          category: 'assistant',
          pinned: 1,
          created_at: new Date(),
          updated_at: new Date(),
          last_message: { id: 'msg-1', role: 'user', content: 'Hello', created_at: new Date() },
        },
      ];

      mockedQuery.mockResolvedValue(mockConversations);

      const result = await ChatRepository.getConversationsByUserId(userId);

      expect(result).toEqual(mockConversations);
    });
  });

  describe('findConversationById', () => {
    it('should find conversation by id', async () => {
      const mockConv = {
        id: 'conv-123',
        user_id: 'user-123',
        title: 'Test',
        model: 'gpt-4o',
        category: 'assistant',
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedQuerySingle.mockResolvedValue(mockConv);

      const result = await ChatRepository.findConversationById('conv-123');

      expect(mockedQuerySingle).toHaveBeenCalledWith(
        'SELECT * FROM conversations WHERE id = ?',
        ['conv-123']
      );
      expect(result).toEqual(mockConv);
    });

    it('should return null if not found', async () => {
      mockedQuerySingle.mockResolvedValue(null);

      const result = await ChatRepository.findConversationById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('saveMessage', () => {
    it('should save message and return it', async () => {
      const message = {
        id: 'msg-123',
        conversation_id: 'conv-123',
        role: 'user' as const,
        content: 'Hello',
        thinking_content: null,
        input_tokens: 10,
        output_tokens: 20,
        input_cost: 0.01,
        output_cost: 0.02,
        total_cost: 0.03,
      };

      const savedMessage = {
        ...message,
        created_at: new Date(),
      };

      mockedQuery.mockResolvedValue(undefined);
      mockedQuerySingle.mockResolvedValue(savedMessage);

      const result = await ChatRepository.saveMessage(message);

      expect(mockedQuery).toHaveBeenCalledWith(
        'INSERT INTO messages (id, conversation_id, role, content, thinking_content, input_tokens, output_tokens, input_cost, output_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        expect.arrayContaining([
          message.id,
          message.conversation_id,
          message.role,
          message.content,
          message.thinking_content,
          message.input_tokens,
          message.output_tokens,
          message.input_cost,
          message.output_cost,
          message.total_cost,
        ])
      );
      expect(result).toEqual(savedMessage);
    });

    it('should throw error if save fails', async () => {
      const message = {
        id: 'msg-123',
        conversation_id: 'conv-123',
        role: 'user',
        content: 'Hello',
      };

      mockedQuery.mockResolvedValue(undefined);
      mockedQuerySingle.mockResolvedValue(null);

      await expect(ChatRepository.saveMessage(message)).rejects.toThrow('Message save failed');
    });
  });

  describe('getMessagesByConvId', () => {
    it('should return messages for conversation', async () => {
      const convId = 'conv-123';
      const messages = [
        {
          id: 'msg-1',
          conversation_id: convId,
          role: 'user',
          content: 'Hello',
          created_at: new Date(),
        },
      ];

      mockedQuery.mockResolvedValue(messages);

      const result = await ChatRepository.getMessagesByConvId(convId);

      expect(mockedQuery).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [convId]
      );
      expect(result).toEqual(messages);
    });
  });

  describe('findMessagesByConversationId', () => {
    it('should delegate to getMessagesByConvId', async () => {
      const convId = 'conv-123';
      const messages = [{ id: 'msg-1', conversation_id: convId }];

      mockedQuery.mockResolvedValue(messages);

      const result = await ChatRepository.findMessagesByConversationId(convId);

      expect(result).toEqual(messages);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation', async () => {
      const id = 'conv-123';
      mockedQuery.mockResolvedValue(undefined);

      await ChatRepository.deleteConversation(id);

      expect(mockedQuery).toHaveBeenCalledWith(
        'DELETE FROM conversations WHERE id = ?',
        [id]
      );
    });
  });

  describe('updateConversationTitle', () => {
    it('should update conversation title', async () => {
      const id = 'conv-123';
      const title = 'Updated Title';

      await ChatRepository.updateConversationTitle(id, title);

      expect(mockedQuery).toHaveBeenCalledWith(
        'UPDATE conversations SET title = ? WHERE id = ? AND title = "New Chat"',
        [title, id]
      );
    });
  });

  describe('updateConversationUpdatedAt', () => {
    it('should update updated_at timestamp', async () => {
      const id = 'conv-123';
      const updatedAt = '2024-01-01 12:00:00';

      await ChatRepository.updateConversationUpdatedAt(id, updatedAt);

      expect(mockedQuery).toHaveBeenCalledWith(
        'UPDATE conversations SET updated_at = ? WHERE id = ?',
        [updatedAt, id]
      );
    });
  });

  describe('saveUsageLog', () => {
    it('should save usage log', async () => {
      const log = {
        id: 'log-123',
        userId: 'user-123',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
        inputCost: 0.01,
        outputCost: 0.05,
        totalCost: 0.06,
        category: 'assistant',
      };

      mockedQuery.mockResolvedValue(undefined);

      await ChatRepository.saveUsageLog(log);

      expect(mockedQuery).toHaveBeenCalledWith(
        'INSERT INTO usage_logs (id, user_id, conversation_id, message_id, model_id, model_name, provider, input_tokens, output_tokens, input_cost, output_cost, total_cost, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        expect.arrayContaining([
          log.id,
          log.userId,
          log.conversationId,
          log.messageId,
          log.modelId,
          log.modelName,
          log.provider,
          log.inputTokens,
          log.outputTokens,
          log.inputCost,
          log.outputCost,
          log.totalCost,
          log.category,
        ])
      );
    });
  });
});