import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { NotificationService } from '@/services/notification.service';

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      return apiError('Forbidden: Admin only', 403);
    }

    const body = await request.json();
    
    await NotificationService.broadcast(body);

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Broadcast error:', error);
    return apiError('Broadcast failed', 500);
  }
}
