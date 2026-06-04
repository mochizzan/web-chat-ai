import { NextRequest } from 'next/server';
import { ModelService } from '@/services/model.service';
import { OpenAIModelListResponse, OpenAIModel } from '@/types/openai-api';
import { oaiError } from '@/lib/openai-errors';

/**
 * GET /v1/models
 *
 * Returns ONLY models that have a custom public_id assigned.
 * Internal OmniRouter IDs are NEVER exposed to BYOK API users.
 *
 * Security: Only models with non-null public_id AND status='active' are returned.
 * If an admin has not assigned a public_id to a model, it is invisible to external API users.
 *
 * Response format:
 * {
 *   object: "list",
 *   data: [{ id: "milabs/deepseek-v4-flash", object: "model", created: 1700000000, owned_by: "milabs" }, ...]
 * }
 */
export async function GET() {
  try {
    const models = await ModelService.getModelsWithPublicId();

    const data: OpenAIModel[] = models.map((m) => ({
      id: m.publicId || m.id,
      object: 'model' as const,
      created: Math.floor(Date.now() / 1000),
      owned_by: m.provider || 'system',
    }));

    const response: OpenAIModelListResponse = {
      object: 'list',
      data,
    };

    return Response.json(response, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API v1/models] Error:', err.message);
    return oaiError('Failed to fetch models', 500, 'internal_error');
  }
}

/**
 * POST /v1/models — Not supported on the public models endpoint.
 */
export async function POST() {
  return oaiError('Only GET requests are supported on this endpoint', 405, 'method_not_allowed');
}
