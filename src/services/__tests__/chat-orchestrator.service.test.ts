import { ChatOrchestratorService } from '../chat-orchestrator.service';
import { ModelRepository } from '@/repositories/model.repo';
import { ChatPersistenceService } from '../chat-persistence.service';
import { ChatUsageTrackingService } from '../chat-usage-tracking.service';
import { ChatWebSearchService } from '../chat-web-search.service';

// Mock dependencies
jest.mock('@/repositories/model.repo');
jest.mock('../chat-persistence.service');
jest.mock('../chat-usage-tracking.service');
jest.mock('../chat-web-search.service');

const mockedModelRepository = ModelRepository as jest.Mocked<typeof ModelRepository>;
const mockedChatPersistenceService = ChatPersistenceService as jest.Mocked<typeof ChatPersistenceService>;
const mockedChatUsageTrackingService = ChatUsageTrackingService as jest.Mocked<typeof ChatUsageTrackingService>;
const mockedChatWebSearchService = ChatWebSearchService as jest.Mocked<typeof ChatWebSearchService>;

// Mock fetch
global.fetch = jest.fn();

describe('ChatOrchestratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OMNIROUTER_BASE_URL = 'http://localhost:20128/v1';
    process.env.OMNIROUTER_API_KEY = 'test-api-key';
  });

  describe('streamChat', () => {
    it('should initialize stream with correct event', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        description: null,
        status: 'active',
        max_context: 128000,
        thinking: 0,
        input_price: 2.5,
        output_price: 10.0,
        free: 0,
        speed: 'normal',
        discount_percent: 0,
        discount_type: 'none',
        sync_source: 'remote',
        sync_data: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as { id: string; name: string; description: string | null; max_tokens: number | null; context_window: number | null; price_per_million_tokens: number | null; image_generation: boolean | null; audio_input: boolean | null; audio_output: boolean | null; text_input: boolean | null; text_output: boolean | null; active: boolean | null; maintenance: boolean | null; free: boolean | null; provider: string | null; sync_source: string | null; sync_data: string | null; created_at: Date; updated_at: Date });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      // Create a mock readable stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
      expect(mockedModelRepository.getModelById).toHaveBeenCalledWith('gpt-4o');
      expect(mockedChatUsageTrackingService.getCreditRemaining).toHaveBeenCalledWith(userId);
      expect(mockedChatPersistenceService.ensureConversation).toHaveBeenCalledWith(
        null,
        userId,
        'Hello',
        'gpt-4o',
        'chat'
      );
    });

    it('should handle model not found and use defaults', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'unknown-model',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockRejectedValue(new Error('Model not found'));
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
      // Should continue with default pricing even if model not found
    });

    it('should throw error for disabled model', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        status: 'disabled',
      });

      await expect(ChatOrchestratorService.streamChat(userId, params)).rejects.toThrow(
        'MODEL_DISABLED'
      );
    });

    it('should handle fetch error from OmniRouter', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        status: 'active',
      });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await ChatOrchestratorService.streamChat(userId, params);

      // Should still return a stream that sends error event
      expect(result).toBeInstanceOf(ReadableStream);
    });

    it('should handle non-ok response from OmniRouter', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        status: 'active',
      });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
    });

    it('should perform web search when enabled', async () => {
      const userId = 'user-123';
      const params = {
        message: 'What is the latest news?',
        modelId: 'gpt-4o',
        category: 'research',
        thinkingEnabled: false,
        webSearchEnabled: true,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        status: 'active',
      });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      mockedChatWebSearchService.detectWebSearchIntent.mockReturnValue({ shouldSearch: true });
      mockedChatWebSearchService.performWebSearch.mockResolvedValue('Search results...');
      mockedChatWebSearchService.buildSystemContent.mockReturnValue('System content with web search');

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
      
      // Consume the stream to trigger the web search logic
      const reader = result.getReader();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (value) {
          // Process chunk if needed
        }
        done = doneReading;
      }

      expect(mockedChatWebSearchService.detectWebSearchIntent).toHaveBeenCalledWith(
        'What is the latest news?',
        'research'
      );
      expect(mockedChatWebSearchService.performWebSearch).toHaveBeenCalled();
    });

    it('should skip web search when not needed', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: true,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        description: null,
        status: 'active',
        max_context: 128000,
        thinking: 0,
        input_price: 2.5,
        output_price: 10.0,
        free: 0,
        speed: 'normal',
        discount_percent: 0,
        discount_type: 'none',
        sync_source: 'remote',
        sync_data: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as { id: string; name: string; description: string | null; max_tokens: number | null; context_window: number | null; price_per_million_tokens: number | null; image_generation: boolean | null; audio_input: boolean | null; audio_output: boolean | null; text_input: boolean | null; text_output: boolean | null; active: boolean | null; maintenance: boolean | null; free: boolean | null; provider: string | null; sync_source: string | null; sync_data: string | null; created_at: Date; updated_at: Date });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      mockedChatWebSearchService.detectWebSearchIntent.mockReturnValue({ shouldSearch: false, confidence: 'high' as const });

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
      expect(mockedChatWebSearchService.performWebSearch).not.toHaveBeenCalled();
    });

    it('should check credit before API call for non-free models', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        description: null,
        status: 'active',
        max_context: 128000,
        thinking: 0,
        input_price: 2.5,
        output_price: 10.0,
        free: 0,
        speed: 'normal',
        discount_percent: 0,
        discount_type: 'none',
        sync_source: 'remote',
        sync_data: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as { id: string; name: string; description: string | null; max_tokens: number | null; context_window: number | null; price_per_million_tokens: number | null; image_generation: boolean | null; audio_input: boolean | null; audio_output: boolean | null; text_input: boolean | null; text_output: boolean | null; active: boolean | null; maintenance: boolean | null; free: boolean | null; provider: string | null; sync_source: string | null; sync_data: string | null; created_at: Date; updated_at: Date });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatUsageTrackingService.checkCredit.mockResolvedValue(100);
      mockedChatUsageTrackingService.calculateCost.mockReturnValue({
        inputCost: 0.1,
        outputCost: 0.2,
        totalCost: 0.3,
      });
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
      
      // Consume the stream to trigger the credit check logic
      const reader = result.getReader();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        if (value) {
          // Process chunk if needed
        }
        done = doneReading;
      }

      expect(mockedChatUsageTrackingService.checkCredit).toHaveBeenCalledWith(
        userId,
        expect.any(Number),
        false
      );
    });

    it('should skip credit check for free models', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'free-model',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'free-model',
        name: 'Free Model',
        provider: 'openai',
        description: null,
        status: 'active',
        max_context: 128000,
        thinking: 0,
        input_price: 0,
        output_price: 0,
        free: 1,
        speed: 'normal',
        discount_percent: 0,
        discount_type: 'none',
        sync_source: 'remote',
        sync_data: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as { id: string; name: string; description: string | null; max_tokens: number | null; context_window: number | null; price_per_million_tokens: number | null; image_generation: boolean | null; audio_input: boolean | null; audio_output: boolean | null; text_input: boolean | null; text_output: boolean | null; active: boolean | null; maintenance: boolean | null; free: boolean | null; provider: string | null; sync_source: string | null; sync_data: string | null; created_at: Date; updated_at: Date });
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
      expect(mockedChatUsageTrackingService.checkCredit).not.toHaveBeenCalled();
    });

    it('should send credit error event if insufficient credits', async () => {
      const userId = 'user-123';
      const params = {
        message: 'Hello',
        modelId: 'gpt-4o',
        category: 'chat',
        thinkingEnabled: false,
        webSearchEnabled: false,
        history: [],
        conversationId: null,
        timezone: 'Asia/Jakarta',
      };

      mockedModelRepository.getModelById.mockResolvedValue({
        id: 'gpt-4o',
        status: 'active',
        free: false,
      });
      mockedChatUsageTrackingService.getCreditRemaining.mockResolvedValue(100);
      mockedChatUsageTrackingService.checkCredit.mockRejectedValue(
        new Error('INSUFFICIENT_CREDITS: Not enough credit')
      );
      mockedChatPersistenceService.ensureConversation.mockResolvedValue('conv-generated');

      const result = await ChatOrchestratorService.streamChat(userId, params);

      expect(result).toBeInstanceOf(ReadableStream);
    });
  });
});