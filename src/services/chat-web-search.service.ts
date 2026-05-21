import { webSearchAndFormat, detectWebSearchIntent } from '@/lib/web-search';

export const ChatWebSearchService = {
  /**
   * Detects if the user's message requires web search.
   * Returns { shouldSearch: boolean, confidence: 'high' | 'low' }
   */
  detectWebSearchIntent(query: string, category: string) {
    return detectWebSearchIntent(query, category);
  },

  /**
   * Performs web search and formats results for injection into system prompt.
   * Returns formatted string with search results, or empty string if no results.
   */
  async performWebSearch(
    query: string,
    options: {
      maxResults?: number;
      searchDepth?: 'basic' | 'advanced';
      category?: string;
    } = {}
  ): Promise<string> {
    try {
      const results = await webSearchAndFormat(query, options);
      return results;
    } catch (error) {
      console.error('[ChatWebSearchService] Error performing web search:', error);
      return '';
    }
  },

  /**
   * Builds the system content with optional web search context.
   */
  buildSystemContent(
    systemPrompt: string,
    timeContext: string,
    webSearchContext: string = ''
  ): string {
    return webSearchContext
      ? `${systemPrompt}\n\n${timeContext}\n\n${webSearchContext}`
      : `${systemPrompt}\n\n${timeContext}`;
  },
};
