// src/lib/web-search/index.ts
// Web Search via OmniRouter MCP StreamableHTTP
// Semua API key dikelola OmniRouter — tidak perlu API key di project ini
//
// Protokol: MCP JSON-RPC 2.0 via StreamableHTTP
// Endpoint: POST /api/mcp/stream
//
// Aliran MCP StreamableHTTP:
//   1. POST initialize → dapatkan Mcp-Session-Id dari response header
//   2. POST tools/call dengan header Mcp-Session-Id
//   3. (OPSIONAL) POST initialized notification
//
// CATATAN: Server bisa meresponse dengan JSON (application/json) ATAU SSE (text/event-stream).
// Helper parseMcpResponse() menangani kedua format secara transparan.

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  source: string;
}

export interface WebSearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

// Derive MCP URL dari OMNIROUTER_BASE_URL
// OMNIROUTER_BASE_URL = http://localhost:20128/v1
// MCP endpoint = http://localhost:20128/api/mcp/stream
const OMNIROUTER_BASE = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTER_API_KEY = process.env.OMNIROUTER_API_KEY || '';

// MCP StreamableHTTP endpoint — derive from base URL
const MCP_STREAM_URL = OMNIROUTER_BASE.replace('/v1', '/api/mcp/stream');

// ─── MCP Session Cache ─────────────────────────────────────────
let mcpSessionId: string | null = null;
let sessionInitialized = false;

/**
 * Helper: Parse MCP StreamableHTTP response yang bisa berupa JSON atau SSE.
 *
 * MCP Server dapat meresponse dengan dua cara:
 *   A. Content-Type: application/json → body langsung JSON
 *   B. Content-Type: text/event-stream → body adalah SSE events, JSON ada di field "data:"
 *
 * Fungsi ini mendeteksi Content-Type dan memproses sesuai format.
 *
 * @param response - Fetch Response object
 * @param contextLabel - Label untuk logging (e.g., 'initialize', 'tools/call')
 * @returns Parsed JSON-RPC response object
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function parseMcpResponse(response: Response, contextLabel: string): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const isSSE = contentType.includes('text/event-stream') || contentType.includes('text/plain');

  // ─── CASE A: JSON response langsung ──────────────────────────
  if (!isSSE) {
    try {
      const data = await response.json();
      return data;
    } catch (jsonErr) {
      // Fallback: coba baca sebagai text untuk debugging
      const rawText = await response.text().catch(() => '<cannot read body>');
      throw jsonErr;
    }
  }

  // ─── CASE B: SSE response — parse events ─────────────────────
  const rawText = await response.text();

  // Parse semua event SSE. Format:
  //   event: message
  //   data: {"jsonrpc":"2.0","id":"...","result":{...}}
  //
  //   event: message
  //   data: {"jsonrpc":"2.0","id":"...","result":{"content":[...]}}
  //
  // Events dipisahkan oleh \n\n (blank line)

  // Variabel untuk tracking
  let lastDataStr: string | null = null;
  let currentEventType = '';
  const eventsParsed: Array<{ event: string; data: string }> = [];
  let dataAccumulator = '';

  const lines = rawText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('event: ')) {
      currentEventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      const dataStr: string = line.slice(6).trim();
      if (dataStr) {
        dataAccumulator += dataStr;
        // Coba parse tiap data line sebagai JSON
        try {
          JSON.parse(dataAccumulator);
          eventsParsed.push({ event: currentEventType || 'message', data: dataAccumulator });
          lastDataStr = dataAccumulator;
          dataAccumulator = '';
        } catch {
          // Mungkin data multi-line JSON, akumulasi dulu
        }
      }
    } else if (line === '') {
      // Blank line = end of event
      if (dataAccumulator) {
        try {
          JSON.parse(dataAccumulator);
          eventsParsed.push({ event: currentEventType || 'message', data: dataAccumulator });
          lastDataStr = dataAccumulator;
        } catch {
          // Ignore incomplete
        }
        dataAccumulator = '';
      }
      currentEventType = '';
    }
  }

  // Handle remaining accumulator
  if (dataAccumulator) {
    try {
      JSON.parse(dataAccumulator);
      eventsParsed.push({ event: currentEventType || 'message', data: dataAccumulator });
      lastDataStr = dataAccumulator;
    } catch {
      // Ignore incomplete
    }
  }

  if (!lastDataStr) {
    throw new Error(`No JSON data found in SSE response for ${contextLabel}`);
  }

  return JSON.parse(lastDataStr);
}

/**
 * Inisialisasi session MCP StreamableHTTP.
 *
 * Aliran:
 *  1. Kirim { jsonrpc: "2.0", method: "initialize", ... }
 *  2. Response header mengandung "Mcp-Session-Id"
 *  3. Kirim notifikasi "notifications/initialized" (fire-and-forget)
 *
 * Session di-cache untuk reuse selama proses masih hidup.
 */
