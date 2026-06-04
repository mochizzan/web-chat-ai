import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthService } from '@/services/auth.service';
import { apiSuccess, apiError } from '@/lib/api-response';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';
import { RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS } from '@/config/email';

// Validation Schema
const VerifyEmailSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  otp: z.string().regex(/^\d{6}$/, 'Kode OTP harus tepat 6 digit angka'),
});

const ResendSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

export async function POST(request: NextRequest) {
  console.log(`[verify-email] POST request received from: ${request.url}`);

  try {
    const body = await request.json();
    console.log(`[verify-email] Request body: action="${body.action}", email="${body.email}"`);

    // Check if it's a resend request
    if (body.action === 'resend') {
      const validation = ResendSchema.safeParse(body);
      if (!validation.success) {
        console.warn(`[verify-email] Resend validation failed: ${validation.error.issues[0].message}`);
        return apiError(validation.error.issues[0].message, 400);
      }

      // Rate limit for resend
      const rateLimitKey = `resend:${body.email}`;
      if (!checkRateLimit(rateLimitKey, 3, 60000)) { // 3 attempts per minute
        console.warn(`[verify-email] Resend rate limited for: ${body.email}`);
        return apiError('Terlalu banyak permintaan resend. Coba lagi dalam 1 menit.', 429);
      }

      await AuthService.resendVerification(body.email);
      console.log(`[verify-email] Resend successful for: ${body.email}`);
      return apiSuccess({ message: 'Kode verifikasi baru telah dikirim' }, 200);
    }

    // Verify OTP
    const validation = VerifyEmailSchema.safeParse(body);
    if (!validation.success) {
      console.warn(`[verify-email] Verification validation failed: ${validation.error.issues[0].message}`);
      return apiError(validation.error.issues[0].message, 400);
    }

    const { email, otp } = validation.data;
    console.log(`[verify-email] Attempting verification for email="${email}", otp="${otp}"`);

    // Rate limit check
    const rateLimitKey = `verify:${email}`;
    if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS)) {
      console.warn(`[verify-email] Rate limited for: ${email}`);
      return apiError(`Terlalu banyak percobaan verifikasi. Coba lagi dalam 1 jam.`, 429);
    }

    const result = await AuthService.verifyEmail(email, otp);

    // Reset rate limit on successful verification
    resetRateLimit(rateLimitKey);
    console.log(`[verify-email] Verification SUCCESSFUL for: ${email}`);

    const token = AuthService.generateToken(result.user);

    const response = apiSuccess({ user: result.user, token }, 200);

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[verify-email] ERROR occurred:`, {
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
      timestamp: new Date().toISOString()
    });
    const status = err.message.includes('terverifikasi') ? 400
      : err.message.includes('tidak valid') ? 400
      : 500;
    return apiError(err.message || 'Verifikasi gagal', status);
  }
}