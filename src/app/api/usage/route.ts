import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { BillingService } from '@/services/billing.service';
import type { UsageLog } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401);
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    if (isNaN(limit) || limit <= 0) {
      return apiError('Invalid limit parameter', 400);
    }

    const logs = await BillingService.getUsageLogs(auth.userId, limit);

    const mapped = logs.map((l: UsageLog) => ({
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
    }));

    return apiSuccess({ usageLogs: mapped }, 200);
  } catch (error) {
    console.error('Usage API error:', error);
    return apiError('Failed to fetch usage logs', 500);
  }
}
