import { NextRequest } from 'next/server';
import { ApiGatewayService } from '@/services/api-gateway.service';
import { oaiError } from '@/lib/openai-errors';

/**
 * POST /v1/responses
 *
 * OpenAI-compatible Responses API endpoint (newer alternative to chat/completions).
 * Maps the `input` field to a chat completion request internally.
 *
 * Request body:
 * {
 *   model: string,
 *   input: string | Array<{ role: string, content: string }>,
 *   stream?: boolean,
 *   max_tokens?: number,
 *   temperature?: number,
 *   instructions?: string,  // mapped to system message
 *   ...
 * }
 *
 * Response (non-streaming):
 * {
 *   id: string,
 *   object: "response",
 *   created: number,
 *   model: string,
 *   output: [{ type: "message", role: "assistant", content: [...] }],
 *   ...
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
    if (!body.input) {
      return oaiError('input is required', 400, 'invalid_request', 'input');
    }

    // 3. Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');

    // 4. Validate API key, rate limit, and model availability
    const validation = await ApiGatewayService.validateRequest(authHeader, body.model);
    if ('statusCode' in validation || validation instanceof Response) {
      return validation;
    }

    const { keyContext } = validation;

    // 5. Convert input to chat messages format
    const messages: Array<{ role: string; content: string }> = [];

    // Add instructions as system message if provided
    if (body.instructions && typeof body.instructions === 'string') {
      messages.push({ role: 'system', content: body.instructions });
    }

    // Convert input to messages
    if (typeof body.input === 'string') {
      messages.push({ role: 'user', content: body.input });
    } else if (Array.isArray(body.input)) {
      for (const item of body.input) {
        if (item.type === 'message' && item.content) {
          const role = item.role || 'user';
          const content = Array.isArray(item.content)
            ? item.content.map((c: any) => c.text || '').join('\n')
            : typeof item.content === 'string'
              ? item.content
              : JSON.stringify(item.content);
          messages.push({ role, content });
        } else if (item.role && item.content) {
          messages.push({ role: item.role, content: item.content });
        }
      }
    }

    if (messages.length === 0) {
      return oaiError('input must contain at least one message or text', 400, 'invalid_request', 'input');
    }

    // 6. Convert to chat completion format and proxy
    const chatBody = {
      model: body.model,
      messages,
      stream: body.stream ?? false,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      top_p: body.top_p,
      stop: body.stop,
    };

    return await ApiGatewayService.proxyChatCompletion(keyContext, chatBody);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API v1/responses] Unexpected error:', err.message);
    return oaiError('Internal server error', 500, 'internal_error');
  }
}
