import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ModelService } from '@/services/model.service';

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      return apiError('Forbidden: Admin only', 403);
    }

    const result = await ModelService.syncModelsFromRemote();

    return apiSuccess({
      success: true,
      synced: result.updated + result.created,
      new: result.created,
      updated: result.updated,
      disabled: result.disabled,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Sync models error:', error);
    return apiError(err.message || 'Failed to sync models', 500);
  }
}
