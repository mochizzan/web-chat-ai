import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /v1/health
 *
 * Simple health check endpoint — no authentication required.
 * Returns:
 * - 200: Service is healthy
 * - 503: Database connection failed
 *
 * Used by third-party applications to verify API availability.
 */
export async function GET() {
  try {
    // Test database connectivity
    const pool = getPool();
    await pool.query('SELECT 1');

    return NextResponse.json(
      {
        status: 'ok',
        service: 'ai-chat-web-api',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Health Check] Database connection failed:', err.message);

    return NextResponse.json(
      {
        status: 'error',
        service: 'ai-chat-web-api',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
