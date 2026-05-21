/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '@/repositories/user.repo';
import { transaction } from '@/lib/db';
import { User } from '@/types';
import { JWT_SECRET } from '@/config';
const TOKEN_EXPIRY = '7d';

export const AuthService = {
  /**
   * Registers a new user.
   */
  async register(data: { email: string; name: string; password: string }): Promise<any> {
    const existingUser = await UserRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const user = await transaction(async (conn) => {
      return await UserRepository.create({
        ...data,
        password: hashedPassword,
        role: 'user',
        credit: 0,
        total_spent: 0,
      }, conn);
    });

    return this.mapUserToDto(user);
  },

  /**
   * Authenticates a user and returns a token and user data.
   */
  async login(credentials: { email: string; password: string }): Promise<{ token: string; user: any }> {
    const user = await UserRepository.findByEmail(credentials.email);
    if (!user || !user.password) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user);
    
    return {
      token,
      user: this.mapUserToDto(user),
    };
  },

  /**
   * Verifies a JWT token and returns the associated user.
   */
  async validateSession(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await UserRepository.findById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return this.mapUserToDto(user);
    } catch {
      throw new Error('Invalid or expired session');
    }
  },

  mapUserToDto(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      credit: Number(user.credit),
      totalSpent: Number(user.total_spent),
      createdAt: user.created_at,
    };
  },

  /**
   * Internal helper to generate JWT.
   */
  generateToken(user: User): string {
    return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  },
};
