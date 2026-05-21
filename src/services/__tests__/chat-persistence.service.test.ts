import { ChatPersistenceService } from '../chat-persistence.service';
import { ChatRepository } from '@/repositories/chat.repo';
import { toMySQLDatetime } from '@/lib/db';

// Mock dependencies
jest.mock('@/repositories/chat.repo');
jest.mock('@/lib/db');

const mockedChatRepository = ChatRepository as jest.Mocked<typeof ChatRepository>;

describe('ChatPersistenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserConversations', () => {
    it('should return formatted conversations for a user', async () => {
      const userId = 'user-123';
      const mockConversations = [
        {
          id: 'conv-1',
          user_id: userId,
          title: 'Test Chat',
          model: 'gpt-4o',
          category: 'assistant',
          pinned: 1,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          last_message: { id: 'msg-1', role: 'user', content: 'Hello', created_at: '2024-01-01T00:00:00.000Z' },
        },
      ];

      mockedChatRepository.getConversationsByUserId.mockResolvedValue(mockConversations);

      const result = await ChatPersistenceService.getUserConversations(userId);

      expect(mockedChatRepository.getConversationsByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual([
        {
          id: 'conv-1',
          title: 'Test Chat',
          model: 'gpt-4o',
          category: 'assistant',
          pinned: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          lastMessage: { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2024-01-01T00:00:00.000Z' },
        },
      ]);
    });

    it('should handle empty conversations array', async () => {
      const userId = 'user-123';
      mockedChatRepository.getConversationsByUserId.mockResolvedValue([]);

      const result = await ChatPersistenceService.getUserConversations(userId);

      expect(result).toEqual([]);
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation with default values', async () => {
      const userId = 'user-123';
      const mockConversation = {
        id: 'conv-123',
        user_id: userId,
        title: 'New Chat',
        model: 'gpt-4o',
        category: 'assistant',
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedChatRepository.createConversation.mockResolvedValue(mockConversation);

      const result = await ChatPersistenceService.createConversation(userId, {});

      expect(mockedChatRepository.createConversation).toHaveBeenCalledWith(
        userId,
        'New Chat',
        'gpt-4o',
        'assistant'
      );
      expect(result).toEqual(mockConversation);
    });

    it('should create conversation with custom values', async () => {
      const userId = 'user-123';
      const data = { title: 'Custom Title', model: 'claude-3', category: 'coding' };
      const mockConversation = {
        id: 'conv-123',
        user_id: userId,
        title: data.title,
        model: data.model,
        category: data.category,
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedChatRepository.createConversation.mockResolvedValue(mockConversation);

      const result = await ChatPersistenceService.createConversation(userId, data);

      expect(mockedChatRepository.createConversation).toHaveBeenCalledWith(
        userId,
        data.title,
        data.model,
        data.category
      );
      expect(result).toEqual(mockConversation);
    });
  });

  describe('getConversationDetails', () => {
    it('should return conversation with messages', async () => {
      const conversationId = 'conv-123';
      const mockConversation = {
        id: conversationId,
        user_id: 'user-123',
        title: 'Test Chat',
        model: 'gpt-4o',
        category: 'assistant',
        pinned: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const mockMessages = [
        {
          id: 'msg-1',
          conversation_id: conversationId,
          role: 'user',
          content: 'Hello',
          thinking_content: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'msg-2',
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Hi there!',
          thinking_content: 'Thinking...',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockedChatRepository.findConversationById.mockResolvedValue(mockConversation);
      mockedChatRepository.findMessagesByConversationId.mockResolvedValue(mockMessages);

      const result = await ChatPersistenceService.getConversationDetails(conversationId);

      expect(mockedChatRepository.findConversationById).toHaveBeenCalledWith(conversationId);
      expect(mockedChatRepository.findMessagesByConversationId).toHaveBeenCalledWith(conversationId);
      expect(result).toEqual({
        conversation: {
          id: conversationId,
          userId: 'user-123',
          title: 'Test Chat',
          model: 'gpt-4o',
          category: 'assistant',
          pinned: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            thinkingContent: null,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi there!',
            thinkingContent: 'Thinking...',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    it('should return null if conversation not found', async () => {
      const conversationId = 'nonexistent-conv';
      mockedChatRepository.findConversationById.mockResolvedValue(null);

      const result = await ChatPersistenceService.getConversationDetails(conversationId);

      expect(result).toBeNull();
    });
  });

  describe('deleteConversation', () => {
    it('should delete a conversation', async () => {
      const conversationId = 'conv-123';
      mockedChatRepository.deleteConversation.mockResolvedValue(undefined);

      await ChatPersistenceService.deleteConversation(conversationId);

      expect(mockedChatRepository.deleteConversation).toHaveBeenCalledWith(conversationId);
    });
  });

  describe('saveMessage', () => {
    it('should save a message successfully', async () => {
      const message = {
        id: 'msg-123',
        conversation_id: 'conv-123',
        role: 'user',
        content: 'Hello',
      };
      mockedChatRepository.saveMessage.mockResolvedValue(undefined);

      await ChatPersistenceService.saveMessage(message);

      expect(mockedChatRepository.saveMessage).toHaveBeenCalledWith(message);
    });
  });

  describe('updateConversationTitle', () => {
    it('should update conversation title', async () => {
      const conversationId = 'conv-123';
      const newTitle = 'New Title';
      mockedChatRepository.updateConversationTitle.mockResolvedValue(undefined);

      await ChatPersistenceService.updateConversationTitle(conversationId, newTitle);

      expect(mockedChatRepository.updateConversationTitle).toHaveBeenCalledWith(conversationId, newTitle);
    });
  });

  describe('updateConversationUpdatedAt', () => {
    it('should update conversation updated_at timestamp', async () => {
      const conversationId = 'conv-123';
      const mockDatetime = '2024-01-01T00:00:00.000Z';
      (toMySQLDatetime as jest.Mock).mockReturnValue(mockDatetime);
      mockedChatRepository.updateConversationUpdatedAt.mockResolvedValue(undefined);

      await ChatPersistenceService.updateConversationUpdatedAt(conversationId);

      expect(toMySQLDatetime).toHaveBeenCalled();
      expect(mockedChatRepository.updateConversationUpdatedAt).toHaveBeenCalledWith(conversationId, mockDatetime);
    });
  });

  describe('ensureConversation', () => {
    it('should create new conversation if id not provided', async () => {
      const userId = 'user-123';
      const message = 'Hello';
      const modelId = 'gpt-4o';
      const category = 'assistant';
      const mockConversation = {
        id: 'conv-123',
        user_id: userId,
        title: 'Hello',
        model: modelId,
        category: category,
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockedChatRepository.findConversationById.mockResolvedValue(null);
      mockedChatRepository.createConversation.mockResolvedValue(mockConversation);

      const result = await ChatPersistenceService.ensureConversation(null, userId, message, modelId, category);

      expect(mockedChatRepository.findConversationById).toHaveBeenCalled();
      expect(mockedChatRepository.createConversation).toHaveBeenCalledWith(
        userId,
        'Hello',
        modelId,
        category
      );
      expect(result).toMatch(/^conv_/);
    });

    it('should use existing conversation if found', async () => {
      const conversationId = 'conv-123';
      const userId = 'user-123';
      const message = 'Hello';
      const modelId = 'gpt-4o';
      const category = 'assistant';
      const mockConversation = {
        id: conversationId,
        user_id: userId,
        title: 'Old Title',
        model: modelId,
        category: category,
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockedChatRepository.findConversationById.mockResolvedValue(mockConversation);
      mockedChatRepository.updateConversationTitle.mockResolvedValue(undefined);

      const result = await ChatPersistenceService.ensureConversation(conversationId, userId, message, modelId, category);

      expect(mockedChatRepository.findConversationById).toHaveBeenCalledWith(conversationId);
      expect(mockedChatRepository.updateConversationTitle).toHaveBeenCalledWith(conversationId, 'Hello');
      expect(result).toBe(conversationId);
    });

    it('should truncate long messages for title', async () => {
      const userId = 'user-123';
      const longMessage = 'a'.repeat(150);
      const modelId = 'gpt-4o';
      const category = 'assistant';
      const mockConversation = {
        id: 'conv-123',
        user_id: userId,
        title: longMessage.substring(0, 100) + '...',
        model: modelId,
        category: category,
        pinned: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockedChatRepository.findConversationById.mockResolvedValue(null);
      mockedChatRepository.createConversation.mockResolvedValue(mockConversation);

      const result = await ChatPersistenceService.ensureConversation(null, userId, longMessage, modelId, category);

      expect(mockedChatRepository.createConversation).toHaveBeenCalledWith(
        userId,
        longMessage.substring(0, 100) + '...',
        modelId,
        category
      );
      expect(result).toMatch(/^conv_/);
    });
  });
});
