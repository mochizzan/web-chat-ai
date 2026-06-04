import { NextRequest } from 'next/server';
import { ApiGatewayService } from '@/services/api-gateway.service';
import { oaiError } from '@/lib/openai-errors';

/**
 * POST /v1/completions
 *
 * OpenAI-compatible legacy completions endpoint.
 * Maps the `prompt` field to a chat completion request internally.
 *
 * Request body:
 * {
 *   model: string,
 *   prompt: string | string[],
 *   stream?: boolean,
 *   max_tokens?: number,
 *   temperature?: number,
 *   ...
 * }
 *
 * Response (non-streaming):
 * {
 *   id: string,
 *   object: "text_completion",
 *   created: number,
 *   model: string,
 *   choices: [{ text: string, index: number, finish_reason: string }],
 *   usage: { prompt_tokens, completion_tokens, total_tokens }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract and parse body
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return oaiError('Invalid JSON in request body', 400, 'invalid_request');
    }

    // 2. Validate required fields
    if (!body.model || typeof body.model !== 'string') {
      return oaiError('model is required and must be a string', 400, 'invalid_request', 'model');
    }

    // Convert prompt to messages format
    let promptText = '';
    if (typeof body.prompt === 'string') {
      promptText = body.prompt;
    } else if (Array.isArray(body.prompt)) {
      promptText = body.prompt.join('\n');
    } else {
      return oaiError('prompt is required and must be a string or array', 400, 'invalid_request', 'prompt');
    }

    // 3. Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');

    // 4. Validate API key, rate limit, and model availability
    const validation = await ApiGatewayService.validateRequest(authHeader, body.model);
    if ('statusCode' in validation || validation instanceof Response) {
      return validation;
    }

    const { keyContext } = validation;

    // 5. Convert to chat completion format and proxy
    const chatBody = {
      model: body.model,
      messages: [{ role: 'user' as const, content: promptText }],
      stream: body.stream ?? false,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      top_p: body.top_p,
      stop: body.stop,
    };

    return await ApiGatewayService.proxyChatCompletion(keyContext, chatBody);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API v1/completions] Unexpected error:', err.message);
    return oaiError('Internal server error', 500, 'internal_error');
  }
}
