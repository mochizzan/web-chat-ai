import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { ChatPersistenceService } from '@/services/chat-persistence.service';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const data = await ChatPersistenceService.getConversationDetails(id);

    if (!data) {
      return apiError('Conversation not found', 404, 'NOT_FOUND');
    }

    if (data.conversation?.user_id !== auth.userId && auth.role !== 'admin') {
      return apiError('Forbidden: You do not have access to this conversation', 403, 'FORBIDDEN');
    }

    return apiSuccess(data, 200);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Conversation GET error:', error);
    return apiError(err.message || 'Failed to fetch conversation', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const data = await ChatPersistenceService.getConversationDetails(id);
    if (!data) return apiError('Conversation not found', 404, 'NOT_FOUND');
    if (data.conversation?.user_id !== auth.userId && auth.role !== 'admin') {
      return apiError('Forbidden: You do not have access to this conversation', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { category } = body;

    if (!category || typeof category !== 'string') {
      return apiError('category is required and must be a string', 400, 'BAD_REQUEST');
    }

    await ChatPersistenceService.updateConversationCategory(id, category);
    return apiSuccess({ success: true, id, category }, 200);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Conversation PATCH error:', error);
    return apiError(err.message || 'Failed to update conversation', 500, 'INTERNAL_SERVER_ERROR');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized: Please login to continue', 401, 'UNAUTHORIZED');
    }

    const { id } = await params;
    const data = await ChatPersistenceService.getConversationDetails(id);
    if (!data) return apiError('Conversation not found', 404, 'NOT_FOUND');
    if (data.conversation?.user_id !== auth.userId && auth.role !== 'admin') {
      return apiError('Forbidden: You do not have access to this conversation', 403, 'FORBIDDEN');
    }

    await ChatPersistenceService.deleteConversation(id);
    return apiSuccess({ success: true }, 200);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Conversation DELETE error:', error);
    return apiError(err.message || 'Failed to delete conversation', 500, 'INTERNAL_SERVER_ERROR');
  }
}
