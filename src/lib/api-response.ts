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
export function apiError(message: string, status = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        details,
      },
    },
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
