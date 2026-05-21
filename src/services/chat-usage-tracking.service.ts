import { BillingService } from '@/services/billing.service';
import { UserRepository } from '@/repositories/user.repo';

export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  free: boolean;
  discountPercent?: number;
  discountType?: string;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export const ChatUsageTrackingService = {
  /**
   * Calculates cost based on token usage and model pricing.
   */
  calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: ModelPricing
  ): CostCalculation | null {
    if (model.free) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 };
    }
    if (inputTokens === 0 && outputTokens === 0) return null;

    const discountPct = model.discountPercent || 0;
    const discountType = model.discountType || 'none';

    let effectiveInputPrice = model.inputPrice;
    let effectiveOutputPrice = model.outputPrice;

    if (discountPct > 0) {
      if (discountType === 'input' || discountType === 'both') {
        effectiveInputPrice = model.inputPrice * (1 - discountPct / 100);
      }
      if (discountType === 'output' || discountType === 'both') {
        effectiveOutputPrice = model.outputPrice * (1 - discountPct / 100);
      }
    }

    const inputCost = (inputTokens / 1_000_000) * effectiveInputPrice;
    const outputCost = (outputTokens / 1_000_000) * effectiveOutputPrice;
    return {
      inputCost: Math.round(inputCost * 100000000) / 100000000,
      outputCost: Math.round(outputCost * 100000000) / 100000000,
      totalCost: Math.round((inputCost + outputCost) * 100000000) / 100000000,
    };
  },

  /**
   * Estimates token count from text (approximation).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5) + 20;
  },

  /**
   * Saves usage log to database.
   */
  async saveUsageLog(log: {
    id: string;
    userId: string;
    conversationId: string;
    messageId: string;
    modelId: string;
    modelName: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    category: string;
  }): Promise<void> {
    const { ChatRepository } = await import('@/repositories/chat.repo');
    await ChatRepository.saveUsageLog(log);
  },

  /**
   * Checks if user has sufficient credits for estimated cost.
   * Returns credit remaining if check passed, throws error if insufficient.
   */
  async checkCredit(
    userId: string,
    estimatedCost: number,
    isFreeModel: boolean
  ): Promise<number> {
    if (isFreeModel) {
      return -1; // No credit check needed for free models
    }

    const minRequired = estimatedCost * 1.2;
    let creditRemaining = -1;

    try {
      const user = await UserRepository.findById(userId);
      if (user) {
        creditRemaining = Number(user.credit);
      }
    } catch {
      // DB not available, allow to proceed
      return creditRemaining;
    }

    if (creditRemaining < minRequired) {
      throw new Error(
        `INSUFFICIENT_CREDITS: Kredit tidak cukup. Diperlukan minimal ${minRequired.toFixed(4)}, tersedia ${creditRemaining.toFixed(4)}`
      );
    }

    return creditRemaining;
  },

  /**
   * Deducts credit from user's balance after chat completion.
   */
  async deductCredit(userId: string, cost: number, description: string): Promise<void> {
    await BillingService.deductCredit(userId, cost, description);
  },

  /**
   * Gets current user credit balance.
   */
  async getCreditRemaining(userId: string): Promise<number> {
    try {
      const user = await UserRepository.findById(userId);
      return user ? Number(user.credit) : -1;
    } catch {
      return -1;
    }
  },

  /**
   * Builds usage log data from chat completion.
   */
  buildUsageLog(
    logId: string,
    userId: string,
    conversationId: string,
    messageId: string,
    modelPricing: ModelPricing,
    inputTokens: number,
    outputTokens: number,
    cost: CostCalculation,
    category: string
  ) {
    return {
      id: logId,
      userId,
      conversationId,
      messageId,
      modelId: modelPricing.id,
      modelName: modelPricing.name,
      provider: modelPricing.provider,
      inputTokens,
      outputTokens,
      inputCost: cost.inputCost,
      outputCost: cost.outputCost,
      totalCost: cost.totalCost,
      category,
    };
  },
};
