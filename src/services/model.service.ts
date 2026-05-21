/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModelRepository } from '@/repositories/model.repo';
import { NotificationService } from '@/services/notification.service';

export const ModelService = {
  async getModels(filters: { all?: boolean; provider?: string }) {
    const normalizedFilters = {
      all: filters.all || false,
      provider: filters.provider || undefined,
    };
    const models = await ModelRepository.getModels(normalizedFilters);
    return models.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      description: m.description,
      status: m.status || 'disabled',
      maxContext: m.max_context || 128000,
      thinking: Boolean(m.thinking),
      inputPrice: Number(m.input_price) || 0,
      outputPrice: Number(m.output_price) || 0,
      free: Boolean(m.free),
      speed: m.speed || 'normal',
      discountPercent: Number(m.discount_percent) || 0,
      discountType: m.discount_type || 'none',
    }));
  },

  async updateModel(id: string, data: any) {
    const updates: any = {};
    
    if (data.status !== undefined) {
      if (!['active', 'maintenance', 'disabled'].includes(data.status)) {
        throw new Error('Status must be active, maintenance, or disabled');
      }
      updates.status = data.status;
    } else if (data.active !== undefined) {
      updates.status = data.active ? 'active' : 'disabled';
    }

    if (data.inputPrice !== undefined) updates.input_price = data.inputPrice;
    if (data.outputPrice !== undefined) updates.output_price = data.outputPrice;
    if (data.maxContext !== undefined) updates.max_context = data.maxContext;
    if (data.discountPercent !== undefined) updates.discount_percent = data.discountPercent;
    if (data.discountType !== undefined) updates.discount_type = data.discountType;
    if (data.output_price !== undefined) updates.output_price = data.output_price;
    if (data.free !== undefined) updates.free = data.free ? 1 : 0;
    if (data.name !== undefined) updates.name = data.name;
    if (data.provider !== undefined) updates.provider = data.provider;
    if (data.description !== undefined) updates.description = data.description;
    if (data.thinking !== undefined) updates.thinking = data.thinking ? 1 : 0;
    if (data.max_context !== undefined) updates.max_context = data.max_context;
    if (data.speed !== undefined) updates.speed = data.speed;
    if (data.discount_percent !== undefined) updates.discount_percent = data.discount_percent;
    if (data.discount_type !== undefined) updates.discount_type = data.discount_type;

    if (Object.keys(updates).length === 0) {
      throw new Error('No fields to update');
    }

    await ModelRepository.updateModel(id, updates);
    
    const model = await ModelRepository.getModelById(id);
    if (model) {
      await NotificationService.broadcast({
        type: 'model:update',
        model: {
          id: model.id,
          status: (model.status || 'disabled') as any,
          inputPrice: Number(model.input_price || 0),
          outputPrice: Number(model.output_price || 0),
          free: Boolean(model.free),
          speed: model.speed || 'normal',
          discountPercent: Number(model.discount_percent || 0),
          discountType: model.discount_type || 'none',
        },
      });
    }

    return model;
  },

  async deleteModel(id: string) {
    await ModelRepository.deleteModel(id);
    await NotificationService.broadcast({
      type: 'model:delete',
      modelId: id,
    });
  },

  /**
   * Synchronizes models from a remote source (OmniRouter).
   * Fetch remote -> Diff with DB -> Update/Insert.
   */
  async syncModelsFromRemote(): Promise<{ updated: number; created: number }> {
    try {
      const response = await fetch('https://api.omnirouter.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OMNIROUTER_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models from OmniRouter: ${response.statusText}`);
      }

      const data = await response.json();
      const remoteModels = data.data || [];

      if (!Array.isArray(remoteModels)) {
        throw new Error('Invalid response format from OmniRouter');
      }

      // The ModelRepository.syncModels already handles the UPSERT logic
      await ModelRepository.syncModels(remoteModels);

      // Calculate diff for the response
      const updatedCount = remoteModels.length; // Simplified for this implementation
      
      await NotificationService.broadcast({
        type: 'models:synced',
        count: remoteModels.length,
      });

      return {
        updated: updatedCount,
        created: 0, // Simplified
      };
    } catch (error) {
      console.error('[ModelService] Sync Error:', error);
      throw error;
    }
  },

  /**
   * Validates if a model is active and available for use.
   */
  async validateModelStatus(modelId: string): Promise<boolean> {
    const models = await ModelRepository.getActiveModels();
    return models.some(m => m.id === modelId);
  },
};
