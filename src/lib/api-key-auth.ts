import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { API_KEY_PREFIX, API_KEY_SECRET } from '@/config';
import { ApiKeyRepository } from '@/repositories/api-key.repo';
import { ApiKeyContext } from '@/types/openai-api';

const SALT_ROUNDS = 10;
const RANDOM_BYTES = 32; // 32 bytes → 64 hex chars → 42 chars after prefix removal

// AES-256-GCM encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Generate a new API key.
 * Format: `mi-{42 random chars}` (total 45 chars with prefix)
 * The key_prefix stores first 20 chars for lookup.
 *
 * @returns { fullKey, keyPrefix, keyHash }
 */
export function generateApiKey(): {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  // Generate random bytes and hash with secret for extra entropy
  const random = crypto.randomBytes(RANDOM_BYTES).toString('hex'); // 64 hex chars
  const hmac = crypto.createHmac('sha256', API_KEY_SECRET)
    .update(random)
    .digest('hex'); // 64 hex chars

  // Combine and truncate to 42 chars
  const combined = (random + hmac).slice(0, 42);

  // Full key with prefix: mi-{42 chars}
  const fullKey = `${API_KEY_PREFIX}${combined}`;

  // Prefix for DB lookup: first 20 chars after prefix (or prefix + 17 chars)
  const keyPrefix = fullKey.slice(0, 20);

  // Hash the full key for storage
  const keyHash = bcrypt.hashSync(fullKey, SALT_ROUNDS);

  return { fullKey, keyPrefix, keyHash };
}

/**
 * Hash a key (for storage).
 */
export function hashKey(fullKey: string): string {
  return bcrypt.hashSync(fullKey, SALT_ROUNDS);
}

/**
 * Verify an API key from Authorization header.
 * Extracts prefix from the key, looks up by prefix, then bcrypt compares.
 *
 * @param bearerToken - The full `Bearer mi-xxx...` token from Authorization header
 * @returns ApiKeyContext if valid, null if invalid
 */
export async function verifyApiKey(bearerToken: string): Promise<ApiKeyContext | null> {
  // Extract the key value from "Bearer mi-xxx..."
  const match = bearerToken.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const fullKey = match[1].trim();

  // Validate format: must start with mi-
  if (!fullKey.startsWith(API_KEY_PREFIX)) return null;

  // Extract prefix (first 20 chars) for DB lookup
  const keyPrefix = fullKey.slice(0, 20);

  // Lookup by prefix
  const record = await ApiKeyRepository.findByPrefix(keyPrefix);
  if (!record) return null;

  // Verify key_hash matches
  const isValid = bcrypt.compareSync(fullKey, record.key_hash);
  if (!isValid) return null;

  return {
    apiKeyId: record.id,
    userId: record.user_id,
    userName: '',
    userEmail: '',
    keyPrefix: record.key_prefix,
  };
}

/**
 * Mask an API key for display (show first 20 chars + "...")
 */
export function maskApiKey(fullKey: string): string {
  if (fullKey.length <= 20) return fullKey;
  return fullKey.slice(0, 20) + '...';
}

/**
 * Dapatkan 32-byte encryption key dari API_KEY_SECRET via SHA-256.
 */
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(API_KEY_SECRET).digest();
}

/**
 * Enkripsi full key untuk disimpan di database.
 * Format output: hex(iv):hex(authTag):hex(ciphertext)
 */
export function encryptKey(fullKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(fullKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi full key dari database.
 */
export function decryptKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a unique ID for API keys.
 */
export function generateApiKeyId(): string {
  return `ak_${crypto.randomBytes(16).toString('hex')}`;
}
