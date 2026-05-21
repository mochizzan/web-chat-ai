/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModelRepository } from '@/repositories/model.repo';
import { ChatPersistenceService } from './chat-persistence.service';
import { ChatUsageTrackingService } from './chat-usage-tracking.service';
import { ChatWebSearchService } from './chat-web-search.service';

const CATEGORY_PROMPTS: Record<string, string> = {
  chat:
    'Anda adalah asisten AI yang ramah, cerdas, dan membantu. ' +
    'Gunakan bahasa yang dipakai user. ' +
    'Berikan jawaban akurat, ringkas, dan langsung ke intinya. ' +
    'Jika diminta membuat/mengedit file, gunakan blok kode dengan nama file di header. ' +
    'Saat memodifikasi file, outputkan SELURUH file yang sudah diperbarui.',

  coding:
    'AI Coding Assistant. Ikuti aturan ini KETAT.\n\n' +
    '## DETEKSI JENIS REQUEST\n' +
    '1.NEW: "buat/create" → full project structure + kode + setup\n' +
    '2.FIX: "bug/error" → root cause analysis → kode lengkap + pencegahan\n' +
    '3.UPDATE: "tambah/upgrade" → impact analysis → SEMUA file yang berubah\n' +
    '4.DEBUG: "kenapa/trace" → step-by-step analysis, minta data jika kurang\n' +
    '5.UI: "tampilan/layout" → responsive + a11y + states + deskripsi preview\n\n' +
    '## RULES INTI (WAJIB)\n' +
    '• KODE: Lengkap, no "..." / placeholder / TODO unimplemented\n' +
    '• QUALITY: Production-ready (error handling, validasi, edge cases), no console.log final\n' +
    '• TYPES: No `any`, explicit interface/type, gunakan generics/unions\n' +
    '• CLEAN: SOLID/DRY, no magic values, nama deskriptif\n' +
    '• SECURITY: Prevent XSS/injection, no hardcoded secrets, parameterized queries\n' +
    '• PERF: Hindari N+1, gunakan caching, hindari blocking ops\n' +
    '• TEST: Kode harus testable (DI/pure functions), sertakan pertimbangan testing\n' +
    '• FORMAT: ```lang:path/file.ext (contoh: ```js:src/app.js)\n' +
    '• DOCS: JSDoc untuk fungsi publik, komentar hanya untuk logika kompleks\n\n' +
    '## DEFAULT & RESPON\n' +
    '• Bahasa: Penjelasan ikut bahasa user, kode tetap Inggris\n' +
    '• Stack default: HTML/CSS/JS sederhana, KECUALI user specify lain\n' +
    '• Struktur: [Jenis] → [Analisis singkat] → [Kode lengkap] → [Catatan]\n' +
    '• Jika ragu: Acknowledge limitation, jangan asumsi',

  research:
    'Anda adalah asisten riset yang analitis dan objektif. ' +
    'Berikan analisis mendalam, terstruktur, dan berbasis fakta. ' +
    'Sertakan sumber referensi jika relevan. ' +
    'Akui keterbatasan data secara eksplisit. ' +
    'Format: pendahuluan → analisis → kesimpulan.',

  assistant:
    'Anda adalah asisten AI produktif untuk tugas sehari-hari. ' +
    'Ahli dalam menulis, mengedit, merangkum, menjawab pertanyaan faktual, ' +
    'brainstorming, dan perencanaan. ' +
    'Gunakan bahasa yang ramah namun profesional.',

  natural:
    'Anda adalah teman ngobrol yang hangat dan natural. ' +
    'Gunakan bahasa santai seperti obrolan sehari-hari. ' +
    'Jangan kaku atau formal. Boleh ekspresif dan personal. ' +
    'Respons singkat dan relevan.',
};

const OMNIROUTER_BASE = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTER_API_KEY = process.env.OMNIROUTER_API_KEY || '';

function parseSSEBuffer(buffer: string, onEvent: (data: string) => void): string {
  let remaining = buffer;
  while (true) {
    const eventEnd = remaining.indexOf('\n\n');
    if (eventEnd === -1) break;
    const eventText = remaining.substring(0, eventEnd);
    remaining = remaining.substring(eventEnd + 2);
    const lines = eventText.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr && dataStr !== '[DONE]') {
          onEvent(dataStr);
        }
      }
    }
  }
  return remaining;
}

function buildTimeContext(timezone: string = 'Asia/Jakarta'): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'long',
    });
    return `Sekarang: ${formatter.format(now)}`;
  } catch {
    const now = new Date();
    const fallback = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    return `Sekarang: ${fallback} WIB`;
  }
}

