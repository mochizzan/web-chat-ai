import { NextRequest } from 'next/server';

import { AuthService } from '@/services/auth.service';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return apiError('Authentication token missing', 401, 'UNAUTHORIZED');
    }

    const user = await AuthService.validateSession(token);
    return apiSuccess({ user }, 200);
  } catch (error: unknown) {
    const err = error as Error;
    const status = err.message === 'User not found' ? 404 : (err.message === 'Invalid or expired session' ? 401 : 500);
    const code = status === 404 ? 'NOT_FOUND' : (status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR');
    return apiError(err.message || 'Internal server error', status, code);
  }
}
