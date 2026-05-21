import { NextRequest } from 'next/server';
import { ModelService } from '@/services/model.service';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      all: searchParams.get('all') === 'true',
      provider: searchParams.get('provider') || undefined,
    };

    const models = await ModelService.getModels(filters);
    return apiSuccess({ models });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Models API GET error:', error);
    return apiError(err.message || 'Failed to fetch models');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return apiError('Model ID is required', 400, 'MISSING_ID');
    }

    const model = await ModelService.updateModel(id, body);
    return apiSuccess({ success: true, model });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Models API PUT error:', error);
    return apiError(err.message || 'Failed to update model', 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Model ID is required', 400, 'MISSING_ID');
    }

    await ModelService.deleteModel(id);
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Models API DELETE error:', error);
    return apiError(err.message || 'Failed to delete model');
  }
}
