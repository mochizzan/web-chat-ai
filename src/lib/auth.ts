/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '@/config';

export interface AuthUser {
  userId: string;
  role: string;
}

/**
 * Verifies the authentication token from the request.
 * Checks both the 'auth_token' cookie and the 'Authorization' header.
 * 
 * @param request The incoming NextRequest
 * @returns The decoded user payload if valid, otherwise null
 */
export function verifyAuth(request: NextRequest): AuthUser | null {
  try {
    let token: string | undefined;

    // 1. Try to get token from cookies
    const cookieToken = request.cookies.get('auth_token')?.value;
    if (cookieToken) {
      token = cookieToken;
    } else {
      // 2. Try to get token from Authorization header (Bearer token)
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return null;
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    if (!decoded.userId || !decoded.role) {
      return null;
    }

    return {
      userId: decoded.userId,
      role: decoded.role,
    };
  } catch (error: any) {
    // Only log actual server errors, not expected auth failures
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      console.warn('[Auth] Token invalid or expired:', error.message);
    } else {
      console.error('[Auth] Unexpected verification error:', error);
    }
    return null;
  }
}