async function ensureMcpSession(): Promise<string | null> {
  // Jika sudah punya session ID yang valid, return langsung
  if (sessionInitialized && mcpSessionId) {
    return mcpSessionId;
  }

  const requestId = `init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // ─── Step 1: Kirim initialize request ────────────────────
    const initPayload = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'initialize',
      params: {
        protocolVersion: '0.1.0',
        capabilities: {},
        clientInfo: {
          name: 'ai-chat-web',
          version: '1.0.0',
        },
      },
    };

    const initRes = await fetch(MCP_STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(initPayload),
    });

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => 'unknown error');
      return null;
    }

    // Extract Mcp-Session-Id dari response header
    const sessionId = initRes.headers.get('Mcp-Session-Id');
    if (!sessionId) {
      return null;
    }

    mcpSessionId = sessionId;

    // ─── Step 1b: Parse response body (bisa JSON atau SSE) ────
    const initData = await parseMcpResponse(initRes, 'initialize');
    if (initData?.error) {
      mcpSessionId = null;
      return null;
    }

    // ─── Step 2: Kirim initialized notification (fire-and-forget) ─
    const notifPayload = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    fetch(MCP_STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify(notifPayload),
    }).then((notifRes) => {
    }).catch((err) => {
    });

    sessionInitialized = true;
    return sessionId;
  } catch (error) {
    return null;
  }
}

/**
 * Reset session cache — panggil jika session expired / server restart.
 */
function resetMcpSession(): void {
  if (mcpSessionId || sessionInitialized) {
    mcpSessionId = null;
    sessionInitialized = false;
  }
}

/**
 * Panggil MCP tool omniroute_web_search via StreamableHTTP
 * Menggunakan protokol MCP JSON-RPC 2.0 dengan session management.
 *
 * Format request:
 *   { jsonrpc: "2.0", id: "...", method: "tools/call",
 *     params: { name: "omniroute_web_search", arguments: { query, max_results } } }
 *
 * Format response:
 *   { jsonrpc: "2.0", id: "...", result: { content: [...], isError: false } }
 *
 * Retry logic:
 *   - Jika error 400 terkait session → reset cache + retry sekali
 *   - Network error → reset cache + return empty
 */
export async function searchViaOmniRouter(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  const maxResults = options.maxResults || 5;
  const requestId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // ─── Step 1: Pastikan session MCP sudah diinisialisasi ───
    const sessionId = await ensureMcpSession();
    if (!sessionId) {
      return [];
    }

    // ─── Step 2: Kirim tools/call dengan session header ──────
    const callPayload = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'omniroute_web_search',
        arguments: {
          query,
          max_results: maxResults,
          search_depth: options.searchDepth || 'advanced',
        },
      },
    };

    const callRes = await fetch(MCP_STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify(callPayload),
    });

    // ─── Step 3: Handle error responses ──────────────────────
    if (callRes.status === 400) {
      const errText = await callRes.text().catch(() => 'unknown error');

      // Jika error terkait session, reset cache dan retry sekali
      const sessionRelated =
        errText.includes('Mcp-Session-Id') ||
        errText.includes('session') ||
        errText.includes('Session') ||
        errText.includes('invalid session');

      if (sessionRelated) {
        console.log('[WebSearch] Session error detected — reinitializing and retrying...');
        resetMcpSession();
        // Retry sekali dengan session baru (rekursif aman karena resetMcpSession)
        return searchViaOmniRouter(query, options);
      }

      console.error(`[WebSearch] MCP tools/call error ${callRes.status}: ${errText.substring(0, 500)}`);
      return [];
    }

    if (!callRes.ok) {
      const errText = await callRes.text().catch(() => 'unknown error');
      console.error(`[WebSearch] MCP tools/call error ${callRes.status}: ${errText.substring(0, 500)}`);
      return [];
    }

    // ─── Step 4: Parse response (bisa JSON atau SSE) ───────────
    const callData = await parseMcpResponse(callRes, 'tools/call');

    // ─── Step 5: Parse MCP response ─────────────────────────
    if (callData?.error) {
      console.error('[WebSearch] MCP error in tools/call result:', callData.error);
      return [];
    }

    const result = callData?.result;
    if (!result) {
      console.error('[WebSearch] MCP tools/call: no result field in response');
      console.error('[WebSearch] Full response:', JSON.stringify(callData).substring(0, 500));
      return [];
    }

    if (result.isError) {
      console.error('[WebSearch] MCP tool returned isError=true:', result);
      return [];
    }

    // Parse content items
    const allResults: WebSearchResult[] = [];
    const contentItems = result.content || [];

    console.log(`[WebSearch] MCP response has ${contentItems.length} content item(s)`);

    for (const item of contentItems) {
      if (item.type === 'text' && item.text) {
        // Text content bisa berupa JSON string atau teks biasa
        try {
          const parsed = JSON.parse(item.text);
          if (Array.isArray(parsed)) {
            console.log(`[WebSearch] Parsed JSON array with ${parsed.length} items`);
            allResults.push(...parsed.map(normalizeResult));
          } else if (parsed.results) {
            console.log(`[WebSearch] Parsed JSON object with ${parsed.results.length} results`);
            allResults.push(...parsed.results.map(normalizeResult));
          } else {
            console.log('[WebSearch] Parsed JSON but no array or results field:', Object.keys(parsed));
          }
        } catch {
          // Bukan JSON — skip
          console.log('[WebSearch] Content item text is not JSON, skipping (text length=' + item.text.length + ')');
        }
      } else {
        console.log(`[WebSearch] Content item type="${item.type}", skipping`);
      }
    }

    console.log(`[WebSearch] Total parsed results: ${allResults.length}`);
    return allResults;
  } catch (error) {
    console.error('[WebSearch] MCP network error:', error);
    if (error instanceof Error) {
      console.error('[WebSearch] Error name:', error.name);
      console.error('[WebSearch] Error message:', error.message);
      console.error('[WebSearch] Stack:', error.stack);
    }
    // Reset session on network error — mungkin server restart
    resetMcpSession();
    return [];
  }
}

function normalizeResult(r: any): WebSearchResult {
   
  return {
    title: r.title || r.name || 'No title',
    url: r.url || r.link || '',
    content: r.content || r.snippet || r.description || '',
    score: r.score || r.relevance || r.relevance_score || 0,
    publishedDate: r.published_date || r.publishedDate || r.date || undefined,
    source: r.source || r.engine || r.provider || 'web',
  };
}

/**
 * Deteksi apakah query butuh web search berdasarkan keyword
 * 
 * Level confidence:
 * - high: keyword temporal/eksplisit → langsung search
 * - medium: question words + proper noun / query panjang → search
 * - low: skip search
 */
const TEMPORAL_KEYWORDS = [
  'berita', 'news', 'terbaru', 'latest', 'hari ini', 'today',
  'tadi malam', 'yesterday', 'this week', 'this month',
  'sekarang', 'currently', 'real-time', 'real time',
  'cuaca', 'weather', 'harga', 'price', 'saham', 'stock',
  'nilai tukar', 'exchange rate', 'kurs', 'bitcoin', 'crypto',
  'update', 'current', 'perkiraan', 'forecast', 'prediksi',
];

const EXPLICIT_SEARCH_KEYWORDS = [
  'cari di google', 'search google', 'cari di internet',
  'googling', 'search the web', 'look up', 'cari tahu',
  'google it', 'search for', 'cari di web',
];

export function detectWebSearchIntent(
  query: string,
  category: string
): { shouldSearch: boolean; confidence: 'high' | 'low' } {
  const lower = query.toLowerCase().trim();

  // ── HIGH confidence triggers ──────────────────────────────
  // Category research selalu search
  if (category === 'research') {
    return { shouldSearch: true, confidence: 'high' };
  }

  // Keyword eksplisit: "cari di google", "search the web", dll
  if (EXPLICIT_SEARCH_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { shouldSearch: true, confidence: 'high' };
  }

  // Keyword temporal/fakta: "berita", "harga", "cuaca", "saham", dll
  if (TEMPORAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { shouldSearch: true, confidence: 'high' };
  }

  // ── MEDIUM confidence — tidak trigger web search ──────────
  // Question words + panjang > 40 chars, tapi tetap tidak search
  // (Kandang pengetahuan AI sudah cukup untuk pertanyaan umum)
  //
  // ── DEFAULT: tidak search ─────────────────────────────────
  return { shouldSearch: false, confidence: 'low' };
}

/**
 * Format hasil search jadi string untuk di-inject ke system prompt
 */
export function formatSearchResults(results: WebSearchResult[], query: string): string {
  if (results.length === 0) return '';

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
Skor Relevansi: ${(r.score * 100).toFixed(0)}%`
  )
  .join('\n\n')}
