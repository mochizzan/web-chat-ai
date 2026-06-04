import { query, querySingle, querySimple } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { EmailVerification } from '@/types';

export const EmailVerificationRepository = {
  /**
   * Create a new email verification record
   */
  async create(data: {
    id: string;
    user_id: string;
    email: string;
    otp_hash: string;
    expires_at: Date;
    conn?: PoolConnection;
  }): Promise<EmailVerification> {
    const { id, user_id, email, otp_hash, expires_at, conn } = data;
    
    if (conn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conn as any).execute(
        'INSERT INTO email_verifications (id, user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
        [id, user_id, email, otp_hash, expires_at]
      );
    } else {
      await query(
        'INSERT INTO email_verifications (id, user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
        [id, user_id, email, otp_hash, expires_at]
      );
    }
    
    const verification = await this.findById(id, conn);
    if (!verification) throw new Error('Email verification creation failed');
    return verification;
  },

  /**
   * Find verification by ID
   */
  async findById(id: string, conn?: PoolConnection): Promise<EmailVerification | null> {
    if (conn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [rows] = await (conn as any).execute('SELECT * FROM email_verifications WHERE id = ?', [id]);
      return rows.length > 0 ? rows[0] as EmailVerification : null;
    }
    return await querySingle<EmailVerification>(
      'SELECT * FROM email_verifications WHERE id = ?',
      [id]
    );
  },

  /**
   * Find valid (unused and not expired) verification by email
   */
  async findValidByEmail(email: string): Promise<EmailVerification | null> {
    return await querySingle<EmailVerification>(
      'SELECT * FROM email_verifications WHERE email = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email]
    );
  },

  /**
   * Mark verification as used
   */
  async markAsUsed(id: string, conn?: PoolConnection): Promise<void> {
    if (conn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conn as any).execute(
        'UPDATE email_verifications SET used = 1 WHERE id = ?',
        [id]
      );
    } else {
      await query(
        'UPDATE email_verifications SET used = 1 WHERE id = ?',
        [id]
      );
    }
  },

  /**
   * Delete expired verifications
   */
  async deleteExpired(): Promise<number> {
    const result = await querySimple<{ affectedRows: number }>(
      'DELETE FROM email_verifications WHERE expires_at < NOW()'
    );
    return result.affectedRows;
  },

  /**
   * Delete all verifications for a user
   */
  async deleteByUserId(userId: string, conn?: PoolConnection): Promise<void> {
    if (conn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conn as any).execute(
        'DELETE FROM email_verifications WHERE user_id = ?',
        [userId]
      );
    } else {
      await query(
        'DELETE FROM email_verifications WHERE user_id = ?',
        [userId]
      );
    }
  }
};