/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
};

/**
 * Standardized success response
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Standardized error response
 */
export function apiError(message: string, status = 500, code?: string, details?: unknown) {
  // Auto-map appropriate error codes based on HTTP status
  const errorCode = code || (
    status === 400 ? 'BAD_REQUEST'
    : status === 401 ? 'UNAUTHORIZED'
    : status === 403 ? 'FORBIDDEN'
    : status === 404 ? 'NOT_FOUND'
    : status === 409 ? 'CONFLICT'
    : status === 422 ? 'VALIDATION_ERROR'
    : status === 429 ? 'RATE_LIMITED'
    : 'INTERNAL_SERVER_ERROR'
  );
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: errorCode,
        details,
      },
    },
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
