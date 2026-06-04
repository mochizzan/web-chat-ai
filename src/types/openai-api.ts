// OpenAI-compatible TypeScript interfaces for BYOK API Gateway
// ============================================================

/** OpenAI-compatible chat completion request body */
export interface OpenAIChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
}

/** OpenAI-compatible chat completion response (non-streaming) */
export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenAI-compatible SSE chunk (streaming) */
export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | null;
  }>;
}

/** OpenAI-compatible model object */
export interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

/** OpenAI-compatible model list response */
export interface OpenAIModelListResponse {
  object: 'list';
  data: OpenAIModel[];
}

/** OpenAI-compatible error response */
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string;
  };
}

/** Internal representation of an API key with user context */
export interface ApiKeyContext {
  apiKeyId: string;
  userId: string;
  userName: string;
  userEmail: string;
  keyPrefix: string;
}

/** API key creation request body (from dashboard) */
export interface CreateApiKeyRequest {
  name?: string;
}

/** API key response (safe — no hash exposed) */
export interface ApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  full_key: string | null; // only shown ONCE on creation
  has_encrypted_key: boolean;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  total_requests: number;
  total_tokens: number;
  created_at: string;
}

/** API usage log response */
export interface ApiUsageLogResponse {
  id: string;
  api_key_id: string;
  model: string;
  stream: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

/** API usage summary */
export interface ApiUsageSummary {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
}
