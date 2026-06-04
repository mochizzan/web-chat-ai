import { ChatUsageTrackingService } from '@/services/chat-usage-tracking.service';

const OMNIROUTER_BASE = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTER_API_KEY = process.env.OMNIROUTER_API_KEY || '';

export interface IntentDetectionResult {
  shouldSearch: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  recommendToggle?: boolean;
  suggestedQuery?: string;
  category?: string;
}

export interface IntentDetectionContext {
  webSearchEnabled: boolean;
  category?: string;
  conversationHistory?: any[];
}

const INTENT_DETECTION_SYSTEM_PROMPT = `Kamu adalah AI Intent Detector yang menganalisis pesan user untuk menentukan apakah perlu web search.

TUGAS KAMU:
Analisis pesan user dan tentukan apakah membutuhkan pencarian di web untuk memberikan jawaban yang akurat dan terkini.

KRITERIA PERLU WEB SEARCH (shouldSearch = true):
1. **Pertanyaan tentang informasi terkini/real-time**: berita hari ini, harga saham, cuaca, nilai tukar, update terbaru
2. **Pertanyaan faktual spesifik yang bisa berubah**: "berapa harga bitcoin sekarang", "siapa presiden RI saat ini"
3. **Permintaan eksplisit untuk mencari**: "cari aku", "tolong cari", "search for", "look up"
4. **Pertanyaan tentang peristiwa terkini**: "apa kabar terbaru", "ada berita apa hari ini"
5. **Pertanyaan membutuhkan data real-time**: jadwal penerbangan, harga barang, skor pertandingan live
6. **Kategori research**: jika category adalah "research", selalu anggap perlu search

KRITERIA TIDAK PERLU WEB SEARCH (shouldSearch = false):
1. **Percakapan umum**: "halo", "apa kabar", "terima kasih"
2. **Pertanyaan pengetahuan umum yang stabil**: "apa itu AI", "jelaskan tentang photosynthesis"
3. **Permintaan coding/writing**: "buatkan kode", "tulis essay", "buat desain"
4. **Pertanyaan tentang konteks percakapan sebelumnya**: "lanjutkan", "jelaskan lebih detail"
5. **Pertanyaan matematika/logika**: "berapa 2+2", "solve this problem"

ATURAN PENTING:
- Jika webSearchEnabled = false DAN pesan user MEMBUTUHKAN web search → set recommendToggle = true
- Jika webSearchEnabled = true → set recommendToggle = false (atau tidak diset)
- Selalu berikan reasoning yang jelas mengapa perlu atau tidak perlu search
- Jika perlu search, optimalkan query menjadi bahasa Inggris yang jelas dan spesifik
- Confidence level: "high" jika sangat jelas, "medium" jika agak ragu, "low" jika tidak yakin

FORMAT RESPONSE (JSON SAJA, TANPA PENJELASAN LAIN):
{
  "shouldSearch": true/false,
  "confidence": "high"/"medium"/"low",
  "reasoning": "alasan mengapa perlu atau tidak perlu search",
  "recommendToggle": true/false,
  "suggestedQuery": "query yang dioptimalkan dalam bahasa Inggris",
  "category": "general"/"news"/"finance"
}`;

export async function detectIntentWithAI(
  userMessage: string,
  context: IntentDetectionContext,
  modelId?: string
): Promise<IntentDetectionResult> {
  const { webSearchEnabled, category, conversationHistory } = context;

  console.log(`[IntentDetector] detectIntentWithAI: message="${userMessage.substring(0, 80)}", webSearchEnabled=${webSearchEnabled}, category=${category}`);

  let historyContext = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-6);
    historyContext = recentHistory
      .map((msg) => `[${msg.role}]: ${msg.content.substring(0, 200)}`)
      .join('\n');
  }

  const userPrompt = `Konteks percakapan sebelumnya (jika ada):
${historyContext || 'Tidak ada konteks sebelumnya'}

Kategori percakapan: ${category || 'chat'}

Status Web Search: ${webSearchEnabled ? 'NYALA (aktif)' : 'MATI (non-aktif)'}

Pesan user yang perlu dianalisis:
"${userMessage}"

Analisis pesan di atas dan berikan decision JSON sesuai format yang diminta.`;

  // Wrap fetch with retry logic
  async function attemptFetch(retryCount = 0): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${OMNIROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelId || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: INTENT_DETECTION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 300,
          stream: false,
        }),
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    const response = await attemptFetch();

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error(`[IntentDetector] OmniRouter error ${response.status}:`, errorText.substring(0, 300));
      console.warn(`[IntentDetector] Fallback to keyword matching due to API error ${response.status}`);
      return fallbackKeywordDetection(userMessage, webSearchEnabled);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Log raw response for debugging
    console.log('[IntentDetector] Raw LLM response:', JSON.stringify(data).substring(0, 500));

    let jsonStr = content.trim();

    // Retry once if empty response
    if (!jsonStr) {
      console.warn('[IntentDetector] Empty response from LLM, retrying once...');
      const retryResponse = await attemptFetch();

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryContent = retryData.choices?.[0]?.message?.content || '';
        jsonStr = retryContent.trim();
        console.log('[IntentDetector] Retry raw response:', JSON.stringify(retryData).substring(0, 500));
      }

      if (!jsonStr) {
        throw new Error('Empty response from LLM');
      }
    }

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    jsonStr = jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonStr) as IntentDetectionResult;

      // Field mapping: handle LLMs that return "should" instead of "shouldSearch"
      if ('should' in parsed && !('shouldSearch' in parsed)) {
        (parsed as any).shouldSearch = (parsed as any).should;
      }

      if (typeof parsed.shouldSearch !== 'boolean') {
        throw new Error('Invalid shouldSearch field');
      }

      if (parsed.shouldSearch && !webSearchEnabled) {
        parsed.recommendToggle = true;
      } else if (webSearchEnabled) {
        parsed.recommendToggle = false;
      }

      console.log(`[IntentDetector] Decision: shouldSearch=${parsed.shouldSearch}, confidence=${parsed.confidence}, recommendToggle=${parsed.recommendToggle}`);

      return parsed;
    } catch (parseError) {
      console.error('[IntentDetector] Failed to parse LLM response as JSON:', jsonStr.substring(0, 200));
      console.error('[IntentDetector] Parse error:', parseError);

      const lowerContent = content.toLowerCase();
      const shouldSearch = lowerContent.includes('"shouldsearch": true') || lowerContent.includes('shouldsearch: true');

      return {
        shouldSearch,
        confidence: 'low',
        reasoning: 'Failed to parse AI response, using text-based fallback',
        recommendToggle: shouldSearch && !webSearchEnabled ? true : false,
      };
    }
  } catch (error) {
    console.error('[IntentDetector] Network error:', error);
    console.warn('[IntentDetector] Fallback to keyword matching due to network error');
    return fallbackKeywordDetection(userMessage, webSearchEnabled);
  }
}

