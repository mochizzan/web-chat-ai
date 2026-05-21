import { NextRequest } from 'next/server';
import { AdminService } from '@/services/admin.service';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const search = searchParams.get('search') || '';
    const period = searchParams.get('period') || '';

    const result = await AdminService.getUsageLogs(page, limit, search, period);

    return apiSuccess(result);
  } catch (error) {
    console.error('Admin logs GET error:', error);
    return apiError('Failed to fetch usage logs', 500);
  }
}
