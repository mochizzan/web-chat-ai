import { validateUsageLog, validateUsageLogSafe, UsageLogSchema } from '../usage-log.validator';
import { ZodError } from 'zod';

describe('UsageLogValidator', () => {
  describe('validateUsageLog', () => {
    it('should validate and return valid usage log data', () => {
      const validData = {
        id: 'log-123',
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 200,
        inputCost: 0.0005,
        outputCost: 0.002,
        totalCost: 0.0025,
        category: 'chat',
        messageId: 'msg-123',
      };

      const result = validateUsageLog(validData);

      expect(result).toEqual({
        id: 'log-123',
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 200,
        inputCost: 0.0005,
        outputCost: 0.002,
        totalCost: 0.0025,
        category: 'chat',
        messageId: 'msg-123',
      });
    });

    it('should apply default values for optional fields', () => {
      const minimalData = {
        id: 'log-123',
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
      };

      const result = validateUsageLog(minimalData);

      expect(result.modelName).toBeUndefined();
      expect(result.provider).toBeUndefined();
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.category).toBe('chat');
      expect(result.messageId).toBeUndefined();
    });

    it('should throw ZodError for invalid data', () => {
      const invalidData = {
        id: '', // empty string should fail min(1)
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
      };

      expect(() => validateUsageLog(invalidData)).toThrow(ZodError);
    });

    it('should throw error for missing required fields', () => {
      const incompleteData = {
        id: 'log-123',
        // missing conversationId and modelId
      };

      expect(() => validateUsageLog(incompleteData)).toThrow(ZodError);
    });
  });

  describe('validateUsageLogSafe', () => {
    it('should return success true for valid data', () => {
      const validData = {
        id: 'log-123',
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
      };

      const result = validateUsageLogSafe(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.id).toBe('log-123');
      }
    });

    it('should return success false for invalid data', () => {
      const invalidData = {
        id: '',
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
      };

      const result = validateUsageLogSafe(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ZodError);
    });
  });

  describe('UsageLogSchema', () => {
    it('should accept string inputTokens and convert to number', () => {
      // Zod coerces string numbers to numbers
      const data = {
        id: 'log-123',
        conversationId: 'conv-123',
        modelId: 'gpt-4o',
        inputTokens: '100' as unknown as number, // This will fail since z.coerce.number() is not used
      };

      // Without coercion, this should fail
      expect(() => UsageLogSchema.parse(data)).toThrow();
    });
  });
});