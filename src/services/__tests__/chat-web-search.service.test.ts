import { ChatWebSearchService } from '../chat-web-search.service';
import { searchAndFormat, searchWithTavily, formatTavilyResults } from '@/lib/tavily-search';
import { detectIntentWithAI } from '@/lib/ai-intent-detector';

// Mock dependencies
jest.mock('@/lib/tavily-search');
jest.mock('@/lib/ai-intent-detector');

const mockedSearchAndFormat = searchAndFormat as jest.MockedFunction<typeof searchAndFormat>;
const mockedSearchWithTavily = searchWithTavily as jest.MockedFunction<typeof searchWithTavily>;
const mockedFormatTavilyResults = formatTavilyResults as jest.MockedFunction<typeof formatTavilyResults>;
const mockedDetectIntentWithAI = detectIntentWithAI as jest.MockedFunction<typeof detectIntentWithAI>;

describe('ChatWebSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectWebSearchIntent', () => {
    it('should return true with high confidence for clear search queries', async () => {
      const query = 'What is the latest news about AI?';
      const context = { webSearchEnabled: true, category: 'assistant' };

      mockedDetectIntentWithAI.mockResolvedValue({
        shouldSearch: true,
        confidence: 'high',
        reasoning: 'User is asking about latest news',
        suggestedQuery: 'latest AI news 2025',
        category: 'general',
      });

      const result = await ChatWebSearchService.detectWebSearchIntent(query, context);

      expect(mockedDetectIntentWithAI).toHaveBeenCalledWith(query, context);
      expect(result.shouldSearch).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.reasoning).toBe('User is asking about latest news');
    });

    it('should return false for non-search queries', async () => {
      const query = 'Hello, how are you?';
      const context = { webSearchEnabled: true, category: 'chat' };

      mockedDetectIntentWithAI.mockResolvedValue({
        shouldSearch: false,
        confidence: 'low',
        reasoning: 'General greeting, no search needed',
      });

      const result = await ChatWebSearchService.detectWebSearchIntent(query, context);

      expect(result.shouldSearch).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('should set recommendToggle=true when toggle is OFF and search is needed', async () => {
      const query = 'tolong carikan berita terbaru hari ini';
      const context = { webSearchEnabled: false, category: 'chat' };

      mockedDetectIntentWithAI.mockResolvedValue({
        shouldSearch: true,
        confidence: 'high',
        reasoning: 'User needs latest news',
        suggestedQuery: 'latest news today',
        category: 'news',
        recommendToggle: true,
      });

      const result = await ChatWebSearchService.detectWebSearchIntent(query, context);

      expect(result.shouldSearch).toBe(true);
      expect(result.recommendToggle).toBe(true);
      expect(result.suggestedQuery).toBe('latest news today');
    });

    it('should set recommendToggle=false when toggle is ON and search is needed', async () => {
      const query = 'siapa presiden RI saat ini?';
      const context = { webSearchEnabled: true, category: 'chat' };

      mockedDetectIntentWithAI.mockResolvedValue({
        shouldSearch: true,
        confidence: 'high',
        reasoning: 'User asks about current president',
        suggestedQuery: 'current president of Indonesia 2025',
        category: 'general',
        recommendToggle: false,
      });

      const result = await ChatWebSearchService.detectWebSearchIntent(query, context);

      expect(result.shouldSearch).toBe(true);
      expect(result.recommendToggle).toBe(false);
    });
  });

  describe('performWebSearch', () => {
    it('should return formatted search results', async () => {
      const query = 'latest AI developments';
      const options = { maxResults: 5, searchDepth: 'advanced' as const };
      const mockResults = '[WEB SEARCH RESULTS]\nPencarian untuk: "latest AI developments"\n...';

      mockedSearchAndFormat.mockResolvedValue(mockResults);

      const result = await ChatWebSearchService.performWebSearch(query, options);

      expect(mockedSearchAndFormat).toHaveBeenCalledWith(query, options);
      expect(result).toBe(mockResults);
    });

    it('should return empty string on error', async () => {
      const query = 'test query';
      const options = {};

      mockedSearchAndFormat.mockRejectedValue(new Error('Search failed'));

      const result = await ChatWebSearchService.performWebSearch(query, options);

      expect(result).toBe('');
    });

    it('should handle empty results gracefully', async () => {
      const query = 'test query';
      mockedSearchAndFormat.mockResolvedValue('');

      const result = await ChatWebSearchService.performWebSearch(query, {});

      expect(result).toBe('');
    });
  });

  describe('buildSystemContent', () => {
    it('should put web search context FIRST, then time, then system prompt', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const timeContext = 'Current time: 2024-01-01 12:00';
      const webSearchContext = 'Search results: AI news...';

      const result = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext, webSearchContext);

      expect(result).toBe(
        `${webSearchContext}\n\n${timeContext}\n\n---\n${systemPrompt}`
      );
    });

    it('should show time context first when no web search', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const timeContext = 'Current time: 2024-01-01 12:00';

      const result = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext, '');

      expect(result).toBe(
        `${timeContext}\n\n---\n${systemPrompt}`
      );
    });

    it('should handle undefined web search context', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const timeContext = 'Current time: 2024-01-01 12:00';

      const result = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext);

      expect(result).toBe(
        `${timeContext}\n\n---\n${systemPrompt}`
      );
    });
  });
});