[/WEB SEARCH RESULTS]

Instruksi: Gunakan informasi di ATAS untuk menjawab pertanyaan user.
- Selalu sebutkan sumber URL jika menggunakan informasi dari web search.
- Jika tidak ada informasi yang relevan dari web search, jawab berdasarkan pengetahuan sendiri.
- Jika hasil web search tidak cukup, akui saja dan jangan berasumsi.`;
}

/**
 * Main function: detect intent → search via OmniRouter → format
 */
export async function webSearchAndFormat(
  query: string,
  options: WebSearchOptions & { category?: string } = {}
): Promise<string> {
  const { category, ...searchOpts } = options;

  const intent = detectWebSearchIntent(query, category || 'chat');
  if (!intent.shouldSearch) {
    console.log(`[WebSearch] Intent detection: SKIP (confidence=${intent.confidence})`);
    return '';
  }

  console.log(`[WebSearch] Searching via OmniRouter: "${query.substring(0, 50)}..." (confidence: ${intent.confidence})`);

  const results = await searchViaOmniRouter(query, searchOpts);
  if (results.length === 0) {
    console.log('[WebSearch] No results from OmniRouter');
    return '';
  }

  console.log(`[WebSearch] Got ${results.length} results`);
  return formatSearchResults(results, query);
}
