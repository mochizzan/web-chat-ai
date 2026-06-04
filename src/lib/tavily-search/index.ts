// src/lib/tavily-search/index.ts
// Tavily Direct API Integration — bypasses MCP OmniRouter entirely
// Base URL: https://api.tavily.com
// Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search
//
// Fitur:
//  - Direct API call ke Tavily (tanpa MCP)
//  - API Key Load Balancer dengan failover otomatis
//  - Support search dengan parameter: query, max_results, search_depth, topic
//  - Format results sesuai format sistem
//  - Error handling yang jelas
//  - Logging lengkap untuk debugging

const TAVILY_BASE_URL = 'https://api.tavily.com';

// ─── Load API Keys dari Environment Variables ─────────────────────
function getTavilyApiKeys(): string[] {
  const keys: string[] = [];
  // Coba TAVILY_API_KEY_1, TAVILY_API_KEY_2, ... TAVILY_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`TAVILY_API_KEY_${i}`];
    if (key && key.trim().length > 0) {
      keys.push(key.trim());
    }
  }
  // Fallback: TAVILY_API_KEY (single key tanpa nomor)
  const singleKey = process.env.TAVILY_API_KEY;
  if (singleKey && singleKey.trim().length > 0 && !keys.includes(singleKey.trim())) {
    keys.push(singleKey.trim());
  }
  return keys;
}

// ─── Load Balancer State ──────────────────────────────────────────
let currentKeyIndex = 0;
let failedCount = 0;
const MAX_RETRIES = 3;

/**
 * Reset load balancer state — panggil jika perlu reset cycle
 */
export function resetTavilyLoadBalancer(): void {
  currentKeyIndex = 0;
  failedCount = 0;
}

/**
 * Dapatkan API key berikutnya dengan round-robin + failover
 * Jika key saat ini gagal, pindah ke key berikutnya
 */
function getNextApiKey(apiKeys: string[]): { key: string; index: number } | null {
  if (apiKeys.length === 0) {
    console.error('[TavilySearch] No API keys available. Set TAVILY_API_KEY_1, TAVILY_API_KEY_2, etc.');
    return null;
  }

  const key = apiKeys[currentKeyIndex];
  console.log(`[TavilySearch] Using API key index=${currentKeyIndex} (${key.substring(0, 10)}...)`);
  return { key, index: currentKeyIndex };
}

/**
 * Tandai key saat ini sebagai gagal dan pindah ke key berikutnya
 */
function markKeyAsFailed(apiKeys: string[]): void {
  failedCount++;
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  console.log(`[TavilySearch] Key index ${currentKeyIndex === 0 ? apiKeys.length - 1 : currentKeyIndex - 1} marked as failed. Moving to index=${currentKeyIndex}. Failed count=${failedCount}`);
}

// ─── Interfaces ───────────────────────────────────────────────────
export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  source: string;
  images?: { url: string; description?: string }[];
}

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  topic?: 'general' | 'news' | 'finance';
  timeRange?: 'day' | 'week' | 'month' | 'year';
  includeAnswer?: boolean;
  country?: string;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  images: unknown[];
  response_time: string;
  auto_parameters?: {
    topic: string;
    search_depth: string;
  };
  usage: {
    credits: number;
  };
  request_id: string;
}

