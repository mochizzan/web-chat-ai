import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { BillingService } from '@/services/billing.service';
import { ApiUsageRepository } from '@/repositories/api-usage.repo';
import { ChatRepository } from '@/repositories/chat.repo';
import { UserNotFoundError } from '@/lib/errors';
import type { UsageLog } from '@/types';
import type { UsageLogSource } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    // Fetch both chat usage logs and BYOK API usage logs in parallel
    const [chatLogs, apiLogs] = await Promise.all([
      BillingService.getUsageLogs(auth.userId, limit),
      ApiUsageRepository.findByUserId(auth.userId, limit),
    ]);

    // Map chat usage logs to UsageLogEntry format
    const chatMapped = chatLogs.map((l: UsageLog) => ({
      id: l.id,
      conversationId: l.conversation_id,
      messageId: l.message_id,
      modelId: l.model_id,
      modelName: l.model_name,
      provider: l.provider,
      inputTokens: l.input_tokens,
      outputTokens: l.output_tokens,
      inputCost: Number(l.input_cost),
      outputCost: Number(l.output_cost),
      totalCost: Number(l.total_cost),
      category: l.category,
      createdAt: l.created_at,
      source: 'chat' as UsageLogSource,
    }));

    // Map BYOK API usage logs to UsageLogEntry format
    const apiMapped = apiLogs.map((l) => ({
      id: l.id,
      conversationId: null as string | null,
      messageId: null as string | null,
      modelId: l.model,
      modelName: l.model,
      provider: 'api',
      inputTokens: l.prompt_tokens,
      outputTokens: l.completion_tokens,
      inputCost: 0,
      outputCost: 0,
      totalCost: Number(l.cost),
      category: 'api',
      createdAt: l.created_at,
      source: 'api' as UsageLogSource,
    }));

    // Merge and sort by createdAt descending (most recent first)
    const merged = [...chatMapped, ...apiMapped].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return apiSuccess({ usageLogs: merged }, 200);
  } catch (error: unknown) {
    console.error('Usage API error:', error);
    if (error instanceof UserNotFoundError) {
      return apiError('User account no longer exists. Please login again.', 401);
    }
    return apiError('Failed to fetch usage logs', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401);
    }

    const body = await request.json();
    const { id, conversationId, modelId, modelName, provider,
            inputTokens, outputTokens, inputCost, outputCost,
            totalCost, category, messageId } = body;

    // Validasi required fields
    if (!id || !conversationId || !modelId) {
      return apiError('Missing required fields: id, conversationId, modelId', 400);
    }

    await ChatRepository.saveUsageLog({
      id,
      userId: auth.userId,
      conversationId,
      messageId: messageId || '',
      modelId,
      modelName: modelName || '',
      provider: provider || '',
      inputTokens: Number(inputTokens) || 0,
      outputTokens: Number(outputTokens) || 0,
      inputCost: Number(inputCost) || 0,
      outputCost: Number(outputCost) || 0,
      totalCost: Number(totalCost) || 0,
      category: category || 'chat',
    });

    return apiSuccess({ success: true }, 201);
  } catch (error: unknown) {
    console.error('Usage POST API error:', error);
    if (error instanceof UserNotFoundError) {
      return apiError('User account no longer exists. Please login again.', 401);
    }
    return apiError('Failed to save usage log', 500);
  }
}
