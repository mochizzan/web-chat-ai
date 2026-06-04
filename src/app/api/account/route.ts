import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { BillingService } from '@/services/billing.service';
import { CreditLog } from '@/types';
import { UserNotFoundError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401);
    }

    const { user, creditLogs } = await BillingService.getAccountDetails(auth.userId);

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        credit: Number(user.credit),
        totalSpent: Number(user.total_spent),
        createdAt: user.created_at,
      },
      creditLogs: creditLogs.map((l: CreditLog) => ({
        id: l.id,
        type: l.type,
        amount: Number(l.amount),
        balance: Number(l.balance),
        description: l.description,
        createdAt: l.created_at,
      })),
    }, 200);
  } catch (error: unknown) {
    console.error('Account API error:', error);
    if (error instanceof UserNotFoundError) {
      return apiError('User account no longer exists. Please login again.', 401);
    }
    return apiError('Failed to fetch account info', 500);
  }
}