function fallbackKeywordDetection(
  userMessage: string,
  webSearchEnabled: boolean
): IntentDetectionResult {
  const lowerMessage = userMessage.toLowerCase();

  const searchKeywords = [
    'cari', 'carikan', 'tolong cari', 'mencari', 'cariin',
    'berita', 'berita terbaru', 'berita hari ini', 'info terbaru',
    'harga', 'harga saham', 'harga bitcoin', 'harga emas',
    'cuaca', 'perkiraan cuaca', 'ramalan cuaca',
    'siapa presiden', 'siapa ketua', 'siapa gubernur',
    'jadwal', 'jadwal penerbangan', 'jadwal kereta',
    'skor', 'skor pertandingan', 'hasil pertandingan',
    'nilai tukar', 'kurs', 'kurs rupiah',
    'update terbaru', 'terbaru', 'terkini', 'kabar terbaru',
    'ada berita', 'apa kabar', 'info hari ini',
    'search', 'find', 'look up', 'look for',
    'news', 'latest news', 'breaking news', 'today news',
    'weather', 'forecast',
    'stock price', 'bitcoin price', 'crypto price',
    'who is', 'who are',
    'schedule', 'flight schedule',
    'score', 'match result',
    'exchange rate', 'currency',
    'latest', 'recent', 'current',
  ];

  const noSearchKeywords = [
    'halo', 'hai', 'apa kabar', 'terima kasih', 'thanks',
    'buatkan kode', 'tulis kode', 'buat desain', 'tulis essay',
    'jelaskan', 'penjelasan', 'apa itu', 'mengapa',
    'lanjutkan', 'lebih detail', 'tambahkan',
    'berapa 2+2', 'solve this', 'hitung',
  ];

  for (const keyword of noSearchKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        shouldSearch: false,
        confidence: 'medium',
        reasoning: `Fallback: pesan mengandung kata kunci "${keyword}" yang tidak perlu web search`,
      };
    }
  }

  for (const keyword of searchKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        shouldSearch: true,
        confidence: 'medium',
        reasoning: `Fallback: pesan mengandung kata kunci "${keyword}" yang membutuhkan web search`,
        recommendToggle: !webSearchEnabled,
        suggestedQuery: userMessage,
        category: 'general',
      };
    }
  }

  return {
    shouldSearch: false,
    confidence: 'low',
    reasoning: 'Fallback: tidak ada kata kunci yang cocok, default tidak search',
  };
}

export async function testIntentDetection(): Promise<void> {
  console.log('=== Intent Detection Test ===');
  console.log('');

  const testCases = [
    { message: 'tolong carikan berita terbaru hari ini', webSearchEnabled: true, category: 'chat' },
    { message: 'halo, apa kabar?', webSearchEnabled: true, category: 'chat' },
    { message: 'buatkan kode python untuk sorting', webSearchEnabled: true, category: 'coding' },
    { message: 'siapa presiden RI saat ini?', webSearchEnabled: true, category: 'chat' },
  ];

  for (const testCase of testCases) {
    console.log(`Test: "${testCase.message.substring(0, 60)}..."`);
    const result = await detectIntentWithAI(testCase.message, testCase);
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('');
  }

  console.log('=== Test Complete ===');
}
