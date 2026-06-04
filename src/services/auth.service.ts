/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '@/repositories/user.repo';
import { EmailVerificationRepository } from '@/repositories/email-verification.repo';
import { BillingRepository } from '@/repositories/billing.repo';
import { transaction } from '@/lib/db';
import { User } from '@/types';
import { JWT_SECRET, BONUS_CREDIT_AMOUNT, DEFAULT_CREDIT_AMOUNT } from '@/config';
import { generateOTP, hashOTP, verifyOTP } from '@/lib/otp-generator';
import { sendVerificationEmail } from '@/services/email.service';
import { NotificationService } from '@/services/notification.service';
import { OTP_EXPIRY_MINUTES } from '@/config/email';

const TOKEN_EXPIRY = '7d';

export const AuthService = {
  /**
   * Registers a new user with email verification.
   */
  async register(data: { email: string; name: string; password: string }): Promise<{ user: any; needsVerification: boolean }> {
    const existingUser = await UserRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const id = `mi-labs-${uuidv4()}`;
    
    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const verificationId = `verify-${uuidv4()}`;

    const user = await transaction(async (conn) => {
      // Create user
      const newUser = await UserRepository.create({
        id,
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: 'user',
        credit: DEFAULT_CREDIT_AMOUNT,
        total_spent: 0,
      }, conn);

      // Create email verification record
      await EmailVerificationRepository.create({
        id: verificationId,
        user_id: id,
        email: data.email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        conn,
      });

      return newUser;
    });

    // Send verification email
    try {
      await sendVerificationEmail(data.email, otp, data.name);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      // User can still resend manually from the verification dialog
    }

    return {
      user: this.mapUserToDto(user),
      needsVerification: true
    };
  },

  /**
   * Verifies email with OTP
   */
  async verifyEmail(email: string, otp: string): Promise<{ user: any }> {
    console.log(`[verifyEmail] Searching for email="${email}"`);
    
    // Find valid verification record
    const verification = await EmailVerificationRepository.findValidByEmail(email);
    
    if (!verification) {
      // Log diagnostic info for debugging
      try {
        const { query } = await import('@/lib/db');
        const allRecords = await query(
          'SELECT id, email, expires_at, created_at, used, NOW() AS db_now, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS expiry_sec FROM email_verifications WHERE email = ? ORDER BY created_at DESC',
          [email]
        );
        console.error(`[verifyEmail] NO valid record found for "${email}". All records:`, JSON.stringify(allRecords));
      } catch (logErr) {
        console.error('[verifyEmail] Failed to fetch diagnostic info:', logErr);
      }
      throw new Error('Kode OTP tidak valid atau sudah kedaluwarsa');
    }

    console.log(`[verifyEmail] Found record: id="${verification.id}", expires_at="${verification.expires_at}", used="${verification.used}"`);

    // Verify OTP
    const isValid = await verifyOTP(otp, verification.otp_hash);
    console.log(`[verifyEmail] OTP verification result: ${isValid}`);
    if (!isValid) {
      throw new Error('Kode OTP tidak valid');
    }

    // Mark verification as used, update user, and grant bonus credit
    await transaction(async (conn) => {
      await EmailVerificationRepository.markAsUsed(verification.id, conn);
      
      // Update user's email verification status
      await (conn as any).execute(
        'UPDATE users SET isEmailVerified = 1 WHERE id = ?',
        [verification.user_id]
      );

      // Grant bonus credit if configured
      const bonusAmount = BONUS_CREDIT_AMOUNT;
      if (bonusAmount > 0) {
        // Update credit balance
        await BillingRepository.updateUserCredit(verification.user_id, bonusAmount, conn);

        // Get updated balance
        const newBalance = await BillingRepository.getUserBalance(verification.user_id, conn);
        if (newBalance === null) {
          throw new Error('Failed to retrieve updated balance');
        }

        // Create credit log entry
        await BillingRepository.saveCreditLog({
          id: uuidv4(),
          user_id: verification.user_id,
          type: 'bonus',
          amount: bonusAmount,
          balance: newBalance,
          description: 'Bonus selamat datang - verifikasi email berhasil',
        }, conn);
      }
    });

    // Get updated user
    const user = await UserRepository.findById(verification.user_id);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    // Broadcast credit update via WebSocket (only if bonus was granted)
    if (BONUS_CREDIT_AMOUNT > 0) {
      await NotificationService.broadcast({
        type: 'credit:update',
        userId: verification.user_id,
        newBalance: Number(user.credit),
      });
    }

    return { user: this.mapUserToDto(user) };
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<void> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    if (user.isEmailVerified) {
      throw new Error('Email sudah terverifikasi');
    }

    // Generate new OTP first
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const verificationId = `verify-${uuidv4()}`;

    // Send email BEFORE deleting old verifications
    // This ensures if email fails, the old OTP is still valid
    await sendVerificationEmail(user.email, otp, user.name);

    // Save new verification and delete old ones in a transaction
    await transaction(async (conn) => {
      // Delete old verifications
      await (conn as any).execute(
        'DELETE FROM email_verifications WHERE user_id = ?',
        [user.id]
      );

      // Create new verification
      await EmailVerificationRepository.create({
        id: verificationId,
        user_id: user.id,
        email: user.email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        conn,
      });
    });
  },

  /**
   * Authenticates a user and returns a token and user data.
   */
  async login(credentials: { email: string; password: string }): Promise<{ token: string; user: any }> {
    const user = await UserRepository.findByEmail(credentials.email);
    if (!user || !user.password) {
      throw new Error('Email atau password tidak valid');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new Error('Email belum diverifikasi. Silakan cek email Anda untuk kode verifikasi.');
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Email atau password tidak valid');
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

      if (!user.isEmailVerified) {
        throw new Error('Email belum diverifikasi');
      }
      
      return this.mapUserToDto(user);
    } catch (error: any) {
      if (error.message === 'Email belum diverifikasi') throw error;
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
      isEmailVerified: user.isEmailVerified || 0,
    };
  },

  /**
   * Internal helper to generate JWT.
   */
  generateToken(user: User): string {
    return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  },
};