// ─── Main Search Function with Load Balancer ──────────────────────
export async function searchWithTavily(
  query: string,
  options: TavilySearchOptions = {}
): Promise<{
  results: TavilySearchResult[];
  usedKeyIndex: number;
  answer?: string;
  usage?: { credits: number };
  request_id?: string;
  auto_parameters?: { topic: string; search_depth: string };
}> {
  const apiKeys = getTavilyApiKeys();
  if (apiKeys.length === 0) {
    console.error('[TavilySearch] No API keys configured');
    return { results: [], usedKeyIndex: -1 };
  }

  const maxResults = options.maxResults || 5;
  const searchDepth = options.searchDepth || 'advanced';
  const topic = options.topic || 'general';
  const includeAnswer = options.includeAnswer || false;

  console.log(`[TavilySearch] searchWithTavily: query="${query.substring(0, 80)}", maxResults=${maxResults}, searchDepth=${searchDepth}, topic=${topic}`);

  let lastError: Error | null = null;

  // Coba sampai max MAX_RETRIES kali, bisa dengan API key berbeda tiap percobaan
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const keyInfo = getNextApiKey(apiKeys);
    if (!keyInfo) {
      return { results: [], usedKeyIndex: -1 };
    }

    const { key, index } = keyInfo;

    try {
      console.log(`[TavilySearch] Attempt ${attempt}/${MAX_RETRIES} with key index=${index}`);

      const response = await fetch(`${TAVILY_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: searchDepth,
          topic,
          time_range: options.timeRange,
          include_answer: includeAnswer,
          include_raw_content: false,
          include_images: true,
          country: options.country,
        }),
      });

      console.log(`[TavilySearch] Response status=${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        const errorMsg = `Tavily API error ${response.status}: ${errorText.substring(0, 300)}`;
        console.error(`[TavilySearch] ${errorMsg}`);

        // Retry untuk rate limit (429), auth error (401), dan server errors (5xx)
        if (response.status === 429 || response.status === 401 || response.status >= 500) {
          if (response.status >= 500) {
            console.warn(`[TavilySearch] Server error ${response.status} pada attempt ${attempt}, retrying...`);
          } else {
            console.log(`[TavilySearch] Key index=${index} failed (${response.status}), trying next key...`);
          }
          markKeyAsFailed(apiKeys);
          lastError = new Error(errorMsg);
          continue;
        }

        // Error lain, tidak retry
        return { results: [], usedKeyIndex: index, answer: undefined };
      }

      // Parse response
      const data: TavilySearchResponse = await response.json();
      console.log(`[TavilySearch] Got ${data.results?.length || 0} results, answer=${data.answer ? 'yes' : 'no'}`);
      console.log(`[TavilySearch] request_id=${data.request_id}, usage.credits=${data.usage?.credits ?? 'N/A'}, auto_parameters=${JSON.stringify(data.auto_parameters)}`);

      // Reset failed count on success
      failedCount = 0;

      return {
        results: data.results || [],
        usedKeyIndex: index,
        answer: data.answer,
        usage: data.usage,
        request_id: data.request_id,
        auto_parameters: data.auto_parameters,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TavilySearch] Attempt ${attempt} network error:`, errorMsg);

      // Network error, coba key berikutnya
      if (attempt < MAX_RETRIES) {
        markKeyAsFailed(apiKeys);
        lastError = error instanceof Error ? error : new Error(errorMsg);
        continue;
      }

      lastError = error instanceof Error ? error : new Error(errorMsg);
    }
  }

  // Semua percobaan gagal
  console.error(`[TavilySearch] All ${MAX_RETRIES} attempts failed. Last error:`, lastError?.message);
  return { results: [], usedKeyIndex: -1, answer: undefined };
}

// ─── Format Results ───────────────────────────────────────────────
export function formatTavilyResults(results: TavilySearchResult[], query: string): string {
  if (results.length === 0) return '';

  function formatImages(images: { url: string; description?: string }[] | undefined): string {
    if (!images || images.length === 0) return '';
    return images
      .map((img, idx) => {
        const desc = img.description ? ` - ${img.description}` : '';
        return `    [Image ${idx + 1}]: ${img.url}${desc}`;
      })
      .join('\n');
  }

  return `

[WEB SEARCH RESULTS]
Pencarian untuk: "${query}"
${results
  .map(
    (r, i) =>
      `[${i + 1}] ${r.title}
URL: ${r.url}
Konten: ${r.content.substring(0, 1500)}
${r.publishedDate ? `Tanggal: ${r.publishedDate}` : ''}
Skor Relevansi: ${(r.score * 100).toFixed(0)}%
${r.images && r.images.length > 0 ? `Gambar:\n${formatImages(r.images)}` : ''}`
  )
  .join('\n\n')}
[/WEB SEARCH RESULTS]

Instruksi: Gunakan informasi di ATAS untuk menjawab pertanyaan user.
- Selalu sebutkan sumber URL jika menggunakan informasi dari web search.
- Jika tidak ada informasi yang relevan dari web search, jawab berdasarkan pengetahuan sendiri.
- Jika hasil web search tidak cukup, akui saja dan jangan berasumsi.`;
}

// ─── Main Function: Search + Format ──────────────────────────────
export async function searchAndFormat(
  query: string,
  options: TavilySearchOptions & { category?: string } = {}
): Promise<string> {
  const { category, ...searchOpts } = options;

  console.log(`[TavilySearch] searchAndFormat: query="${query.substring(0, 80)}", category=${category}`);

  const { results, answer } = await searchWithTavily(query, searchOpts);

  if (results.length === 0 && !answer) {
    console.log('[TavilySearch] No results found');
    return '';
  }

  // Jika ada answer dari Tavily, tambahkan di awal
  let formatted = formatTavilyResults(results, query);
  if (answer) {
    formatted = `[TAVILY ANSWER]\n${answer}\n\n${formatted}`;
  }

  console.log(`[TavilySearch] Formatted ${results.length} results${answer ? ' + answer' : ''}`);
  return formatted;
}

// ─── Debug Helper ─────────────────────────────────────────────────
export async function testTavilyConnection(): Promise<void> {
  console.log('=== Tavily Connection Test ===');
  console.log(`Base URL: ${TAVILY_BASE_URL}`);
  const keys = getTavilyApiKeys();
  console.log(`API Keys available: ${keys.length}`);
  keys.forEach((k, i) => {
    console.log(`  Key ${i + 1}: ${k.substring(0, 10)}...`);
  });
  console.log('');

  if (keys.length === 0) {
    console.error('❌ FAILED: No API keys configured');
    return;
  }

  // Test 1: Simple search
  console.log('Test 1: Simple search...');
  const result = await searchWithTavily('Who is Leo Messi?', { maxResults: 1, searchDepth: 'basic' });
  console.log(`Results: ${result.results.length} items`);
  if (result.results.length > 0) {
    console.log('First result:', JSON.stringify(result.results[0], null, 2));
  } else {
    console.log('No results returned');
  }
  console.log('');

  console.log('=== Test Complete ===');
}
