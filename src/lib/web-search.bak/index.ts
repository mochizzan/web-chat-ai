// src/lib/web-search/index.ts
// Web Search via OmniRouter MCP StreamableHTTP (SSE Endpoint)
// Semua API key dikelola OmniRouter — tidak perlu API key di project ini
//
// Protokol: MCP JSON-RPC 2.0 via SSE (Server-Sent Events)
// Endpoint: POST /api/mcp/sse
//
// Aliran MCP SSE:
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
// MCP endpoint = http://localhost:20128/api/mcp/sse
const OMNIROUTER_BASE = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTER_API_KEY = process.env.OMNIROUTER_API_KEY || '';

// MCP SSE endpoint — derive from base URL
const MCP_SSE_URL = OMNIROUTER_BASE.replace('/v1', '/api/mcp/sse');

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

  console.log(`[WebSearch] parseMcpResponse: context="${contextLabel}", contentType="${contentType}", isSSE=${isSSE}`);

  // ─── CASE A: JSON response langsung ──────────────────────────
  if (!isSSE) {
    try {
      const data = await response.json();
      console.log(`[WebSearch] parseMcpResponse: JSON response parsed successfully for "${contextLabel}"`);
      return data;
    } catch (jsonErr) {
      // Fallback: coba baca sebagai text untuk debugging
      const rawText = await response.text().catch(() => '<cannot read body>');
      console.error(`[WebSearch] parseMcpResponse: JSON parse failed for "${contextLabel}":`, jsonErr);
      console.error(`[WebSearch] parseMcpResponse: Raw text (first 500 chars):`, rawText.substring(0, 500));
      throw jsonErr;
    }
  }

  // ─── CASE B: SSE response — parse events ─────────────────────
  console.log(`[WebSearch] parseMcpResponse: Processing SSE response for "${contextLabel}"`);
  const rawText = await response.text();
  console.log(`[WebSearch] parseMcpResponse: SSE raw text length=${rawText.length}, first 200 chars:`, rawText.substring(0, 200));

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
      console.log(`[WebSearch] parseMcpResponse: SSE event type="${currentEventType}"`);
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

  console.log(`[WebSearch] parseMcpResponse: Parsed ${eventsParsed.length} SSE events for "${contextLabel}"`);

  if (!lastDataStr) {
    throw new Error(`No JSON data found in SSE response for ${contextLabel}`);
  }

  const parsed = JSON.parse(lastDataStr);
  console.log(`[WebSearch] parseMcpResponse: Final parsed data for "${contextLabel}":`, JSON.stringify(parsed).substring(0, 300));
  return parsed;
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
  console.log('[WebSearch] ensureMcpSession: starting...');
  console.log(`[WebSearch] ensureMcpSession: MCP_SSE_URL=${MCP_SSE_URL}`);
  console.log(`[WebSearch] ensureMcpSession: OMNIROUTER_API_KEY=${OMNIROUTER_API_KEY.substring(0, 15)}...`);
  
  // Jika sudah punya session ID yang valid, return langsung
  if (sessionInitialized && mcpSessionId) {
    console.log(`[WebSearch] ensureMcpSession: using cached session ${mcpSessionId.substring(0, 20)}...`);
    return mcpSessionId;
  }

  const requestId = `init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[WebSearch] ensureMcpSession: new initialization required (requestId=${requestId})`);

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

    console.log(`[WebSearch] ensureMcpSession: POST initialize to ${MCP_SSE_URL}`);
    console.log(`[WebSearch] ensureMcpSession: Request payload:`, JSON.stringify(initPayload));
    const initRes = await fetch(MCP_SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(initPayload),
    });

    console.log(`[WebSearch] ensureMcpSession: initialize response status=${initRes.status} ${initRes.statusText}`);
    // Log all headers for debugging
    const initHeaders: Record<string, string> = {};
    initRes.headers.forEach((value, key) => {
      initHeaders[key] = value;
    });
    console.log(`[WebSearch] ensureMcpSession: Response headers:`, initHeaders);

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => 'unknown error');
      console.error(`[WebSearch] ensureMcpSession: initialize FAILED (${initRes.status}): ${errText.substring(0, 500)}`);
      console.error(`[WebSearch] ensureMcpSession: Full error response:`, errText);
      return null;
    }

    // Extract Mcp-Session-Id dari response header
    const sessionId = initRes.headers.get('Mcp-Session-Id');
    console.log(`[WebSearch] ensureMcpSession: Mcp-Session-Id header = ${sessionId ? sessionId.substring(0, 20) + '...' : 'null'}`);
    
    if (!sessionId) {
      console.error('[WebSearch] ensureMcpSession: No Mcp-Session-Id header in response');
      // Log all headers for debugging
      initRes.headers.forEach((value, key) => {
        console.log(`[WebSearch] ensureMcpSession: Response header "${key}": ${value.substring(0, 100)}`);
      });
      return null;
    }

    mcpSessionId = sessionId;
    console.log(`[WebSearch] ensureMcpSession: Session ID cached: ${sessionId.substring(0, 20)}...`);

    // ─── Step 1b: Parse response body (bisa JSON atau SSE) ────
    const initData = await parseMcpResponse(initRes, 'initialize');
    if (initData?.error) {
      console.error('[WebSearch] ensureMcpSession: initialize response has error:', initData.error);
      mcpSessionId = null;
      return null;
    }

    console.log('[WebSearch] ensureMcpSession: initialize response parsed successfully');

    // ─── Step 2: Kirim initialized notification (fire-and-forget) ─
    const notifPayload = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    fetch(MCP_SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify(notifPayload),
    }).then((notifRes) => {
      console.log(`[WebSearch] ensureMcpSession: notifications/initialized response status=${notifRes.status}`);
    }).catch((err) => {
      console.error('[WebSearch] ensureMcpSession: notifications/initialized error:', err.message);
    });

    sessionInitialized = true;
    console.log('[WebSearch] ensureMcpSession: session initialized successfully');
    return sessionId;
  } catch (error) {
    console.error('[WebSearch] ensureMcpSession: exception:', error);
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
  console.log(`[WebSearch] searchViaOmniRouter: query="${query.substring(0, 80)}", maxResults=${maxResults}, requestId=${requestId}`);
  console.log(`[WebSearch] searchViaOmniRouter: MCP_SSE_URL=${MCP_SSE_URL}`);

  try {
    // ─── Step 1: Pastikan session MCP sudah diinisialisasi ───
    console.log('[WebSearch] searchViaOmniRouter: Step 1 - Ensuring MCP session...');
    const sessionId = await ensureMcpSession();
    if (!sessionId) {
      console.error('[WebSearch] searchViaOmniRouter: FAILED to get session ID');
      return [];
    }
    console.log(`[WebSearch] searchViaOmniRouter: Got session ${sessionId.substring(0, 20)}...`);

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

    console.log(`[WebSearch] searchViaOmniRouter: Step 2 - POST tools/call to ${MCP_SSE_URL}`);
    console.log(`[WebSearch] searchViaOmniRouter: Full payload:`, JSON.stringify(callPayload, null, 2));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const callRes = await fetch(MCP_SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify(callPayload),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    console.log(`[WebSearch] searchViaOmniRouter: tools/call response status=${callRes.status} ${callRes.statusText}`);
    // Log all headers for debugging
    const callHeaders: Record<string, string> = {};
    callRes.headers.forEach((value, key) => {
      callHeaders[key] = value;
    });
    console.log(`[WebSearch] searchViaOmniRouter: Full response headers:`, callHeaders);

    // ─── Step 3: Handle error responses ──────────────────────
    if (callRes.status === 400) {
      const errText = await callRes.text().catch(() => 'unknown error');
      console.error(`[WebSearch] searchViaOmniRouter: 400 Bad Request: ${errText.substring(0, 500)}`);

      // Jika error terkait session, reset cache dan retry sekali
      const sessionRelated =
        errText.includes('Mcp-Session-Id') ||
        errText.includes('session') ||
        errText.includes('Session') ||
        errText.includes('invalid session');

      if (sessionRelated) {
        console.log('[WebSearch] searchViaOmniRouter: Session error detected — reinitializing and retrying...');
        resetMcpSession();
        // Retry sekali dengan session baru (rekursif aman karena resetMcpSession)
        return searchViaOmniRouter(query, options);
      }

      console.error(`[WebSearch] MCP tools/call error ${callRes.status}: ${errText.substring(0, 500)}`);
      return [];
    }

    if (!callRes.ok) {
      const errText = await callRes.text().catch(() => 'unknown error');
      console.error(`[WebSearch] searchViaOmniRouter: HTTP ${callRes.status} ${callRes.statusText}: ${errText.substring(0, 500)}`);
      return [];
    }

    // ─── Step 4: Parse response (bisa JSON atau SSE) ───────────
    console.log('[WebSearch] searchViaOmniRouter: Step 4 - Parsing MCP response...');
    const callData = await parseMcpResponse(callRes, 'tools/call');
    console.log('[WebSearch] searchViaOmniRouter: Response parsed:', JSON.stringify(callData).substring(0, 300));

    // ─── Step 5: Parse MCP response ─────────────────────────
    if (callData?.error) {
      console.error('[WebSearch] searchViaOmniRouter: MCP error in tools/call result:', callData.error);
      return [];
    }

    const result = callData?.result;
    if (!result) {
      console.error('[WebSearch] searchViaOmniRouter: MCP tools/call: no result field in response');
      console.error('[WebSearch] searchViaOmniRouter: Full response:', JSON.stringify(callData).substring(0, 500));
      return [];
    }

    if (result.isError) {
      console.error('[WebSearch] searchViaOmniRouter: MCP tool returned isError=true:', result);
      return [];
    }

    // Parse content items
    const allResults: WebSearchResult[] = [];
    const contentItems = result.content || [];

    console.log(`[WebSearch] searchViaOmniRouter: MCP response has ${contentItems.length} content item(s)`);

    for (const item of contentItems) {
      if (item.type === 'text' && item.text) {
        // Text content bisa berupa JSON string atau teks biasa
        try {
          const parsed = JSON.parse(item.text);
          if (Array.isArray(parsed)) {
            console.log(`[WebSearch] searchViaOmniRouter: Parsed JSON array with ${parsed.length} items`);
            allResults.push(...parsed.map(normalizeResult));
          } else if (parsed.results) {
            console.log(`[WebSearch] searchViaOmniRouter: Parsed JSON object with ${parsed.results.length} results`);
            allResults.push(...parsed.results.map(normalizeResult));
          } else {
            console.log('[WebSearch] searchViaOmniRouter: Parsed JSON but no array or results field:', Object.keys(parsed));
          }
        } catch {
          // Bukan JSON — skip
          console.log('[WebSearch] searchViaOmniRouter: Content item text is not JSON, skipping (text length=' + item.text.length + ')');
        }
      } else {
        console.log(`[WebSearch] searchViaOmniRouter: Content item type="${item.type}", skipping`);
      }
    }

    console.log(`[WebSearch] searchViaOmniRouter: Total parsed results: ${allResults.length}`);
    return allResults;
  } catch (error) {
    console.error('[WebSearch] searchViaOmniRouter: MCP network error:', error);
    if (error instanceof Error) {
      console.error('[WebSearch] searchViaOmniRouter: Error name:', error.name);
      console.error('[WebSearch] searchViaOmniRouter: Error message:', error.message);
      console.error('[WebSearch] searchViaOmniRouter: Stack:', error.stack);
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

  console.log(`[WebSearch] Intent detection: query="${query.substring(0, 80)}", category="${category}"`);

  // ── HIGH confidence triggers ──────────────────────────────
  // Category research selalu search
  if (category === 'research') {
    console.log('[WebSearch] Intent: RESEARCH category → shouldSearch=true (high)');
    return { shouldSearch: true, confidence: 'high' };
  }

  // Keyword eksplisit: "cari di google", "search the web", dll
  const explicitMatch = EXPLICIT_SEARCH_KEYWORDS.find((kw) => lower.includes(kw));
  if (explicitMatch) {
    console.log(`[WebSearch] Intent: EXPLICIT keyword matched "${explicitMatch}" → shouldSearch=true (high)`);
    return { shouldSearch: true, confidence: 'high' };
  }

  // Keyword temporal/fakta: "berita", "harga", "cuaca", "saham", dll
  const temporalMatch = TEMPORAL_KEYWORDS.find((kw) => lower.includes(kw));
  if (temporalMatch) {
    console.log(`[WebSearch] Intent: TEMPORAL keyword matched "${temporalMatch}" → shouldSearch=true (high)`);
    return { shouldSearch: true, confidence: 'high' };
  }

  // ── MEDIUM confidence — tidak trigger web search ──────────
  // Question words + panjang > 40 chars, tapi tetap tidak search
  // (Kandang pengetahuan AI sudah cukup untuk pertanyaan umum)
  //
  // ── DEFAULT: tidak search ─────────────────────────────────
  console.log('[WebSearch] Intent: no triggers matched → shouldSearch=false (low)');
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

/**
 * Debug helper: Test MCP connection manually
 * Usage: import { testMcpConnection } from '@/lib/web-search'; await testMcpConnection();
 */
export async function testMcpConnection(): Promise<void> {
  console.log('=== MCP Connection Test ===');
  console.log(`MCP URL: ${MCP_SSE_URL}`);
  console.log(`API Key: ${OMNIROUTER_API_KEY.substring(0, 10)}...`);
  console.log('');

  // Test 1: Initialize
  console.log('Test 1: Initialize session...');
  const sessionId = await ensureMcpSession();
  if (!sessionId) {
    console.error('❌ FAILED: Could not initialize session');
    return;
  }
  console.log(`✅ Session initialized: ${sessionId.substring(0, 20)}...`);
  console.log('');

  // Test 2: List tools
  console.log('Test 2: List available tools...');
  try {
    const listPayload = {
      jsonrpc: '2.0',
      id: `list-${Date.now()}`,
      method: 'tools/list',
    };

    const listRes = await fetch(MCP_SSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify(listPayload),
    });

    console.log(`Response status: ${listRes.status} ${listRes.statusText}`);
    const listData = await parseMcpResponse(listRes, 'tools/list');
    console.log('Available tools:', JSON.stringify(listData, null, 2));
  } catch (err) {
    console.error('❌ FAILED to list tools:', err);
  }
  console.log('');

  // Test 3: Test search
  console.log('Test 3: Test web search...');
  const results = await searchViaOmniRouter('test query', { maxResults: 1 });
  console.log(`Results: ${results.length} items`);
  if (results.length > 0) {
    console.log('First result:', JSON.stringify(results[0], null, 2));
  }
  console.log('');

  console.log('=== Test Complete ===');
}
