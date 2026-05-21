import { ModelRepository } from '@/repositories/model.repo';
import { query, querySimple, transaction } from '@/lib/db';

// Mock the database module with all required exports
jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  querySimple: jest.fn(),
  transaction: jest.fn().mockImplementation(async (fn: (conn: { execute: jest.Mock }) => Promise<void>) => {
    const mockConn = { execute: jest.fn().mockResolvedValue([]) };
    await fn(mockConn);
  }),
}));

describe('ModelRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue([]);
    (querySimple as jest.Mock).mockResolvedValue(null);
  });

  describe('getModels', () => {
    it('should fetch all models with default filters (active and maintenance)', async () => {
      const mockModels = [
        { id: '1', name: 'GPT-4', status: 'active' },
        { id: '2', name: 'GPT-3.5', status: 'maintenance' }
      ];
      (query as jest.Mock).mockResolvedValue(mockModels);

      const result = await ModelRepository.getModels({});

      expect(query).toHaveBeenCalledWith(
        "SELECT * FROM models WHERE status IN ('active', 'maintenance') ORDER BY FIELD(status, 'active', 'maintenance', 'disabled'), provider, name",
        []
      );
      expect(result).toEqual(mockModels);
    });

    it('should fetch all models including disabled when all=true', async () => {
      const mockModels = [
        { id: '1', name: 'GPT-4', status: 'active' },
        { id: '2', name: 'Old Model', status: 'disabled' }
      ];
      (query as jest.Mock).mockResolvedValue(mockModels);

      const result = await ModelRepository.getModels({ all: true });

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM models ORDER BY FIELD(status, \'active\', \'maintenance\', \'disabled\'), provider, name',
        []
      );
      expect(result).toEqual(mockModels);
    });

    it('should filter by provider', async () => {
      const mockModels = [
        { id: '1', name: 'GPT-4', provider: 'openai' }
      ];
      (query as jest.Mock).mockResolvedValue(mockModels);

      const result = await ModelRepository.getModels({ provider: 'openai' });

      expect(query).toHaveBeenCalledWith(
        "SELECT * FROM models WHERE status IN ('active', 'maintenance') AND provider = ? ORDER BY FIELD(status, 'active', 'maintenance', 'disabled'), provider, name",
        ['openai']
      );
      expect(result).toEqual(mockModels);
    });

    it('should combine filters: all=false with provider', async () => {
      const mockModels = [
        { id: '1', name: 'GPT-4', provider: 'openai', status: 'active' }
      ];
      (query as jest.Mock).mockResolvedValue(mockModels);

      const result = await ModelRepository.getModels({ all: false, provider: 'openai' });

      expect(query).toHaveBeenCalledWith(
        "SELECT * FROM models WHERE status IN ('active', 'maintenance') AND provider = ? ORDER BY FIELD(status, 'active', 'maintenance', 'disabled'), provider, name",
        ['openai']
      );
      expect(result).toEqual(mockModels);
    });
  });

  describe('getModelById', () => {
    it('should fetch model by id when exists', async () => {
      const mockModel = { id: '1', name: 'GPT-4', provider: 'openai' };
      (querySimple as jest.Mock).mockResolvedValue(mockModel);

      const result = await ModelRepository.getModelById('1');

      expect(querySimple).toHaveBeenCalledWith('SELECT * FROM models WHERE id = ?', ['1']);
      expect(result).toEqual(mockModel);
    });

    it('should return null when model not found', async () => {
      (querySimple as jest.Mock).mockResolvedValue(null);

      const result = await ModelRepository.getModelById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateModel', () => {
    it('should update model with provided fields', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await ModelRepository.updateModel('1', { name: 'GPT-4 Updated', input_price: 0.01 });

      expect(query).toHaveBeenCalledWith(
        'UPDATE models SET name = ?, input_price = ? WHERE id = ?',
        ['GPT-4 Updated', 0.01, '1']
      );
    });

    it('should not call query if no updates provided', async () => {
      await ModelRepository.updateModel('1', {});

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle multiple field updates', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await ModelRepository.updateModel('1', {
        name: 'New Name',
        description: 'New description',
        input_price: 0.02,
        output_price: 0.04,
        status: 'active'
      });

      expect(query).toHaveBeenCalledWith(
        'UPDATE models SET name = ?, description = ?, input_price = ?, output_price = ?, status = ? WHERE id = ?',
        ['New Name', 'New description', 0.02, 0.04, 'active', '1']
      );
    });
  });

  describe('deleteModel', () => {
    it('should delete model by id', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await ModelRepository.deleteModel('1');

      expect(query).toHaveBeenCalledWith('DELETE FROM models WHERE id = ?', ['1']);
    });
  });

  describe('getActiveModels', () => {
    it('should fetch only active models', async () => {
      const mockModels = [
        { id: '1', name: 'GPT-4', status: 'active' },
        { id: '2', name: 'GPT-3.5', status: 'active' }
      ];
      (query as jest.Mock).mockResolvedValue(mockModels);

      const result = await ModelRepository.getActiveModels();

      expect(query).toHaveBeenCalledWith('SELECT * FROM models WHERE status = ?', ['active']);
      expect(result).toEqual(mockModels);
    });
  });

  describe('updateModelPricing', () => {
    it('should update model pricing', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await ModelRepository.updateModelPricing('1', { input_price: 0.01, output_price: 0.03 });

      expect(query).toHaveBeenCalledWith(
        'UPDATE models SET input_price = ?, output_price = ? WHERE id = ?',
        [0.01, 0.03, '1']
      );
    });
  });

  describe('updateModelStatus', () => {
    it('should update model status', async () => {
      (query as jest.Mock).mockResolvedValue([]);

      await ModelRepository.updateModelStatus('1', 'maintenance');

      expect(query).toHaveBeenCalledWith(
        'UPDATE models SET status = ? WHERE id = ?',
        ['maintenance', '1']
      );
    });
  });

  describe('syncModels', () => {
    it('should sync multiple models in a transaction', async () => {
      const models = [
        { id: '1', name: 'GPT-4', provider: 'openai', description: 'Test', status: 'active', max_context: 8192, thinking: false, input_price: 0.01, output_price: 0.03, free: false, speed: 'normal', discount_percent: 0, discount_type: 'none', sync_data: {} },
        { id: '2', name: 'GPT-3.5', provider: 'openai', description: 'Test 2', status: 'active', max_context: 4096, thinking: false, input_price: 0.0005, output_price: 0.0015, free: false, speed: 'normal', discount_percent: 0, discount_type: 'none', sync_data: {} }
      ];

      const { transaction: mockTransaction } = await import('@/lib/db');
      
      await ModelRepository.syncModels(models);

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle empty models array', async () => {
      const { transaction: mockTransaction } = await import('@/lib/db');

      await ModelRepository.syncModels([]);
      // Should complete without error
      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
