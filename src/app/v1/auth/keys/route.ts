import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { generateApiKey, maskApiKey, generateApiKeyId, encryptKey } from '@/lib/api-key-auth';
import { ApiKeyRepository } from '@/repositories/api-key.repo';
import { API_KEY_MAX_PER_USER } from '@/config';
import { ApiKeyResponse } from '@/types/openai-api';

/**
 * GET /v1/auth/keys
 * List all API keys for the authenticated user.
 * Returns prefix only (never the full key or hash).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // DEVELOPMENT: allow admin to see all keys, or user sees own keys
    const userId = auth.role === 'admin'
      ? (request.nextUrl.searchParams.get('user_id') || auth.userId)
      : auth.userId;

    const keys = await ApiKeyRepository.listByUser(userId);

    const response: ApiKeyResponse[] = keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      full_key: null, // never expose full key
      has_encrypted_key: k.encrypted_key !== null,
      is_active: k.is_active === 1,
      last_used_at: k.last_used_at?.toISOString() ?? null,
      expires_at: k.expires_at?.toISOString() ?? null,
      total_requests: k.total_requests,
      total_tokens: k.total_tokens,
      created_at: k.created_at.toISOString(),
    }));

    return apiSuccess(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API Keys] GET error:', err.message);
    return apiError('Failed to fetch API keys', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /v1/auth/keys
 * Generate a new API key for the authenticated user.
 * Returns the full key ONCE (store it immediately).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const userId = auth.userId;

    // Check max active keys limit
    const activeCount = await ApiKeyRepository.countActiveByUser(userId);
    if (activeCount >= API_KEY_MAX_PER_USER) {
      return apiError(
        `Maximum ${API_KEY_MAX_PER_USER} active API keys allowed. Please revoke an existing key first.`,
        400,
        'MAX_KEYS_REACHED'
      );
    }

    // Parse optional name from body
    let name = 'Default';
    try {
      const body = await request.json();
      if (body.name && typeof body.name === 'string' && body.name.trim().length > 0) {
        name = body.name.trim().slice(0, 100);
      }
    } catch {
      // No body or invalid JSON — use default name
    }

    // Generate the key
    const { fullKey, keyPrefix, keyHash } = generateApiKey();
    const keyId = generateApiKeyId();

    // Encrypt full key for future display
    const encryptedKey = encryptKey(fullKey);

    await ApiKeyRepository.create({
      id: keyId,
      user_id: userId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      encrypted_key: encryptedKey,
      is_active: 1,
    });

    const response: ApiKeyResponse = {
      id: keyId,
      name,
      key_prefix: keyPrefix,
      full_key: fullKey, // shown ONCE — client must store this
      has_encrypted_key: true,
      is_active: true,
      last_used_at: null,
      expires_at: null,
      total_requests: 0,
      total_tokens: 0,
      created_at: new Date().toISOString(),
    };

    return apiSuccess(response, 201);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API Keys] POST error:', err.message);
    return apiError('Failed to generate API key', 500, 'INTERNAL_ERROR');
  }
}

/**
 * DELETE /v1/auth/keys?id=xxx
 * Revoke an API key (soft delete).
 * Supports:
 *   - `regenerate=true` — revoke then create a new key
 *   - `force=true` — hard delete (permanent)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const keyId = request.nextUrl.searchParams.get('id');
    if (!keyId) {
      return apiError('API key ID is required', 400, 'MISSING_PARAM');
    }

    const userId = auth.userId;
    const isRegenerate = request.nextUrl.searchParams.get('regenerate') === 'true';
    const isForce = request.nextUrl.searchParams.get('force') === 'true';

    // Find the key first to verify ownership
    const existing = await ApiKeyRepository.findById(keyId);
    if (!existing || existing.user_id !== userId) {
      return apiError('API key not found', 404, 'NOT_FOUND');
    }

    if (isForce) {
      // Hard delete (permanent)
      await ApiKeyRepository.delete(keyId, userId);
      return apiSuccess({ id: keyId, deleted: true });
    }

    // Revoke the key (soft delete)
    await ApiKeyRepository.revoke(keyId, userId);

    if (isRegenerate) {
      // Generate a new key to replace the revoked one
      const { fullKey, keyPrefix, keyHash } = generateApiKey();
      const newKeyId = generateApiKeyId();

      let name = existing.name;
      if (name === 'Default' || !name) {
        name = `${existing.name || 'Key'} (regenerated)`;
      }

      const encryptedKey = encryptKey(fullKey);

      await ApiKeyRepository.create({
        id: newKeyId,
        user_id: userId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        encrypted_key: encryptedKey,
        is_active: 1,
      });

      const response: ApiKeyResponse = {
        id: newKeyId,
        name,
        key_prefix: keyPrefix,
        full_key: fullKey,
        has_encrypted_key: true,
        is_active: true,
        last_used_at: null,
        expires_at: null,
        total_requests: 0,
        total_tokens: 0,
        created_at: new Date().toISOString(),
      };

      return apiSuccess(response, 201);
    }

    return apiSuccess({ id: keyId, revoked: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API Keys] DELETE error:', err.message);
    return apiError('Failed to process API key', 500, 'INTERNAL_ERROR');
  }
}
