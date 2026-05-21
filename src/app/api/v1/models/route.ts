import { ModelService } from '@/services/model.service';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET() {
  try {
    const { updated, created } = await ModelService.syncModelsFromRemote();
    
    // After sync, we return the current models from DB to maintain contract
    const models = await ModelService.getModels({ all: true });
    
    return apiSuccess({
      models,
      sync: { updated, created }
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Pull Models API error:', error);
    return apiError(err.message || 'Failed to fetch models from Omnirouter');
  }
}
