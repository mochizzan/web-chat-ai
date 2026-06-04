import { NextRequest } from 'next/server';
import { ApiGatewayService } from '@/services/api-gateway.service';
import { OpenAIChatCompletionRequest } from '@/types/openai-api';
import { oaiError } from '@/lib/openai-errors';

/**
 * POST /v1/chat/completions
 *
 * OpenAI-compatible chat completion endpoint.
 * Supports both streaming and non-streaming modes.
 *
 * Authentication: Bearer API key (mi-xxx)
 * Rate limited: Per-API-key, configurable via API_RATE_LIMIT_PER_MINUTE
 *
 * Request body (OpenAI format):
 * {
 *   model: string,
 *   messages: Array<{ role, content }>,
 *   stream?: boolean,
 *   temperature?: number,
 *   max_tokens?: number,
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract and parse body
    let body: OpenAIChatCompletionRequest;
    try {
      body = await request.json();
    } catch {
      return oaiError('Invalid JSON in request body', 400, 'invalid_request');
    }

    // 2. Validate required fields
    if (!body.model || typeof body.model !== 'string') {
      return oaiError('model is required and must be a string', 400, 'invalid_request', 'model');
    }
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return oaiError('messages is required and must be a non-empty array', 400, 'invalid_request', 'messages');
    }

    // 3. Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');

    // 4. Validate API key, rate limit, and model availability
    const validation = await ApiGatewayService.validateRequest(authHeader, body.model);
    if ('statusCode' in validation || validation instanceof Response) {
      return validation; // Error response
    }

    const { keyContext } = validation;

    // 5. Proxy to OmniRouter and handle response
    return await ApiGatewayService.proxyChatCompletion(keyContext, body);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API v1/chat/completions] Unexpected error:', err.message);
    return oaiError('Internal server error', 500, 'internal_error');
  }
}

/**
 * GET /v1/chat/completions — Not supported.
 */
export async function GET() {
  return oaiError('Only POST requests are supported on this endpoint', 405, 'method_not_allowed');
}
