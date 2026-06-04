import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS Middleware for /v1/* routes.
 *
 * This middleware handles CORS preflight (OPTIONS) requests and adds
 * appropriate CORS headers to API responses for third-party integrations.
 *
 * Applied to:
 *   - /v1/chat/completions
 *   - /v1/models
 *   - /v1/usage
 *   - /v1/health
 *   - /v1/auth/keys
 *   - /v1/completions
 *   - /v1/responses
 *   - /v1/messages
 *
 * NOT applied to:
 *   - /api/* (internal web app routes)
 */

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['*'];

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
];
const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
];

function isV1Route(pathname: string): boolean {
  return pathname.startsWith('/v1/');
}

function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes('*')) return '*';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return 'null'; // Not allowed
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to /v1/* routes
  if (!isV1Route(pathname)) {
    return NextResponse.next();
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    const origin = getCorsOrigin(request);
    const headers = new Headers();

    if (origin !== 'null') {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
      headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
      headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
      headers.set('Access-Control-Max-Age', '86400'); // 24 hours
      headers.set('Vary', 'Origin');
    }

    return new NextResponse(null, { status: 204, headers });
  }

  // Handle actual requests
  const response = NextResponse.next();
  const origin = getCorsOrigin(request);

  if (origin !== 'null') {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    response.headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export const config = {
  matcher: '/v1/:path*',
};
