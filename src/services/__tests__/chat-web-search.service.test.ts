import { ChatWebSearchService } from '../chat-web-search.service';
import { webSearchAndFormat, detectWebSearchIntent } from '@/lib/web-search';

// Mock dependencies
jest.mock('@/lib/web-search');

const mockedWebSearchAndFormat = webSearchAndFormat as jest.MockedFunction<typeof webSearchAndFormat>;
const mockedDetectWebSearchIntent = detectWebSearchIntent as jest.MockedFunction<typeof detectWebSearchIntent>;

describe('ChatWebSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectWebSearchIntent', () => {
    it('should return true with high confidence for clear search queries', () => {
      const query = 'What is the latest news about AI?';
      const category = 'assistant';

      mockedDetectWebSearchIntent.mockReturnValue({ shouldSearch: true, confidence: 'high' });

      const result = ChatWebSearchService.detectWebSearchIntent(query, category);

      expect(mockedDetectWebSearchIntent).toHaveBeenCalledWith(query, category);
      expect(result).toEqual({ shouldSearch: true, confidence: 'high' });
    });

    it('should return false for non-search queries', () => {
      const query = 'Hello, how are you?';
      const category = 'assistant';

      mockedDetectWebSearchIntent.mockReturnValue({ shouldSearch: false, confidence: 'low' });

      const result = ChatWebSearchService.detectWebSearchIntent(query, category);

      expect(result).toEqual({ shouldSearch: false, confidence: 'low' });
    });
  });

  describe('performWebSearch', () => {
    it('should return formatted search results', async () => {
      const query = 'latest AI developments';
      const options = { maxResults: 5, searchDepth: 'advanced' as const };
      const mockResults = 'Search results: AI is evolving rapidly...';

      mockedWebSearchAndFormat.mockResolvedValue(mockResults);

      const result = await ChatWebSearchService.performWebSearch(query, options);

      expect(mockedWebSearchAndFormat).toHaveBeenCalledWith(query, options);
      expect(result).toBe(mockResults);
    });

    it('should return empty string on error', async () => {
      const query = 'test query';
      const options = {};

      mockedWebSearchAndFormat.mockRejectedValue(new Error('Search failed'));

      const result = await ChatWebSearchService.performWebSearch(query, options);

      expect(result).toBe('');
    });

    it('should handle empty results gracefully', async () => {
      const query = 'test query';
      mockedWebSearchAndFormat.mockResolvedValue('');

      const result = await ChatWebSearchService.performWebSearch(query, {});

      expect(result).toBe('');
    });
  });

  describe('buildSystemContent', () => {
    it('should combine system prompt, time context, and web search context', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const timeContext = 'Current time: 2024-01-01 12:00';
      const webSearchContext = 'Search results: AI news...';

      const result = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext, webSearchContext);

      expect(result).toBe(
        `${systemPrompt}\n\n${timeContext}\n\n${webSearchContext}`
      );
    });

    it('should omit web search context if empty', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const timeContext = 'Current time: 2024-01-01 12:00';

      const result = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext, '');

      expect(result).toBe(`${systemPrompt}\n\n${timeContext}`);
    });

    it('should handle undefined web search context', () => {
      const systemPrompt = 'You are a helpful assistant.';
      const timeContext = 'Current time: 2024-01-01 12:00';

      const result = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext);

      expect(result).toBe(`${systemPrompt}\n\n${timeContext}`);
    });
  });
});
