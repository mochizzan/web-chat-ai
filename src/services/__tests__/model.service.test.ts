import { ModelService } from '../model.service';
import { ModelRepository } from '@/repositories/model.repo';
import { NotificationService } from '@/services/notification.service';

// Mock dependencies
jest.mock('@/repositories/model.repo');
jest.mock('@/services/notification.service');
jest.mock('@/lib/db', () => ({
  transaction: jest.fn().mockImplementation(async (fn: (conn: { execute: jest.Mock }) => Promise<void>) => {
    await fn({ execute: jest.fn() } as { execute: jest.Mock });
  }),
}));

const mockedModelRepository = ModelRepository as jest.Mocked<typeof ModelRepository>;
const mockedNotificationService = NotificationService as jest.Mocked<typeof NotificationService>;

describe('ModelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getModels', () => {
    it('should return mapped models with default filters', async () => {
      const mockDbModels = [
        {
          id: 'model-1',
          name: 'GPT-4o',
          provider: 'openai',
          description: 'Latest GPT-4 model',
          status: 'active',
          max_context: 128000,
          thinking: 1,
          input_price: 0.01,
          output_price: 0.03,
          free: 0,
          speed: 'normal',
          discount_percent: 10,
          discount_type: 'percentage',
        },
      ];

      mockedModelRepository.getModels.mockResolvedValue(mockDbModels);

      const result = await ModelService.getModels({});

      expect(mockedModelRepository.getModels).toHaveBeenCalledWith({ all: false, provider: undefined });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'model-1',
        name: 'GPT-4o',
        provider: 'openai',
        description: 'Latest GPT-4 model',
        status: 'active',
        maxContext: 128000,
        thinking: true,
        inputPrice: 0.01,
        outputPrice: 0.03,
        free: false,
        speed: 'normal',
        discountPercent: 10,
        discountType: 'percentage',
      });
    });

    it('should pass all=true to get all models including disabled', async () => {
      mockedModelRepository.getModels.mockResolvedValue([]);

      await ModelService.getModels({ all: true });

      expect(mockedModelRepository.getModels).toHaveBeenCalledWith({ all: true, provider: undefined });
    });

    it('should pass provider filter', async () => {
      mockedModelRepository.getModels.mockResolvedValue([]);

      await ModelService.getModels({ provider: 'openai' });

      expect(mockedModelRepository.getModels).toHaveBeenCalledWith({ all: false, provider: 'openai' });
    });
  });

  describe('updateModel', () => {
    it('should update model with valid data', async () => {
      const modelId = 'model-1';
      const updates = {
        status: 'active',
        inputPrice: 0.02,
        outputPrice: 0.04,
      };
      const updatedModel = {
        id: modelId,
        name: 'GPT-4o',
        provider: 'openai',
        description: 'Updated model',
        status: 'active',
        max_context: 128000,
        thinking: 1,
        input_price: 0.02,
        output_price: 0.04,
        free: 0,
        speed: 'normal',
        discount_percent: 0,
        discount_type: 'none',
      };

      mockedModelRepository.updateModel.mockResolvedValue(undefined);
      mockedModelRepository.getModelById.mockResolvedValue(updatedModel);

      const result = await ModelService.updateModel(modelId, updates);

      expect(mockedModelRepository.updateModel).toHaveBeenCalledWith(modelId, {
        status: 'active',
        input_price: 0.02,
        output_price: 0.04,
      });
      expect(mockedNotificationService.broadcast).toHaveBeenCalledWith({
        type: 'model:update',
        model: {
          id: modelId,
          status: 'active',
          inputPrice: 0.02,
          outputPrice: 0.04,
          free: false,
          speed: 'normal',
          discountPercent: 0,
          discountType: 'none',
        },
      });
      expect(result).toEqual(updatedModel);
    });

    it('should throw error if no fields to update', async () => {
      const modelId = 'model-1';

      await expect(ModelService.updateModel(modelId, {})).rejects.toThrow('No fields to update');
      expect(mockedModelRepository.updateModel).not.toHaveBeenCalled();
    });

    it('should validate status values', async () => {
      const modelId = 'model-1';
      const updates = { status: 'invalid' };

      await expect(ModelService.updateModel(modelId, updates)).rejects.toThrow(
        'Status must be active, maintenance, or disabled'
      );
    });

    it('should convert active boolean to status string', async () => {
      const modelId = 'model-1';
      const updates = { active: true };
      const updatedModel = {
        id: modelId,
        status: 'active',
        input_price: 0,
        output_price: 0,
      };

      mockedModelRepository.updateModel.mockResolvedValue(undefined);
      mockedModelRepository.getModelById.mockResolvedValue(updatedModel);

      await ModelService.updateModel(modelId, updates);

      expect(mockedModelRepository.updateModel).toHaveBeenCalledWith(modelId, { status: 'active' });
    });

    it('should not broadcast notification if model not found', async () => {
      const modelId = 'model-1';
      const updates = { status: 'active' };

      mockedModelRepository.updateModel.mockResolvedValue(undefined);
      mockedModelRepository.getModelById.mockResolvedValue(null);

      const result = await ModelService.updateModel(modelId, updates);

      expect(mockedNotificationService.broadcast).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('deleteModel', () => {
    it('should delete model and broadcast notification', async () => {
      const modelId = 'model-1';

      mockedModelRepository.deleteModel.mockResolvedValue(undefined);

      await ModelService.deleteModel(modelId);

      expect(mockedModelRepository.deleteModel).toHaveBeenCalledWith(modelId);
      expect(mockedNotificationService.broadcast).toHaveBeenCalledWith({
        type: 'model:delete',
        modelId,
      });
    });
  });

  describe('syncModelsFromRemote', () => {
    it('should fetch and sync models from OmniRouter', async () => {
      const mockRemoteModels = [
        { id: 'model-1', name: 'GPT-4o', provider: 'openai' },
        { id: 'model-2', name: 'Claude-3', provider: 'anthropic' },
      ];
      
      // Expected normalized models after processing by normalizeRemoteModel
      const expectedNormalizedModels = mockRemoteModels.map(model => ({
        ...model,
        max_context: 128000,
        max_output_tokens: null,
        thinking: 0,
      }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockRemoteModels }),
      }) as { ok: boolean; json: () => Promise<{ data: { id: string; name: string; provider: string }[] }> };

      mockedModelRepository.syncModels.mockResolvedValue({ created: 0, updated: 2, disabled: 0 });

      const result = await ModelService.syncModelsFromRemote();

      const baseUrl = process.env.OMNIROUTER_BASE_URL || 'http://localhost:20128/v1';
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${process.env.OMNIROUTER_API_KEY}`,
        },
      });
      expect(mockedModelRepository.syncModels).toHaveBeenCalledWith(expectedNormalizedModels);
      expect(mockedNotificationService.broadcast).toHaveBeenCalledWith({
        type: 'models:synced',
        count: 2,
      });
      expect(result).toEqual({ updated: 2, created: 0, disabled: 0 });
    });

    it('should throw error if response not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }) as { ok: boolean; status: number; statusText: string };

      await expect(ModelService.syncModelsFromRemote()).rejects.toThrow(
        'Failed to fetch models from OmniRouter API (http://localhost:20128/v1): 401 Unauthorized'
      );
      expect(mockedModelRepository.syncModels).not.toHaveBeenCalled();
    });

    it('should throw error if response data is not array', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { error: 'Invalid format' } }),
      }) as { ok: boolean; json: () => Promise<{ data: { error: string } }> };

      await expect(ModelService.syncModelsFromRemote()).rejects.toThrow(
        'Invalid response format from OmniRouter API: Expected array of models'
      );
      expect(mockedModelRepository.syncModels).not.toHaveBeenCalled();
    });
  });

  describe('validateModelStatus', () => {
    it('should return true if model is active', async () => {
      const modelId = 'model-1';
      const activeModels = [
        { id: 'model-1', status: 'active' },
        { id: 'model-2', status: 'active' },
      ];

      mockedModelRepository.getActiveModels.mockResolvedValue(activeModels);

      const result = await ModelService.validateModelStatus(modelId);

      expect(mockedModelRepository.getActiveModels).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if model is not active', async () => {
      const modelId = 'model-1';
      const activeModels = [
        { id: 'model-2', status: 'active' },
      ];

      mockedModelRepository.getActiveModels.mockResolvedValue(activeModels);

      const result = await ModelService.validateModelStatus(modelId);

      expect(result).toBe(false);
    });
  });
});
