import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { decryptKey } from '@/lib/api-key-auth';
import { ApiKeyRepository } from '@/repositories/api-key.repo';

/**
 * GET /v1/auth/keys/:id
 * Mengembalikan full API key (decrypt dari encrypted_key).
 * Hanya pemilik key (atau admin) yang bisa mengakses.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id: keyId } = await params;
    const record = await ApiKeyRepository.findById(keyId);
    if (!record) {
      return apiError('API key not found', 404, 'NOT_FOUND');
    }

    // Pastikan key milik user ini (kecuali admin)
    if (auth.role !== 'admin' && record.user_id !== auth.userId) {
      return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    if (!record.encrypted_key) {
      return apiError(
        'Full key tidak tersedia. Key ini mungkin dibuat sebelum fitur enkripsi diaktifkan.',
        404,
        'ENCRYPTED_KEY_NOT_AVAILABLE'
      );
    }

    const fullKey = decryptKey(record.encrypted_key);

    return apiSuccess({
      id: record.id,
      full_key: fullKey,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API Key Decode] error:', err.message);
    return apiError('Gagal mendapatkan full key', 500, 'INTERNAL_ERROR');
  }
}
