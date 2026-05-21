import { BillingRepository } from '@/repositories/billing.repo';
import { query, querySimple, querySingle } from '@/lib/db';
import { PoolConnection } from 'mysql2/promise';

// Mock the database module
jest.mock('@/lib/db');

describe('BillingRepository', () => {
  const mockConn = {} as PoolConnection;
  const mockExecute = jest.fn();
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue([]);
    (querySimple as jest.Mock).mockResolvedValue([]);
    (querySingle as jest.Mock).mockResolvedValue(null);
    mockExecute.mockResolvedValue([[]]);
    mockConn.execute = mockExecute;
  });

  describe('saveCreditLog', () => {
    it('should insert credit log without connection', async () => {
      const log = {
        id: 'log-1',
        user_id: 'user-1',
        type: 'topup',
        amount: 100,
        balance: 500,
        description: 'Test topup'
      };

      await BillingRepository.saveCreditLog(log);

      expect(query).toHaveBeenCalledWith(
        'INSERT INTO credit_logs (id, user_id, type, amount, balance, description) VALUES (?, ?, ?, ?, ?, ?)',
        [log.id, log.user_id, log.type, log.amount, log.balance, log.description]
      );
    });

    it('should insert credit log with connection', async () => {
      const log = {
        id: 'log-2',
        user_id: 'user-2',
        type: 'deduction',
        amount: -50,
        balance: 450,
        description: 'Test deduction'
      };

      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));

      await BillingRepository.saveCreditLog(log, mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'INSERT INTO credit_logs (id, user_id, type, amount, balance, description) VALUES (?, ?, ?, ?, ?, ?)',
        [log.id, log.user_id, log.type, log.amount, log.balance, log.description]
      );
    });

    it('should handle partial log data', async () => {
      const partialLog = {
        user_id: 'user-3',
        type: 'topup',
        amount: 200
      };

      await BillingRepository.saveCreditLog(partialLog);

      expect(query).toHaveBeenCalledWith(
        'INSERT INTO credit_logs (id, user_id, type, amount, balance, description) VALUES (?, ?, ?, ?, ?, ?)',
        [null, 'user-3', 'topup', 200, null, null]
      );
    });
  });

  describe('getUsageLogs', () => {
    it('should fetch usage logs without connection', async () => {
      const mockLogs = [
        { id: '1', user_id: 'user-1', model_name: 'gpt-4', total_cost: 10 }
      ];
      (query as jest.Mock).mockResolvedValue(mockLogs);

      const result = await BillingRepository.getUsageLogs('user-1', 10);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        ['user-1']
      );
      expect(result).toEqual(mockLogs);
    });

    it('should fetch usage logs with connection', async () => {
      const mockLogs = [
        { id: '2', user_id: 'user-2', model_name: 'gpt-3.5', total_cost: 5 }
      ];
      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));
      mockExecute.mockResolvedValue([mockLogs]);

      const result = await BillingRepository.getUsageLogs('user-2', 5, mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
        ['user-2']
      );
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getAdminUsageLogs', () => {
    it('should fetch admin usage logs with pagination and no search', async () => {
      const mockCount = [{ total: 50 }];
      const mockLogs = [
        {
          id: '1',
          user_name: 'John',
          user_email: 'john@example.com',
          model_name: 'gpt-4',
          provider: 'openai',
          input_tokens: 100,
          output_tokens: 50,
          total_cost: 10,
          category: 'chat',
          created_at: '2024-01-01'
        }
      ];

      (querySimple as jest.Mock)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockLogs);

      const result = await BillingRepository.getAdminUsageLogs(1, 10, '', '7d');

      expect(querySimple).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        logs: mockLogs,
        total: 50,
        totalPages: 5
      });
    });

    it('should filter by search term', async () => {
      const mockCount = [{ total: 3 }];
      const mockLogs = [];

      (querySimple as jest.Mock)
        .mockResolvedValueOnce(mockCount)
        .mockResolvedValueOnce(mockLogs);

      await BillingRepository.getAdminUsageLogs(1, 10, 'john', '30d');

      expect(querySimple).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['%john%', '%john%', '%john%'])
      );
    });

    it('should handle different period filters', async () => {
      (querySimple as jest.Mock).mockResolvedValue([]).mockResolvedValue([]);

      await BillingRepository.getAdminUsageLogs(1, 10, '', 'today');

      expect(querySimple).toHaveBeenCalledWith(
        expect.stringContaining('CURDATE()'),
        expect.any(Array)
      );
    });

    it('should handle empty result', async () => {
      (querySimple as jest.Mock).mockResolvedValue(undefined).mockResolvedValue(undefined);

      const result = await BillingRepository.getAdminUsageLogs(1, 10, '', '7d');

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getCreditLogs', () => {
    it('should fetch credit logs without connection', async () => {
      const mockLogs = [
        { id: 'log-1', user_id: 'user-1', type: 'topup', amount: 100 }
      ];
      (query as jest.Mock).mockResolvedValue(mockLogs);

      const result = await BillingRepository.getCreditLogs('user-1', 10);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM credit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        ['user-1']
      );
      expect(result).toEqual(mockLogs);
    });

    it('should fetch credit logs with connection', async () => {
      const mockLogs = [
        { id: 'log-2', user_id: 'user-2', type: 'deduction', amount: -50 }
      ];
      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));
      mockExecute.mockResolvedValue([mockLogs]);

      const result = await BillingRepository.getCreditLogs('user-2', 5, mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM credit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
        ['user-2']
      );
      expect(result).toEqual(mockLogs);
    });
  });

  describe('updateTotalSpent', () => {
    it('should update total spent without connection', async () => {
      await BillingRepository.updateTotalSpent('user-1', 100);

      expect(query).toHaveBeenCalledWith(
        'UPDATE users SET total_spent = total_spent + ? WHERE id = ?',
        [100, 'user-1']
      );
    });

    it('should update total spent with connection', async () => {
      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));

      await BillingRepository.updateTotalSpent('user-2', 50, mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE users SET total_spent = total_spent + ? WHERE id = ?',
        [50, 'user-2']
      );
    });
  });

  describe('updateUserCredit', () => {
    it('should update user credit without connection', async () => {
      await BillingRepository.updateUserCredit('user-1', 100);

      expect(query).toHaveBeenCalledWith(
        'UPDATE users SET credit = credit + ? WHERE id = ?',
        [100, 'user-1']
      );
    });

    it('should update user credit with connection', async () => {
      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));

      await BillingRepository.updateUserCredit('user-2', -50, mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'UPDATE users SET credit = credit + ? WHERE id = ?',
        [-50, 'user-2']
      );
    });
  });

  describe('getUserBalance', () => {
    it('should get user balance without connection when user exists', async () => {
      (querySingle as jest.Mock).mockResolvedValue({ credit: 500 });

      const result = await BillingRepository.getUserBalance('user-1');

      expect(querySingle).toHaveBeenCalledWith(
        'SELECT credit FROM users WHERE id = ?',
        ['user-1']
      );
      expect(result).toBe(500);
    });

    it('should return null when user not found without connection', async () => {
      (querySingle as jest.Mock).mockResolvedValue(null);

      const result = await BillingRepository.getUserBalance('user-1');

      expect(result).toBeNull();
    });

    it('should get user balance with connection', async () => {
      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));
      mockExecute.mockResolvedValue([[{ credit: 300 }], []]);

      const result = await BillingRepository.getUserBalance('user-2', mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT credit FROM users WHERE id = ?',
        ['user-2']
      );
      expect(result).toBe(300);
    });

    it('should return null when user not found with connection', async () => {
      (query as jest.Mock).mockImplementation(() => Promise.reject(new Error('Should not call query')));
      mockExecute.mockResolvedValue([[], []]);

      const result = await BillingRepository.getUserBalance('user-2', mockConn);

      expect(result).toBeNull();
    });
  });

  describe('lockUserForUpdate', () => {
    it('should lock user row for update', async () => {
      await BillingRepository.lockUserForUpdate('user-1', mockConn);

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT credit FROM users WHERE id = ? FOR UPDATE',
        ['user-1']
      );
    });
  });
});
