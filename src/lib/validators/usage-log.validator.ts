import { z } from 'zod';

/**
 * Schema validasi untuk Usage Log menggunakan Zod v4.
 * Memastikan data yang dikirim ke database memiliki struktur dan tipe yang benar.
 */
export const UsageLogSchema = z.object({
  id: z.string().min(1, 'id is required'),
  conversationId: z.string().min(1, 'conversationId is required'),
  modelId: z.string().min(1, 'modelId is required'),
  modelName: z.string().optional(),
  provider: z.string().optional(),
  inputTokens: z.number().int().min(0).default(0),
  outputTokens: z.number().int().min(0).default(0),
  inputCost: z.number().min(0).default(0),
  outputCost: z.number().min(0).default(0),
  totalCost: z.number().min(0).default(0),
  category: z.string().default('chat'),
  messageId: z.string().optional(),
});

export type ValidatedUsageLog = z.infer<typeof UsageLogSchema>;

/**
 * Validasi data usage log.
 * Melempar ZodError jika data tidak sesuai schema.
 */
export function validateUsageLog(data: unknown): ValidatedUsageLog {
  return UsageLogSchema.parse(data);
}

/**
 * Validasi data usage log dengan safe mode.
 * Mengembalikan { success, data } daripada throw error.
 */
export function validateUsageLogSafe(data: unknown): {
  success: boolean;
  data?: ValidatedUsageLog;
  error?: z.ZodError;
} {
  const result = UsageLogSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}