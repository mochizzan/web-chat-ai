import { NextRequest } from 'next/server';
import { ApiGatewayService } from '@/services/api-gateway.service';
import { oaiError } from '@/lib/openai-errors';

/**
 * POST /v1/messages
 *
 * Anthropic-compatible Messages API endpoint.
 * Maps Anthropic request format to internal chat completion, then maps response back.
 *
 * Request body (Anthropic format):
 * {
 *   model: string,
 *   messages: Array<{ role: "user" | "assistant", content: string | Array<{ type: "text", text: string }> }>,
 *   system?: string,
 *   max_tokens?: number,
 *   stream?: boolean,
 *   temperature?: number,
 *   ...
 * }
 *
 * Response (non-streaming):
 * {
 *   id: string,
 *   type: "message",
 *   role: "assistant",
 *   content: [{ type: "text", text: string }],
 *   model: string,
 *   stop_reason: string,
 *   usage: { input_tokens, output_tokens }
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
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return oaiError('messages is required and must be a non-empty array', 400, 'invalid_request', 'messages');
    }

    // 3. Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');

    // 4. Validate API key, rate limit, and model availability
    const validation = await ApiGatewayService.validateRequest(authHeader, body.model);
    if ('statusCode' in validation || validation instanceof Response) {
      return validation;
    }

    const { keyContext } = validation;

    // 5. Convert Anthropic messages format to OpenAI chat format
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt if provided (Anthropic puts system at top level)
    if (body.system && typeof body.system === 'string') {
      messages.push({ role: 'system', content: body.system });
    }

    // Convert each message
    for (const msg of body.messages) {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      let content = '';

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
      }

      if (content) {
        messages.push({ role, content });
      }
    }

    if (messages.length === 0) {
      return oaiError('messages must contain at least one message with text content', 400, 'invalid_request', 'messages');
    }

    // 6. Convert to chat completion format and proxy
    const chatBody = {
      model: body.model,
      messages,
      stream: body.stream ?? false,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      top_p: body.top_p,
      stop: body.stop_sequences,
    };

    return await ApiGatewayService.proxyChatCompletion(keyContext, chatBody);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API v1/messages] Unexpected error:', err.message);
    return oaiError('Internal server error', 500, 'internal_error');
  }
}
