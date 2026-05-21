import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { AnalyticsService } from '@/services/analytics.service';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      return apiError('Forbidden: Admin only', 403);
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const granularity = searchParams.get('granularity') || (period === 'today' || period === '24h' ? 'hour' : 'day');

    const stats = await AnalyticsService.getDashboardStats(period, granularity);

    return apiSuccess({
      ...stats,
      period,
      granularity,
    });
  } catch (error) {
    console.error('Admin analytics GET error:', error);
    return apiError('Failed to fetch analytics', 500);
  }
}
