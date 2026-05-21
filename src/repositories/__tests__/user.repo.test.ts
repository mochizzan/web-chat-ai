import { UserRepository } from '../user.repo';
import { query, querySingle, querySimple } from '@/lib/db';

// Mock db
jest.mock('@/lib/db');

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedQuerySingle = querySingle as jest.MockedFunction<typeof querySingle>;
const mockedQuerySimple = querySimple as jest.MockedFunction<typeof querySimple>;

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        credit: 100,
        total_spent: 50,
        created_at: new Date(),
      };

      mockedQuerySingle.mockResolvedValue(mockUser);

      const result = await UserRepository.findById('user-123');

      expect(mockedQuerySingle).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        ['user-123']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockedQuerySingle.mockResolvedValue(null);

      const result = await UserRepository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      mockedQuerySingle.mockResolvedValue(mockUser);

      const result = await UserRepository.findByEmail('test@example.com');

      expect(mockedQuerySingle).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email = ?',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockedQuerySingle.mockResolvedValue(null);

      const result = await UserRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create user with connection', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'user',
        avatar: null,
        credit: 0,
        total_spent: 0,
        api_key: null,
      };

      const mockConn = {
        execute: jest.fn().mockResolvedValue([{ insertId: 1 }]),
      };

      const mockUser = {
        ...userData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedQuerySingle.mockResolvedValue(mockUser);

      const result = await UserRepository.create(userData, mockConn);

      expect(mockConn.execute).toHaveBeenCalledWith(
        'INSERT INTO users (id, email, name, password, role, avatar, credit, total_spent, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userData.id,
          userData.email,
          userData.name,
          userData.password,
          userData.role,
          userData.avatar,
          userData.credit,
          userData.total_spent,
          userData.api_key,
        ]
      );
      expect(mockedQuerySingle).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [userData.id]);
      expect(result).toEqual(mockUser);
    });

    it('should create user without connection', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'user',
        avatar: null,
        credit: 0,
        total_spent: 0,
        api_key: null,
      };

      const mockUser = {
        ...userData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedQuery.mockResolvedValue(undefined);
      mockedQuerySingle.mockResolvedValue(mockUser);

      const result = await UserRepository.create(userData);

      expect(mockedQuery).toHaveBeenCalledWith(
        'INSERT INTO users (id, email, name, password, role, avatar, credit, total_spent, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userData.id,
          userData.email,
          userData.name,
          userData.password,
          userData.role,
          userData.avatar,
          userData.credit,
          userData.total_spent,
          userData.api_key,
        ]
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user creation fails', async () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'user',
        credit: 0,
        total_spent: 0,
      };

      mockedQuerySingle.mockResolvedValue(null);

      await expect(UserRepository.create(userData)).rejects.toThrow(
        'User creation failed: User not found after insert'
      );
    });
  });

  describe('updateCredit', () => {
    it('should update credit with connection', async () => {
      const userId = 'user-123';
      const amount = 50;

      const mockConn = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
      };

      await UserRepository.updateCredit(userId, amount, mockConn);

      expect(mockConn.execute).toHaveBeenCalledWith(
        'UPDATE users SET credit = credit + ? WHERE id = ?',
        [amount, userId]
      );
    });

    it('should update credit without connection', async () => {
      const userId = 'user-123';
      const amount = 50;

      mockedQuery.mockResolvedValue(undefined);

      await UserRepository.updateCredit(userId, amount);

      expect(mockedQuery).toHaveBeenCalledWith(
        'UPDATE users SET credit = credit + ? WHERE id = ?',
        [amount, userId]
      );
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      const userId = 'user-123';
      const role = 'admin' as const;

      const mockConn = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
      };

      await UserRepository.updateRole(userId, role, mockConn);

      expect(mockConn.execute).toHaveBeenCalledWith(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, userId]
      );
    });
  });

  describe('listUsers', () => {
    it('should list users with pagination and search', async () => {
      const page = 1;
      const limit = 10;
      const search = 'test';

      const totalResult = { total: 15 };
      const users = [
        { id: 'user-1', email: 'test1@example.com', name: 'Test User 1' },
        { id: 'user-2', email: 'test2@example.com', name: 'Test User 2' },
      ];

      mockedQuerySingle.mockResolvedValue(totalResult);
      mockedQuerySimple.mockResolvedValue(users);

      const result = await UserRepository.listUsers(page, limit, search);

      expect(mockedQuerySingle).toHaveBeenCalledWith(
        'SELECT COUNT(*) as total FROM users WHERE email LIKE ? OR name LIKE ?',
        ['%test%', '%test%']
      );
      expect(mockedQuerySimple).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['%test%', '%test%']
      );
      expect(result).toEqual({ users, total: 15 });
    });

    it('should handle empty search', async () => {
      const page = 1;
      const limit = 10;

      const totalResult = { total: 50 };
      const users = [{ id: 'user-1', email: 'test@example.com', name: 'Test User' }];

      mockedQuerySingle.mockResolvedValue(totalResult);
      mockedQuerySimple.mockResolvedValue(users);

      const result = await UserRepository.listUsers(page, limit);

      expect(mockedQuerySingle).toHaveBeenCalledWith(
        'SELECT COUNT(*) as total FROM users WHERE email LIKE ? OR name LIKE ?',
        ['%', '%']
      );
      expect(mockedQuerySimple).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['%', '%']
      );
      expect(result.total).toBe(50);
    });

    it('should handle invalid page/limit values safely', async () => {
      const totalResult = { total: 50 };
      const users = [{ id: 'user-1', email: 'test@example.com', name: 'Test User' }];

      mockedQuerySingle.mockResolvedValue(totalResult);
      mockedQuerySimple.mockResolvedValue(users);

      // page=0 (invalid) should be clamped to 1
      const result = await UserRepository.listUsers(0, 10);
      expect(mockedQuerySimple).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['%', '%']
      );
      expect(result.total).toBe(50);

      jest.clearAllMocks();
      mockedQuerySingle.mockResolvedValue(totalResult);
      mockedQuerySimple.mockResolvedValue(users);

      // limit=0 (invalid/falsy) falls back to default 10 via Math.floor(0) || 10
      await UserRepository.listUsers(1, 0);
      expect(mockedQuerySimple).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 10 OFFSET 0',
        ['%', '%']
      );
    });

    it('should cap limit at maximum 100', async () => {
      const totalResult = { total: 50 };
      const users = [{ id: 'user-1', email: 'test@example.com', name: 'Test User' }];

      mockedQuerySingle.mockResolvedValue(totalResult);
      mockedQuerySimple.mockResolvedValue(users);

      await UserRepository.listUsers(1, 999);
      expect(mockedQuerySimple).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 100 OFFSET 0',
        ['%', '%']
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user with connection', async () => {
      const userId = 'user-123';
      const mockConn = {
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
      };

      await UserRepository.deleteUser(userId, mockConn);

      expect(mockConn.execute).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
    });

    it('should delete user without connection', async () => {
      const userId = 'user-123';
      mockedQuery.mockResolvedValue(undefined);

      await UserRepository.deleteUser(userId);

      expect(mockedQuery).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
    });
  });
});