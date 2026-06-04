import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { BillingService } from '@/services/billing.service';
import { UserNotFoundError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401);
    }

    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return apiError('Positive amount is required', 400);
    }

    await BillingService.processTopup(auth.userId, Number(amount));

    // To maintain identical response contract, we need the new balance
    // We can fetch it from the user repository or add a return value to processTopup
    // For now, let's fetch it to keep the service method simple as it was
    const { UserRepository } = await import('@/repositories/user.repo');
    const user = await UserRepository.findById(auth.userId);
    
    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({
      credit: Number(user.credit),
      amount: Number(amount),
    }, 200);
  } catch (error: unknown) {
    console.error('Topup API error:', error);
    if (error instanceof UserNotFoundError) {
      return apiError('User account no longer exists. Please login again.', 401);
    }
    const err = error as Error;
    return apiError(err.message || 'Topup failed', 500);
  }
}
