/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { verifyApiKey } from '@/lib/api-key-auth';
import { ApiKeyRepository } from '@/repositories/api-key.repo';
import { ApiUsageRepository } from '@/repositories/api-usage.repo';
import { ModelRepository } from '@/repositories/model.repo';
import { BillingRepository } from '@/repositories/billing.repo';
import { ChatUsageTrackingService, ModelPricing } from '@/services/chat-usage-tracking.service';
import {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
  ApiKeyContext,
} from '@/types/openai-api';
import { oaiError, oaiQuotaError, oaiModelNotFound, oaiBadGateway } from '@/lib/openai-errors';
import { apiRateLimiter } from '@/lib/api-rate-limiter';
import { API_GATEWAY_TIMEOUT_MS, API_GATEWAY_MAX_TOKENS } from '@/config';

// ============================================================
// OmniRouter Config
// ============================================================
const OMNIROUTER_BASE = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTER_API_KEY = process.env.OMNIROUTER_API_KEY || '';

// ============================================================
// Types
// ============================================================

interface ProxyResult {
  response: NextResponse;
  statusCode: number;
}

interface CreditReservation {
  reserved: number;
  creditBefore: number;
}

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

// ============================================================
// Helpers
// ============================================================

function generateChatCompletionId(): string {
  return `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
}

function generateUsageLogId(): string {
  return `ul_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Parse SSE buffer, extracting parsed JSON events.
 * Returns the remaining unparsed buffer.
 */
function parseSSEBuffer(buffer: string, onEvent: (data: any) => void): string {
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
          try {
            onEvent(JSON.parse(dataStr));
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  }
  return remaining;
}

// ============================================================
// Gateway Service
// ============================================================

export const ApiGatewayService = {
  /**
   * Validate an API key from the Authorization header.
   * Also checks rate limit and model availability.
   */
  async validateRequest(
    bearerToken: string | null,
    modelId: string
  ): Promise<{ keyContext: ApiKeyContext } | NextResponse> {
    // 1. Require API key
    if (!bearerToken) {
      return oaiError('Missing API key. Provide via Authorization: Bearer mi-xxx', 401, 'missing_api_key');
    }

    // 2. Verify API key
    const keyContext = await verifyApiKey(bearerToken);
    if (!keyContext) {
      return oaiError('Invalid API key', 401, 'invalid_api_key');
    }

    // 3. Rate limit check
    if (!apiRateLimiter.check(keyContext.apiKeyId)) {
      const status = apiRateLimiter.getStatus(keyContext.apiKeyId);
      const response = oaiError('Too many requests. Please try again later.', 429, 'rate_limit_exceeded');
      // Add rate limit headers
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', String(status.limit));
      headers.set('X-RateLimit-Remaining', String(status.remaining));
      headers.set('X-RateLimit-Reset', String(Math.ceil(status.resetMs / 1000)));
      return new NextResponse(JSON.stringify({ error: { message: 'Too many requests', type: 'rate_limit_error', param: null, code: 'rate_limit_exceeded' } }), {
        status: 429,
        headers,
      });
    }

    // 4. Validate model is active in our DB
    // Dual lookup: first try public_id, then fallback to internal id
    let model = await ModelRepository.findByPublicId(modelId);
    if (!model || model.status !== 'active') {
      model = await ModelRepository.getModelById(modelId);
    }
    if (!model || model.status !== 'active') {
      return oaiModelNotFound(modelId);
    }

    return { keyContext };
  },

  /**
   * Main proxy handler — routes to streaming or non-streaming.
   */
  async proxyChatCompletion(
    keyContext: ApiKeyContext,
    body: OpenAIChatCompletionRequest
  ): Promise<NextResponse> {
    const modelId = body.model;

    // Get model pricing for cost calculation
    // Dual lookup: first try public_id, then fallback to internal id
    let modelRecord = await ModelRepository.findByPublicId(modelId);
    if (!modelRecord || modelRecord.status !== 'active') {
      modelRecord = await ModelRepository.getModelById(modelId);
    }
    if (!modelRecord || modelRecord.status !== 'active') {
      return oaiModelNotFound(modelId);
    }

    const modelPricing: ModelPricing = {
      id: modelRecord.id,
      name: modelRecord.name || modelRecord.id,
      provider: modelRecord.provider || 'unknown',
      inputPrice: Number(modelRecord.input_price) || 0,
      outputPrice: Number(modelRecord.output_price) || 0,
      free: modelRecord.free === 1 || modelRecord.free === true,
      discountPercent: modelRecord.discount_percent,
      discountType: modelRecord.discount_type,
    };

    // Determine if streaming
    const isStreaming = body.stream === true;

    if (isStreaming) {
      return this.handleStreaming(keyContext, body, modelPricing);
    } else {
      return this.handleNonStreaming(keyContext, body, modelPricing);
    }
  },

  /**
   * Handle streaming proxy: tee() split → forward SSE + background analysis.
   *
   * Flow:
   * 1. Pre-reserve credit inside a transaction (SELECT ... FOR UPDATE)
   * 2. POST to OmniRouter with stream: true
   * 3. tee() the response body stream
   * 4. Branch A: Forward SSE chunks to client in real-time
   * 5. Branch B: Read full stream in background, extract usage, deduct credit
   * 6. Post-stream: Update api_keys stats, log usage
   */
  async handleStreaming(
    keyContext: ApiKeyContext,
    body: OpenAIChatCompletionRequest,
    modelPricing: ModelPricing
  ): Promise<NextResponse> {
    const { userId, apiKeyId } = keyContext;
    const startTime = Date.now();

    // 1. Estimate max cost (assume max tokens)
    const estimatedInputTokens = body.messages.reduce((sum, m) => sum + m.content.length / 3.5, 0);
    const estimatedOutputTokens = body.max_tokens || API_GATEWAY_MAX_TOKENS;
    const estimatedCost = modelPricing.free
      ? 0
      : (ChatUsageTrackingService.calculateCost(Math.ceil(estimatedInputTokens), estimatedOutputTokens, modelPricing)?.totalCost ?? 0);

    // 2. Pre-reserve credit
    let reservation: CreditReservation;
    try {
      reservation = await this.reserveCredit(userId, estimatedCost, modelPricing.free);
    } catch (err: any) {
      if (err.message?.includes('INSUFFICIENT_CREDITS')) {
        return oaiQuotaError(err.message);
      }
      console.error('[API Gateway] Credit reservation error:', err.message);
      return oaiError('Failed to process credit check', 500, 'internal_error');
    }

    // 3. Build OmniRouter request body
    const omniBody: any = {
      model: modelPricing.id,
      messages: body.messages,
      stream: true,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? API_GATEWAY_MAX_TOKENS,
    };
    if (body.top_p !== undefined) omniBody.top_p = body.top_p;
    if (body.frequency_penalty !== undefined) omniBody.frequency_penalty = body.frequency_penalty;
    if (body.presence_penalty !== undefined) omniBody.presence_penalty = body.presence_penalty;
    if (body.stop !== undefined) omniBody.stop = body.stop;

    // 4. Proxy to OmniRouter
    let omniResponse: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_GATEWAY_TIMEOUT_MS);

      omniResponse = await fetch(`${OMNIROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        },
        body: JSON.stringify(omniBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch (fetchErr: any) {
      // Refund reserved credit
      await this.refundCredit(userId, reservation.creditBefore, 'OmniRouter connection failed');
      console.error('[API Gateway] OmniRouter fetch error:', fetchErr.message);
      return oaiBadGateway();
    }

    if (!omniResponse.ok) {
      // Refund reserved credit
      await this.refundCredit(userId, reservation.creditBefore, `OmniRouter error: ${omniResponse.status}`);
      const errorText = await omniResponse.text().catch(() => 'unknown error');
      console.error(`[API Gateway] OmniRouter returned ${omniResponse.status}: ${errorText}`);
      return oaiBadGateway();
    }

    // 5. Extract the body stream and tee it
    const bodyStream = omniResponse.body;
    if (!bodyStream) {
      await this.refundCredit(userId, reservation.creditBefore, 'No response body from OmniRouter');
      return oaiBadGateway();
    }

    const [clientStream, analysisStream] = bodyStream.tee();

    // 6. Start background analysis (non-blocking)
    const usageLogId = generateUsageLogId();
    const chatCompletionId = generateChatCompletionId();
    const created = Math.floor(Date.now() / 1000);

    this.analyzeStreamInBackground(
      analysisStream,
      {
        userId,
        apiKeyId,
        model: body.model,
        usageLogId,
        chatCompletionId,
        created,
        reservation,
        modelPricing,
        estimatedInputTokens: Math.ceil(estimatedInputTokens),
        startTime,
      }
    ).catch((err) => {
      console.error('[API Gateway] Background analysis failed:', err.message);
    });

    // 7. Forward OmniRouter SSE stream directly to client.
    //    OmniRouter already returns OpenAI-compatible SSE format,
    //    so we pass-through without transformation.
    //    Background analysis runs in parallel on the tee'd copy.
    return new NextResponse(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  },

  /**
   * Handle non-streaming proxy: buffer full response, extract usage, deduct credit.
   */
  async handleNonStreaming(
    keyContext: ApiKeyContext,
    body: OpenAIChatCompletionRequest,
    modelPricing: ModelPricing
  ): Promise<NextResponse> {
    const { userId, apiKeyId } = keyContext;
    const startTime = Date.now();

    // 1. Estimate max cost
    const estimatedInputTokens = body.messages.reduce((sum, m) => sum + m.content.length / 3.5, 0);
    const estimatedOutputTokens = body.max_tokens || API_GATEWAY_MAX_TOKENS;
    const estimatedCost = modelPricing.free
      ? 0
      : (ChatUsageTrackingService.calculateCost(Math.ceil(estimatedInputTokens), estimatedOutputTokens, modelPricing)?.totalCost ?? 0);

    // 2. Pre-reserve credit
    let reservation: CreditReservation;
    try {
      reservation = await this.reserveCredit(userId, estimatedCost, modelPricing.free);
    } catch (err: any) {
      if (err.message?.includes('INSUFFICIENT_CREDITS')) {
        return oaiQuotaError(err.message);
      }
      console.error('[API Gateway] Credit reservation error:', err.message);
      return oaiError('Failed to process credit check', 500, 'internal_error');
    }

    // 3. Build OmniRouter request body (non-streaming)
    const omniBody: any = {
      model: modelPricing.id,
      messages: body.messages,
      stream: false,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? API_GATEWAY_MAX_TOKENS,
    };
    if (body.top_p !== undefined) omniBody.top_p = body.top_p;
    if (body.frequency_penalty !== undefined) omniBody.frequency_penalty = body.frequency_penalty;
    if (body.presence_penalty !== undefined) omniBody.presence_penalty = body.presence_penalty;
    if (body.stop !== undefined) omniBody.stop = body.stop;

    // 4. Proxy to OmniRouter
    let omniResponse: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_GATEWAY_TIMEOUT_MS);

      omniResponse = await fetch(`${OMNIROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OMNIROUTER_API_KEY}`,
        },
        body: JSON.stringify(omniBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch (fetchErr: any) {
      await this.refundCredit(userId, reservation.creditBefore, 'OmniRouter connection failed');
      return oaiBadGateway();
    }

    // 5. Read full response
    let omniData: any;
    try {
      omniData = await omniResponse.json();
    } catch {
      await this.refundCredit(userId, reservation.creditBefore, 'Failed to parse OmniRouter response');
      return oaiBadGateway();
    }

    if (!omniResponse.ok) {
      await this.refundCredit(userId, reservation.creditBefore, `OmniRouter error: ${omniResponse.status}`);
      return oaiBadGateway();
    }

    // 6. Extract usage
    const usage = omniData.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? 0;

    // 7. Calculate actual cost and adjust credit
    let actualCost = 0;
    if (!modelPricing.free && (promptTokens > 0 || completionTokens > 0)) {
      const costCalc = ChatUsageTrackingService.calculateCost(promptTokens, completionTokens, modelPricing);
      actualCost = costCalc?.totalCost ?? 0;
    }

    // Deduct actual cost (synchronous for non-streaming)
    const finalCost = Math.min(actualCost, reservation.reserved);
    let creditAfter = reservation.creditBefore - finalCost;

    try {
      await this.deductCredit(userId, finalCost, `API: ${body.model} (${promptTokens}/${completionTokens} tokens)`);
    } catch (err: any) {
      console.error('[API Gateway] Credit deduction failed:', err.message);
      // Still return the response, but log the error
      creditAfter = reservation.creditBefore;
    }

    // 8. Log API usage
    const durationMs = Date.now() - startTime;
    const usageLogId = generateUsageLogId();

    try {
      await ApiUsageRepository.create({
        id: usageLogId,
        api_key_id: apiKeyId,
        user_id: userId,
        model: body.model,
        stream: 0,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost: finalCost,
        credit_before: reservation.creditBefore,
        credit_after: creditAfter,
        status: 'success',
        duration_ms: durationMs,
      });

      // Update API key stats
      await ApiKeyRepository.updateUsage(apiKeyId, totalTokens);
    } catch (err: any) {
      console.error('[API Gateway] Usage logging failed:', err.message);
    }

    // Broadcast real-time log to admin (non-streaming)
    import('@/services/notification.service').then(({ NotificationService }) => {
      NotificationService.broadcast({
        type: 'log:new',
        log: {
          id: usageLogId, userId, userName: '', userEmail: '',
          logType: 'byok',
          model: body.model,
          provider: '',
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          cost: finalCost,
          creditBefore: reservation.creditBefore,
          creditAfter: creditAfter,
          status: 'success',
          createdAt: new Date().toISOString()
        },
      }).catch(() => {});
    }).catch(() => {});

    // 9. Build OpenAI-compatible response
    const response: OpenAIChatCompletionResponse = {
      id: generateChatCompletionId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: omniData.choices?.map((c: any, idx: number) => ({
        index: idx,
        message: {
          role: 'assistant' as const,
          content: c.message?.content || '',
        },
        finish_reason: c.finish_reason || 'stop',
      })) ?? [],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    };

    return NextResponse.json(response);
  },

  /**
   * Reserve credit for a request.
   * Uses SELECT ... FOR UPDATE to prevent race conditions.
   */
  async reserveCredit(userId: string, estimatedCost: number, isFree: boolean): Promise<CreditReservation> {
    if (isFree) {
      return { reserved: 0, creditBefore: 0 };
    }

    const reserved = Math.ceil(estimatedCost * 10000) / 10000; // Round up to 4 decimals

    return await transaction(async (conn) => {
      // Lock user row
      await BillingRepository.lockUserForUpdate(userId, conn);

      // Get current balance
      const balance = await BillingRepository.getUserBalance(userId, conn);
      if (balance === null) {
        throw new Error('INSUFFICIENT_CREDITS: User not found');
      }

      // Check sufficient credit (with 20% buffer)
      const minRequired = reserved * 1.2;
      if (balance < minRequired) {
        throw new Error(
          `INSUFFICIENT_CREDITS: Kredit tidak cukup. Diperlukan minimal ${minRequired.toFixed(4)}, tersedia ${balance.toFixed(4)}`
        );
      }

      return { reserved, creditBefore: balance };
    });
  },

  /**
   * Refund reserved credit (rollback on error).
   */
  async refundCredit(userId: string, creditBefore: number, reason: string): Promise<void> {
    try {
      const { BillingService } = await import('@/services/billing.service');
      // We just update the credit back to what it was before the reservation
      // Since we didn't actually deduct yet (just reserved), no action needed
      // Log the refund event for auditing
      console.log(`[API Gateway] Credit refunded (no-op) for ${userId}: ${reason}`);
    } catch {
      // Best-effort
    }
  },

  /**
   * Deduct actual credit after successful completion.
   */
  async deductCredit(userId: string, amount: number, description: string): Promise<void> {
    if (amount <= 0) return;

    const { BillingService } = await import('@/services/billing.service');
    await BillingService.deductCredit(userId, amount, description);
  },

  /**
   * Background analysis of streaming response.
   * Reads the tee'd stream, parses SSE chunks to extract usage,
   * then calculates cost and deducts credit.
   */
  async analyzeStreamInBackground(
    stream: ReadableStream<Uint8Array>,
    context: {
      userId: string;
      apiKeyId: string;
      model: string;
      usageLogId: string;
      chatCompletionId: string;
      created: number;
      reservation: CreditReservation;
      modelPricing: ModelPricing;
      estimatedInputTokens: number;
      startTime: number;
    }
  ): Promise<void> {
    const {
      userId,
      apiKeyId,
      model,
      usageLogId,
      reservation,
      modelPricing,
      estimatedInputTokens,
      startTime,
    } = context;

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let hasUsage = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        sseBuffer += chunk;

        // Parse SSE events to extract usage
        sseBuffer = parseSSEBuffer(sseBuffer, (data) => {
          // Extract content for token estimation
          if (data.choices?.[0]?.delta?.content) {
            fullContent += data.choices[0].delta.content;
          }
          // Extract usage if present (OmniRouter may include it in final chunk)
          if (data.usage) {
            promptTokens = data.usage.prompt_tokens || 0;
            completionTokens = data.usage.completion_tokens || 0;
            totalTokens = data.usage.total_tokens || 0;
            hasUsage = true;
          }
        });
      }

      // If OmniRouter didn't provide usage, estimate
      if (!hasUsage) {
        promptTokens = estimatedInputTokens;
        completionTokens = ChatUsageTrackingService.estimateTokens(fullContent);
        totalTokens = promptTokens + completionTokens;
      }

      // Calculate actual cost
      let actualCost = 0;
      if (!modelPricing.free && (promptTokens > 0 || completionTokens > 0)) {
        const costCalc = ChatUsageTrackingService.calculateCost(promptTokens, completionTokens, modelPricing);
        actualCost = costCalc?.totalCost ?? 0;
      }

      // Deduct actual cost (no more than reserved)
      const finalCost = Math.min(actualCost, reservation.reserved);
      const creditAfter = reservation.creditBefore - finalCost;

      if (finalCost > 0) {
        try {
          await this.deductCredit(userId, finalCost, `API: ${model} (${promptTokens}/${completionTokens} tokens)`);
        } catch (err: any) {
          console.error('[API Gateway] Background credit deduction failed:', err.message);
        }
      }

      // Log usage
      const durationMs = Date.now() - startTime;
      try {
        await ApiUsageRepository.create({
          id: usageLogId,
          api_key_id: apiKeyId,
          user_id: userId,
          model,
          stream: 1,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          cost: finalCost,
          credit_before: reservation.creditBefore,
          credit_after: creditAfter,
          status: 'success',
          duration_ms: durationMs,
        });

        // Update API key stats
        await ApiKeyRepository.updateUsage(apiKeyId, totalTokens);
      } catch (err: any) {
        console.error('[API Gateway] Usage logging failed:', err.message);
      }

      // Broadcast real-time log to admin (streaming success)
      import('@/services/notification.service').then(({ NotificationService }) => {
        NotificationService.broadcast({
          type: 'log:new',
          log: {
            id: usageLogId, userId, userName: '', userEmail: '',
            logType: 'byok',
            model,
            provider: '',
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            cost: finalCost,
            creditBefore: reservation.creditBefore,
            creditAfter: creditAfter,
            status: 'success',
            createdAt: new Date().toISOString()
          },
        }).catch(() => {});
      }).catch(() => {});
    } catch (err: any) {
      console.error('[API Gateway] Background analysis error:', err.message);

      // Log error usage
      try {
        await ApiUsageRepository.create({
          id: usageLogId,
          api_key_id: apiKeyId,
          user_id: userId,
          model,
          stream: 1,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          cost: 0,
          credit_before: reservation.creditBefore,
          credit_after: reservation.creditBefore,
          status: 'error',
          error_message: err.message,
          duration_ms: Date.now() - startTime,
        });
      } catch {
        // Best-effort
      }

      // Broadcast error log to admin (streaming error)
      import('@/services/notification.service').then(({ NotificationService }) => {
        NotificationService.broadcast({
          type: 'log:new',
          log: {
            id: usageLogId, userId, userName: '', userEmail: '',
            logType: 'byok',
            model,
            provider: '',
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            cost: 0,
            creditBefore: reservation.creditBefore,
            creditAfter: reservation.creditBefore,
            status: 'error',
            createdAt: new Date().toISOString()
          },
        }).catch(() => {});
      }).catch(() => {});
    } finally {
      reader.releaseLock();
    }
  },
};
