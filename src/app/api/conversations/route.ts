import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { ChatPersistenceService } from '@/services/chat-persistence.service';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401, 'UNAUTHORIZED');
    }

    const conversations = await ChatPersistenceService.getUserConversations(auth.userId);
    return apiSuccess({ conversations }, 200);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Conversations GET error:', error);
    return apiError(err.message || 'Failed to fetch conversations', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { title, model, category } = body;

    if (!title && !model && !category) {
      return apiError('At least one of title, model, or category is required', 400, 'BAD_REQUEST');
    }

    const conversation = await ChatPersistenceService.createConversation(auth.userId, {
      title,
      model,
      category,
    });

    return apiSuccess({ conversation }, 201);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Conversations POST error:', error);
    return apiError(err.message || 'Failed to create conversation', 500, 'INTERNAL_SERVER_ERROR');
  }
}
