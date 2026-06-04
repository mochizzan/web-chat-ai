import { ApiKeyRepository } from '@/repositories/api-key.repo';
import { query, querySingle, querySimple, transaction } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  querySingle: jest.fn(),
  querySimple: jest.fn(),
  transaction: jest.fn().mockImplementation(async (fn: (conn: { execute: jest.Mock }) => Promise<void>) => {
    const mockConn = { execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };
    await fn(mockConn);
  }),
}));

describe('ApiKeyRepository', () => {
  const mockKey = {
    id: 'ak_test123',
    user_id: 'user-1',
    name: 'Test Key',
    key_prefix: 'mi-testprefix123',
    key_hash: '$2b$10$hashedvalue',
    is_active: 1,
    last_used_at: null,
    expires_at: null,
    total_requests: 0,
    total_tokens: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should insert a new API key', async () => {
      (query as jest.Mock).mockResolvedValue(undefined);

      await ApiKeyRepository.create({
        id: 'ak_new',
        user_id: 'user-1',
        name: 'New Key',
        key_prefix: 'mi-newprefix',
        key_hash: '$2b$10$newhash',
        is_active: 1,
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining(['ak_new', 'user-1', 'New Key', 'mi-newprefix'])
      );
    });

    it('should use conn.execute when connection is provided', async () => {
      const mockConn = { execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

      await ApiKeyRepository.create({
        id: 'ak_new',
        user_id: 'user-1',
        name: 'New Key',
        key_prefix: 'mi-newprefix',
        key_hash: '$2b$10$newhash',
        is_active: 1,
      }, mockConn as any);

      expect(mockConn.execute).toHaveBeenCalled();
    });
  });

  describe('findByPrefix', () => {
    it('should find an active key by prefix', async () => {
      (querySingle as jest.Mock).mockResolvedValue(mockKey);

      const result = await ApiKeyRepository.findByPrefix('mi-testprefix123');

      expect(querySingle).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM api_keys WHERE key_prefix = ? AND is_active = 1'),
        ['mi-testprefix123']
      );
      expect(result).toEqual(mockKey);
    });

    it('should return null when key not found', async () => {
      (querySingle as jest.Mock).mockResolvedValue(null);

      const result = await ApiKeyRepository.findByPrefix('mi-nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find a key by ID', async () => {
      (querySingle as jest.Mock).mockResolvedValue(mockKey);

      const result = await ApiKeyRepository.findById('ak_test123');
      expect(result).toEqual(mockKey);
    });
  });

  describe('listByUser', () => {
    it('should return all keys for a user (excluding key_hash)', async () => {
      (query as jest.Mock).mockResolvedValue([mockKey]);

      const result = await ApiKeyRepository.listByUser('user-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id, name, key_prefix'),
        ['user-1']
      );
      expect(query).toHaveBeenCalledWith(
        expect.not.stringContaining('key_hash'),
        expect.anything()
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('countActiveByUser', () => {
    it('should return count of active keys', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await ApiKeyRepository.countActiveByUser('user-1');
      expect(result).toBe(3);
    });

    it('should return 0 when no active keys', async () => {
      (querySingle as jest.Mock).mockResolvedValue(null);

      const result = await ApiKeyRepository.countActiveByUser('user-1');
      expect(result).toBe(0);
    });
  });

  describe('revoke', () => {
    it('should set is_active to 0', async () => {
      (query as jest.Mock).mockResolvedValue({ affectedRows: 1 });

      const result = await ApiKeyRepository.revoke('ak_test123', 'user-1');
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys SET is_active = 0'),
        ['ak_test123', 'user-1']
      );
    });
  });

  describe('delete', () => {
    it('should permanently delete a key', async () => {
      (query as jest.Mock).mockResolvedValue({ affectedRows: 1 });

      const result = await ApiKeyRepository.delete('ak_test123', 'user-1');
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM api_keys'),
        ['ak_test123', 'user-1']
      );
    });
  });

  describe('updateUsage', () => {
    it('should increment usage counters', async () => {
      (query as jest.Mock).mockResolvedValue(undefined);

      await ApiKeyRepository.updateUsage('ak_test123', 150);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('total_requests = total_requests + 1'),
        [150, 'ak_test123']
      );
    });
  });
});