export const ChatOrchestratorService = {
  /**
   * Orchestrates the LLM streaming response.
   * Main entry point for chat completion with streaming.
   */
  async streamChat(
    userId: string,
    params: {
      message: string;
      modelId: string;
      category: string;
      thinkingEnabled: boolean;
      webSearchEnabled: boolean;
      history: any[];
      conversationId: string | null;
      timezone: string | undefined;
    }
  ) {
    const {
      message,
      modelId,
      category,
      thinkingEnabled,
      webSearchEnabled,
      history,
      conversationId,
      timezone,
    } = params;

    const systemPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.chat;
    const timeContext = buildTimeContext(timezone);

    // 1. Model Pricing & Status (delegate to ModelRepository)
    let modelPricing: any = {
      id: modelId,
      name: modelId,
      provider: 'unknown',
      inputPrice: 2.50,
      outputPrice: 10.00,
      free: false,
      discountPercent: 0,
      discountType: 'none',
    };

    try {
      const dbModel = await ModelRepository.getModelById(modelId);

      if (dbModel && dbModel.status !== 'active') {
        const statusLabel = dbModel.status === 'maintenance' ? 'sedang dalam maintenance' : 'tidak aktif';
        const additionalInfo = dbModel.status === 'disabled'
          ? 'Model mungkin tidak tersedia karena sinkronisasi gagal atau belum dilakukan.'
          : '';
        throw new Error(`MODEL_DISABLED: Model "${modelId}" sedang ${statusLabel}. ${additionalInfo}Silakan pilih model lain.`);
      }

      if (dbModel) {
        modelPricing = {
          id: dbModel.id,
          name: dbModel.name,
          provider: dbModel.provider,
          inputPrice: Number(dbModel.input_price) || 0,
          outputPrice: Number(dbModel.output_price) || 0,
          free: Boolean(dbModel.free),
          discountPercent: Number(dbModel.discount_percent) || 0,
          discountType: dbModel.discount_type || 'none',
        };
      }
    } catch (e: any) {
      if (e.message.startsWith('MODEL_DISABLED:')) throw e;
      // DB not available, use defaults
    }

    // 2. Credit Check (delegate to ChatUsageTrackingService)
    let creditRemaining = -1;
    try {
      creditRemaining = await ChatUsageTrackingService.getCreditRemaining(userId);
    } catch {
      // DB not available
    }

    // 3. Generate IDs
    const genConversationId = await ChatPersistenceService.ensureConversation(
      conversationId,
      userId,
      message,
      modelId,
      category
    );
    const userMsgId = `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const assistantMsgId = `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const encoder = new TextEncoder();
    let fullContent = '';
    let fullThinkingContent = '';
    let doneSent = false;
    let inputTokens = 0;
    let outputTokens = 0;

    const sendEvent = (data: object) => {
      return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sendDone = () => {
      if (doneSent) return null;
      doneSent = true;

      const realInputTokens = inputTokens > 0 ? inputTokens : 0;
      const realOutputTokens = outputTokens > 0 ? outputTokens : ChatUsageTrackingService.estimateTokens(fullContent);
      const cost = ChatUsageTrackingService.calculateCost(realInputTokens, realOutputTokens, modelPricing);

      return sendEvent({
        type: 'done',
        usage: {
          modelId: modelId,
          modelName: modelPricing.name,
          provider: modelPricing.provider,
          inputTokens: realInputTokens,
          outputTokens: realOutputTokens,
          inputCost: cost?.inputCost || 0,
          outputCost: cost?.outputCost || 0,
          totalCost: cost?.totalCost || 0,
          creditRemaining,
          logId,
          createdAt: new Date().toISOString(),
        },
      });
    };

    const readable = new ReadableStream({
      async start(controller) {
        let controllerClosed = false;
        const safeEnqueue = (chunk: Uint8Array) => {
          if (!controllerClosed) {
            try { controller.enqueue(chunk); } catch { controllerClosed = true; }
          }
        };

        safeEnqueue(sendEvent({
          type: 'init',
          conversationId: genConversationId,
          userMessage: { id: userMsgId, role: 'user', content: message.trim(), createdAt: now },
          assistantMessageId: assistantMsgId,
        }));

        // Phase 1: Web Search (delegate to ChatWebSearchService)
        let webSearchContext = '';
        if (webSearchEnabled && message.trim().length > 10) {
          try {
            const intent = ChatWebSearchService.detectWebSearchIntent(message, category);

            if (intent.shouldSearch) {
              safeEnqueue(sendEvent({
                type: 'web_search',
                status: 'searching',
                message: '🔍 Mencari informasi di web...',
                query: message.substring(0, 100),
              }));

              webSearchContext = await ChatWebSearchService.performWebSearch(message, {
                maxResults: 5,
                searchDepth: 'advanced',
                category,
              });

              if (webSearchContext) {
                const resultCount = (webSearchContext.match(/\[\d+\]/g) || []).length;
                safeEnqueue(sendEvent({
                  type: 'web_search',
                  status: 'results_found',
                  message: `🌐 ${resultCount} hasil pencarian ditemukan`,
                  resultCount,
                }));
              } else {
                safeEnqueue(sendEvent({
                  type: 'web_search',
                  status: 'no_results',
                  message: 'Tidak ada hasil web search yang relevan',
                }));
              }
            } else {
              safeEnqueue(sendEvent({
                type: 'web_search',
                status: 'skipped',
                message: 'Web Search tidak diperlukan untuk pesan ini',
              }));
            }
          } catch (e) {
            console.error('[ChatOrchestrator] WebSearch error:', e);
            safeEnqueue(sendEvent({
              type: 'web_search',
              status: 'error',
              message: 'Gagal mencari informasi di web, melanjutkan tanpa web search',
            }));
          }
        }

        // Phase 2: Build messages + Call LLM
        const systemContent = ChatWebSearchService.buildSystemContent(systemPrompt, timeContext, webSearchContext);

        const llmMessages: { role: string; content: string }[] = [
          { role: 'system', content: systemContent },
        ];
        if (Array.isArray(history)) {
          for (const msg of history) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              llmMessages.push({ role: msg.role, content: msg.content });
            }
          }
        }
        llmMessages.push({ role: 'user', content: message.trim() });

        const allInputText = llmMessages.map((m) => m.content).join(' ');
        const estimatedInputTokens = ChatUsageTrackingService.estimateTokens(allInputText);

        // Credit check before making API call
        if (!modelPricing.free) {
          const estimatedOutputTokens = 1000;
          const estimatedCost = ChatUsageTrackingService.calculateCost(estimatedInputTokens, estimatedOutputTokens, modelPricing);
          
          if (estimatedCost) {
            try {
              await ChatUsageTrackingService.checkCredit(userId, estimatedCost.totalCost * 1.2, false);
            } catch (creditError: any) {
              if (creditError.message.includes('INSUFFICIENT_CREDITS')) {
                safeEnqueue(sendEvent({
                  type: 'credit_error',
                  code: 'INSUFFICIENT_CREDITS',
                  message: creditError.message,
                }));
                controllerClosed = true;
                try { controller.close(); } catch { }
                return;
              }
            }

            // Credit warnings
            const currentCredit = await ChatUsageTrackingService.getCreditRemaining(userId);
            if (currentCredit < 0.20) {
              safeEnqueue(sendEvent({
                type: 'credit_warning',
                level: 'critical',
                message: 'Kredit Anda sangat rendah! Segera top-up untuk menghindari pemblokiran pesan.'
              }));
            } else if (currentCredit < 1.00) {
              safeEnqueue(sendEvent({
                type: 'credit_warning',
                level: 'low',
                message: 'Kredit Anda rendah. Pertimbangkan untuk top-up agar percakapan tidak terputus.'
              }));
            }
          }
        }

        // Phase 3: Call OmniRouter
        const omniBody: any = {
          model: modelId,
          messages: llmMessages,
          stream: true,
        };
        if (thinkingEnabled) {
          omniBody.thinking = { type: 'enabled' };
        }

        let omniResponse: Response;
        try {
          omniResponse = await fetch(`${OMNIROUTER_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
            },
            body: JSON.stringify(omniBody),
          });
        } catch (fetchErr) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Failed to connect to OmniRouter';
          safeEnqueue(sendEvent({ type: 'error', message: errMsg, partialContent: '', partialThinking: '' }));
          const doneEvent = sendDone();
          if (doneEvent) safeEnqueue(doneEvent);
          controllerClosed = true;
          try { controller.close(); } catch { }
          return;
        }

        if (!omniResponse.ok) {
          const errorText = await omniResponse.text().catch(() => 'unknown error');
          safeEnqueue(sendEvent({
            type: 'error',
            message: `OmniRouter error: ${omniResponse.status} ${errorText}`,
            partialContent: '',
            partialThinking: '',
          }));
          const doneEvent = sendDone();
          if (doneEvent) safeEnqueue(doneEvent);
          controllerClosed = true;
          try { controller.close(); } catch { }
          return;
        }

        if (!omniResponse.body) {
          const doneEvent = sendDone();
          if (doneEvent) safeEnqueue(doneEvent);
          controllerClosed = true;
          try { controller.close(); } catch { }
          return;
        }

        const reader = omniResponse.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            sseBuffer = parseSSEBuffer(sseBuffer, (dataStr) => {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.usage) {
                  inputTokens = parsed.usage.prompt_tokens || 0;
                  outputTokens = parsed.usage.completion_tokens || 0;
                }
                const delta = parsed.choices?.[0]?.delta;
                const thinkingChunk =
                  delta?.thinking ||
                  delta?.reasoning_content ||
                  parsed.choices?.[0]?.message?.thinking ||
                  parsed.choices?.[0]?.message?.reasoning_content;

                if (thinkingChunk && typeof thinkingChunk === 'string' && thinkingChunk.length > 0) {
                  fullThinkingContent += thinkingChunk;
                  safeEnqueue(sendEvent({ type: 'thinking', content: thinkingChunk }));
                }
                if (delta?.content && typeof delta.content === 'string') {
                  fullContent += delta.content;
                  safeEnqueue(sendEvent({ type: 'delta', content: delta.content }));
                }
              } catch { }
            });
          }

          if (sseBuffer.trim().length > 0) {
            const lines = sseBuffer.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.usage) {
                  inputTokens = parsed.usage.prompt_tokens || 0;
                  outputTokens = parsed.usage.completion_tokens || 0;
                }
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                  fullContent += delta.content;
                  safeEnqueue(sendEvent({ type: 'delta', content: delta.content }));
                }
              } catch { }
            }
          }

          // Phase 4: Persistence (delegate to ChatPersistenceService & ChatUsageTrackingService)
          if (userId) {
            try {
              const realInputTokens = inputTokens > 0 ? inputTokens : estimatedInputTokens;
              const realOutputTokens = outputTokens > 0 ? outputTokens : ChatUsageTrackingService.estimateTokens(fullContent);
              const cost = ChatUsageTrackingService.calculateCost(realInputTokens, realOutputTokens, modelPricing);

              // Save user message
              await ChatPersistenceService.saveMessage({
                id: userMsgId,
                conversation_id: genConversationId,
                role: 'user',
                content: message.trim(),
                created_at: new Date().toISOString(),
              });

              // Save assistant message
              await ChatPersistenceService.saveMessage({
                id: assistantMsgId,
                conversation_id: genConversationId,
                role: 'assistant',
                content: fullContent,
                thinking_content: fullThinkingContent || null,
                input_tokens: realInputTokens,
                output_tokens: realOutputTokens,
                input_cost: cost?.inputCost || 0,
                output_cost: cost?.outputCost || 0,
                total_cost: cost?.totalCost || 0,
                created_at: new Date().toISOString(),
              });

              // Save usage log
              const usageLog = ChatUsageTrackingService.buildUsageLog(
                logId,
                userId,
                genConversationId,
                assistantMsgId,
                modelPricing,
                realInputTokens,
                realOutputTokens,
                cost!,
                category
              );
              await ChatUsageTrackingService.saveUsageLog(usageLog);

              // Deduct credit
              if (cost && !modelPricing.free && cost.totalCost > 0) {
                await ChatUsageTrackingService.deductCredit(userId, cost.totalCost, `Chat with ${modelPricing.name} (${modelId})`);
              }

              // Update conversation timestamp
              await ChatPersistenceService.updateConversationUpdatedAt(genConversationId);
            } catch (dbErr) {
              console.error('[ChatOrchestrator] Failed to save to database:', dbErr);
            }
          }

          const doneEvent = sendDone();
          if (doneEvent) safeEnqueue(doneEvent);

        } catch (upstreamError) {
          console.error('[ChatOrchestrator] OmniRouter stream error:', upstreamError);
          if (fullContent.length > 0 || fullThinkingContent.length > 0) {
            safeEnqueue(sendEvent({
              type: 'error',
              message: upstreamError instanceof Error ? upstreamError.message : 'Stream interrupted',
              partialContent: fullContent,
              partialThinking: fullThinkingContent,
            }));
          }
          const doneEvent = sendDone();
          if (doneEvent) safeEnqueue(doneEvent);
        } finally {
          controllerClosed = true;
          reader.releaseLock();
          try { controller.close(); } catch { }
        }
      },
    });

    return readable;
  },
};
