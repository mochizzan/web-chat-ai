import { OpenAIErrorResponse } from '@/types/openai-api';

/**
 * OpenAI-compatible error response helper.
 * Follows OpenAI's error format: { error: { message, type, param, code } }
 *
 * Maps HTTP status codes to OpenAI error types:
 *   - 400 → invalid_request_error
 *   - 401 → authentication_error
 *   - 402 → insufficient_quota
 *   - 404 → not_found
 *   - 429 → rate_limit_error
 *   - 500 → api_error
 *   - 502 → bad_gateway
 *   - 503 → service_unavailable
 */
const ERROR_TYPE_MAP: Record<number, string> = {
  400: 'invalid_request_error',
  401: 'authentication_error',
  402: 'insufficient_quota',
  404: 'not_found',
  429: 'rate_limit_error',
  500: 'api_error',
  502: 'bad_gateway',
  503: 'service_unavailable',
};

/**
 * Create an OpenAI-compatible error Response.
 *
 * @param message - Human-readable error message
 * @param status - HTTP status code (default: 500)
 * @param code - OpenAI error code string (e.g., 'insufficient_quota', 'model_not_found')
 * @param param - Optional parameter name that caused the error
 *
 * @example
 * return oaiError('Model not found', 404, 'model_not_found');
 * // → Response { status: 404, body: { error: { message: 'Model not found', type: 'not_found', param: null, code: 'model_not_found' } } }
 */
export function oaiError(
  message: string,
  status = 500,
  code = 'internal_error',
  param: string | null = null
): Response {
  const type = ERROR_TYPE_MAP[status] || 'api_error';

  const body: OpenAIErrorResponse = {
    error: { message, type, param, code },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

/**
 * Create a 401 authentication error (invalid or missing API key).
 */
export function oaiAuthError(detail = 'Invalid API key'): Response {
  return oaiError(detail, 401, 'invalid_api_key');
}

/**
 * Create a 402 insufficient quota error.
 */
export function oaiQuotaError(message = 'Kredit tidak cukup'): Response {
  return oaiError(message, 402, 'insufficient_quota');
}

/**
 * Create a 404 model not found error.
 */
export function oaiModelNotFound(modelId: string): Response {
  return oaiError(`The model '${modelId}' does not exist or is not available`, 404, 'model_not_found');
}

/**
 * Create a 429 rate limit error.
 */
export function oaiRateLimitError(message = 'Too many requests'): Response {
  return oaiError(message, 429, 'rate_limit_exceeded');
}

/**
 * Create a 502 bad gateway error (OmniRouter failure).
 */
export function oaiBadGateway(): Response {
  return oaiError('The upstream service returned an error', 502, 'bad_gateway');
}
