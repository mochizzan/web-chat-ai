import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { ChatOrchestratorService } from '@/services/chat-orchestrator.service';
import { apiError } from '@/lib/api-response';
import { ModelRepository } from '@/repositories/model.repo';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Starting chat request`);
  
  try {
    const body = await request.json();
    
    console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Processing request body`, {
      model: body.model,
      category: body.category,
      hasHistory: body.history?.length > 0,
      reasoningLevel: body.reasoningLevel,
      webSearchEnabled: body.webSearchEnabled
    });
    
    const {
      message,
      model: modelId = 'gpt-4o',
      category = 'chat',
      reasoningLevel = 'off',
      webSearchEnabled = false,
      history = [],
      conversationId,
      timezone,
    } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Invalid message`, {
        messageLength: message?.length || 0,
        timeTaken: `${Date.now() - startTime}ms`
      });
      return apiError('Message is required and must be a non-empty string', 400, 'BAD_REQUEST');
    }

    // Authenticate — allow anonymous access for free models
    const auth = verifyAuth(request);
    let userId: string | null;

    if (auth) {
      userId = auth.userId;
    } else {
      // Anonymous request: only allow if the requested model is free
      let isFreeModel = false;
      try {
        const dbModel = await ModelRepository.getModelById(modelId);
        isFreeModel = dbModel?.free === true || dbModel?.free === 1;
      } catch (err) {
        console.warn(`[ChatAPI] Model lookup failed:`, err);
      }

      if (!isFreeModel) {
        console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Unauthorized request - non-free or unknown model`);
        return apiError('Silakan masuk dengan akun untuk melanjutkan.', 401, 'UNAUTHORIZED');
      }

      console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Allowing anonymous access for free model`, { modelId });
      userId = null;
    }

    console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Calling ChatOrchestratorService.streamChat`, {
      userId: userId || 'anonymous',
      modelId,
      category,
      messageLength: message.length
    });
    const stream = await ChatOrchestratorService.streamChat(userId, {
      message,
      modelId,
      category,
      reasoningLevel,
      webSearchEnabled,
      history,
      conversationId,
      timezone,
    });
    console.log(`[${new Date().toISOString()}] [ChatAPI] POST: Successfully created stream`, { timeTaken: `${Date.now() - startTime}ms` });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${new Date().toISOString()}] [ChatAPI] POST: Error processing chat request`, {
      error: err.message,
      stack: err.stack,
      timeTaken: `${Date.now() - startTime}ms`
    });

    if (err.message.startsWith('MODEL_DISABLED:')) {
      return apiError(err.message.replace('MODEL_DISABLED: ', ''), 503, 'SERVICE_UNAVAILABLE');
    }

    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errMsg.includes('timeout') || errMsg.includes('Timeout');
    const isNetwork = errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch') || errMsg.includes('network');

    const status = isTimeout ? 504 : isNetwork ? 503 : 500;
    const message = isTimeout
      ? 'AI membutuhkan waktu terlalu lama untuk merespons. Coba gunakan pesan yang lebih pendek atau coba lagi.'
      : isNetwork
        ? 'Gagal terhubung ke AI. Periksa koneksi internet dan coba lagi.'
        : `Gagal memproses permintaan: ${errMsg}`;

    return apiError(message, status, 'INTERNAL_SERVER_ERROR');
  }
}
