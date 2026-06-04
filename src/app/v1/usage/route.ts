import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ApiUsageRepository } from '@/repositories/api-usage.repo';
import { ApiKeyRepository } from '@/repositories/api-key.repo';
import { ApiUsageLogResponse, ApiUsageSummary } from '@/types/openai-api';

/**
 * GET /v1/usage
 *
 * Returns usage statistics for the authenticated user's API keys.
 * Requires JWT authentication (browser session).
 *
 * Query params:
 *   - api_key_id (optional): Filter by specific API key
 *   - period (optional): 'today' | '24h' | '7d' | '30d' | '1y' (default: '7d')
 *   - limit (optional): Max logs to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const userId = auth.userId;
    const { searchParams } = request.nextUrl;

    const apiKeyId = searchParams.get('api_key_id');
    const period = searchParams.get('period') || '7d';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const endDateStr = now.toISOString().slice(0, 19).replace('T', ' ');

    // Get logs
    let logs: any[];
    let summary: ApiUsageSummary;

    if (apiKeyId) {
      // Verify the API key belongs to this user
      const key = await ApiKeyRepository.findById(apiKeyId);
      if (!key || key.user_id !== userId) {
        return apiError('API key not found', 404, 'NOT_FOUND');
      }

      logs = await ApiUsageRepository.findByApiKeyId(apiKeyId, limit, 0);
      const sum = await ApiUsageRepository.getSummaryByApiKeyId(apiKeyId, startDateStr, endDateStr);
      summary = {
        total_requests: sum?.total_requests ?? 0,
        total_tokens: sum?.total_tokens ?? 0,
        total_cost: Number(sum?.total_cost ?? 0),
      };
    } else {
      logs = await ApiUsageRepository.findByUserId(userId, limit, 0);
      const sum = await ApiUsageRepository.getSummaryByUser(userId, startDateStr, endDateStr);
      summary = {
        total_requests: sum?.total_requests ?? 0,
        total_tokens: sum?.total_tokens ?? 0,
        total_cost: Number(sum?.total_cost ?? 0),
      };
    }

    const response: {
      summary: ApiUsageSummary;
      logs: ApiUsageLogResponse[];
    } = {
      summary,
      logs: logs.map((l) => ({
        id: l.id,
        api_key_id: l.api_key_id,
        model: l.model,
        stream: l.stream === 1,
        prompt_tokens: l.prompt_tokens,
        completion_tokens: l.completion_tokens,
        total_tokens: l.total_tokens,
        cost: Number(l.cost),
        status: l.status,
        error_message: l.error_message,
        duration_ms: l.duration_ms,
        created_at: l.created_at?.toISOString?.() ?? l.created_at,
      })),
    };

    return apiSuccess(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API Usage] GET error:', err.message);
    return apiError('Failed to fetch usage data', 500, 'INTERNAL_ERROR');
  }
}
