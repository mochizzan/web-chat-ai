import { AuthService } from '../auth.service';
import { UserRepository } from '@/repositories/user.repo';
import { transaction } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('@/repositories/user.repo');
jest.mock('@/lib/db');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('@/config', () => ({
  JWT_SECRET: 'default-secret-key-change-me'
}));

const mockedUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
const mockedTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockedBcryptHash = bcrypt.hash as jest.Mock;
const mockedBcryptCompare = bcrypt.compare as jest.Mock;
const mockedJwtVerify = jwt.verify as jest.Mock;
const mockedJwtSign = jwt.sign as jest.Mock;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'default-secret-key-change-me';
    process.env.NEXT_PUBLIC_JWT_SECRET = 'default-secret-key-change-me';
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      };

      const hashedPassword = 'hashed-password-123';
      mockedBcryptHash.mockResolvedValue(hashedPassword);

      const newUser = {
        id: 'user-123',
        email: userData.email,
        name: userData.name,
        role: 'user',
        avatar: null,
        credit: 0,
        total_spent: 0,
        api_key: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockedUserRepository.findByEmail.mockResolvedValue(null);
      mockedTransaction.mockResolvedValue(newUser);

      const result = await AuthService.register(userData);

      expect(mockedUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockedBcryptHash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockedTransaction).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toEqual({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        avatar: newUser.avatar,
        credit: 0,
        totalSpent: 0,
        createdAt: newUser.created_at,
      });
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        name: 'Existing User',
        password: 'password123',
      };

      mockedUserRepository.findByEmail.mockResolvedValue({
        id: 'user-456',
        email: userData.email,
        name: userData.name,
        role: 'user',
        credit: 0,
        total_spent: 0,
        created_at: new Date(),
      });

      await expect(AuthService.register(userData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should handle database errors during registration', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      };

      mockedUserRepository.findByEmail.mockResolvedValue(null);
      mockedTransaction.mockRejectedValue(new Error('Database connection failed'));

      await expect(AuthService.register(userData)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const user = {
        id: 'user-123',
        email: credentials.email,
        name: 'Test User',
        role: 'user',
        password: 'hashed-password',
        credit: 100,
        total_spent: 50,
        created_at: new Date(),
      };

      mockedUserRepository.findByEmail.mockResolvedValue(user);
      mockedBcryptCompare.mockResolvedValue(true);
      mockedJwtSign.mockReturnValue('test-jwt-token');

      const result = await AuthService.login(credentials);

      expect(mockedUserRepository.findByEmail).toHaveBeenCalledWith(credentials.email);
      expect(mockedBcryptCompare).toHaveBeenCalledWith(credentials.password, 'hashed-password');
      expect(mockedJwtSign).toHaveBeenCalledWith(
        { userId: user.id, role: user.role },
        'default-secret-key-change-me',
        { expiresIn: '7d' }
      );
      expect(result).toEqual({
        token: 'test-jwt-token',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          credit: 100,
          totalSpent: 50,
          createdAt: user.created_at,
        },
      });
    });

    it('should throw error for invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockedUserRepository.findByEmail.mockResolvedValue(null);

      await expect(AuthService.login(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error for incorrect password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const user = {
        id: 'user-123',
        email: credentials.email,
        name: 'Test User',
        role: 'user',
        password: 'hashed-password',
        credit: 100,
        total_spent: 50,
        created_at: new Date(),
      };

      mockedUserRepository.findByEmail.mockResolvedValue(user);
      mockedBcryptCompare.mockResolvedValue(false);

      await expect(AuthService.login(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error if user has no password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const user = {
        id: 'user-123',
        email: credentials.email,
        name: 'Test User',
        role: 'user',
        password: undefined,
        credit: 100,
        total_spent: 50,
        created_at: new Date(),
      };

      mockedUserRepository.findByEmail.mockResolvedValue(user);

      await expect(AuthService.login(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  describe('validateSession', () => {
    it('should validate a valid token and return user data', async () => {
      const token = 'valid-jwt-token';
      const decoded = { userId: 'user-123' };

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        credit: 100,
        total_spent: 50,
        created_at: new Date(),
      };

      mockedJwtVerify.mockReturnValue(decoded);
      mockedUserRepository.findById.mockResolvedValue(user);

      const result = await AuthService.validateSession(token);

      expect(mockedJwtVerify).toHaveBeenCalledWith(token, 'default-secret-key-change-me');
      expect(mockedUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        credit: 100,
        totalSpent: 50,
        createdAt: user.created_at,
      });
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid-jwt-token';
      mockedJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(AuthService.validateSession(token)).rejects.toThrow(
        'Invalid or expired session'
      );
    });

    it('should throw error if user not found', async () => {
      const token = 'valid-jwt-token';
      const decoded = { id: 'nonexistent-user' };

      mockedJwtVerify.mockReturnValue(decoded);
      mockedUserRepository.findById.mockResolvedValue(null);

      await expect(AuthService.validateSession(token)).rejects.toThrow(
        'Invalid or expired session'
      );
    });
  });

  describe('mapUserToDto', () => {
    it('should map user object to DTO correctly', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as const,
        avatar: null,
        credit: 123.456,
        total_spent: 789.012,
        created_at: '2024-01-01T00:00:00.000Z',
      };

      const result = AuthService.mapUserToDto(user);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        avatar: null,
        credit: 123.456,
        totalSpent: 789.012,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token correctly', () => {
      const user = {
        id: 'user-123',
        role: 'user',
      };

      const token = AuthService.generateToken(user);

      expect(mockedJwtSign).toHaveBeenCalledWith(
        { userId: 'user-123', role: 'user' },
        'default-secret-key-change-me',
        { expiresIn: '7d' }
      );
      expect(token).toBe('test-jwt-token');
    });
  });
});