/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModelRepository } from '@/repositories/model.repo';
import { NotificationService } from '@/services/notification.service';

/**
 * Normalize model object from remote API to internal format.
 * Remote API (OmniRouter) doesn't always send all fields.
 * Performs field mapping and derives name from id/root if name is missing.
 */
function normalizeRemoteModel(raw: any): any {
  // Derive name from root, then id if name is not present
  const derivedName = raw.name
    ?? raw.root
    ?? raw.id
    ?? null;

  // Derive provider from id (format: "provider/model-name")
  const derivedProvider = raw.provider
    ?? raw.owned_by
    ?? (raw.id?.includes('/') ? raw.id.split('/')[0] : null)
    ?? null;

  return {
    ...raw,
    name: derivedName,
    provider: derivedProvider,
    // Map capabilities to internal fields
    max_context: raw.context_length ?? raw.max_context ?? 128000,
    max_output_tokens: raw.max_output_tokens ?? null,
    thinking: raw.capabilities?.reasoning ? 1 : 0,
  };
}

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
    if (data.free !== undefined) updates.free = data.free ? 1 : 0;
    if (data.name !== undefined) updates.name = data.name;
    if (data.provider !== undefined) updates.provider = data.provider;
    if (data.description !== undefined) updates.description = data.description;
    if (data.thinking !== undefined) updates.thinking = data.thinking ? 1 : 0;
    if (data.speed !== undefined) updates.speed = data.speed;

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
  async syncModelsFromRemote(): Promise<{ updated: number; created: number; disabled: number }> {
    try {
      const baseUrl = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${process.env.OMNIROUTER_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorMessage = `Failed to fetch models from OmniRouter API (${baseUrl}): ${response.status} ${response.statusText}`;
        console.error('[ModelService] Sync Error Response:', {
          status: response.status,
          statusText: response.statusText,
          url: `${baseUrl}/models`
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Check if data.data is an array before trying to map over it
      if (!Array.isArray(data.data)) {
        throw new Error('Invalid response format from OmniRouter API: Expected array of models');
      }
      
      const remoteModels = data.data.map(normalizeRemoteModel);

      if (!Array.isArray(remoteModels)) {
        throw new Error('Invalid response format from OmniRouter API: Expected array of models');
      }

      // syncModels now returns { created, updated, disabled } with smart diff logic
      const result = await ModelRepository.syncModels(remoteModels);

      await NotificationService.broadcast({
        type: 'models:synced',
        count: remoteModels.length,
      });

      return {
        updated: result.updated,
        created: result.created,
        disabled: result.disabled,
      };
    } catch (error) {
      console.error('[ModelService] Sync Error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const baseUrl = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
        throw new Error(`Failed to connect to OmniRouter API (${baseUrl}). Please check network connectivity and API endpoint configuration.`);
      }
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
