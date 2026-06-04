import { searchAndFormat, formatTavilyResults, searchWithTavily } from '@/lib/tavily-search';
import { detectIntentWithAI, IntentDetectionResult } from '@/lib/ai-intent-detector';

export const ChatWebSearchService = {
  /**
   * Detects if the user's message requires web search using AI-based intent detection.
   * Returns IntentDetectionResult with shouldSearch, confidence, reasoning, etc.
   */
  async detectWebSearchIntent(
    query: string,
    context: {
      webSearchEnabled: boolean;
      category?: string;
      conversationHistory?: any[];
      modelId?: string;
    }
  ): Promise<IntentDetectionResult> {
    return context.modelId ? detectIntentWithAI(query, context, context.modelId) : detectIntentWithAI(query, context);
  },

  /**
   * Performs web search using Tavily direct API and formats results for injection into system prompt.
   * Returns formatted string with search results, or empty string if no results.
   */
  async performWebSearch(
    query: string,
    options: {
      maxResults?: number;
      searchDepth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
      category?: string;
    } = {}
  ): Promise<string> {
    try {
      const results = await searchAndFormat(query, options);
      return results;
    } catch (error) {
      console.error('[ChatWebSearchService] Error performing web search:', error);
      return '';
    }
  },

  /**
   * Builds the system content with optional web search context.
   * Web search context dan time diletakkan DI ATAS system prompt kategori
   * agar AI tidak mengabaikannya dan sadar bahwa ia memiliki akses internet.
   */
  buildSystemContent(
    systemPrompt: string,
    timeContext: string,
    webSearchContext: string = ''
  ): string {
    if (webSearchContext) {
      return `${webSearchContext}

${timeContext}

---
${systemPrompt}`;
    }
    return `${timeContext}

---
${systemPrompt}`;
  },
};
