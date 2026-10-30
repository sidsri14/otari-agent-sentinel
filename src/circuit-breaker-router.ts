import { ModelEndpoint, ModelTier } from "./types.js";

export class CircuitBreakerRouter {
  private models: Map<string, ModelEndpoint> = new Map();
  private maxConsecutiveFailures = 3;
  private cooldownDurationMs = 30000; // 30s cooldown after tripping

  constructor() {
    this.initializeDefaultEndpoints();
  }

  private initializeDefaultEndpoints(): void {
    const defaultModels: ModelEndpoint[] = [
      // FAST OPEN WEIGHT TIER
      {
        id: "meta-llama/Llama-3.1-8B-Instruct",
        name: "Llama 3.1 8B Instruct",
        tier: "FAST_OPEN_WEIGHT",
        provider: "together",
        costPer1kInput: 0.00018,
        costPer1kOutput: 0.0006,
        contextWindow: 128000,
        avgLatencyMs: 180,
        isHealthy: true,
        consecutiveFailures: 0
      },
      {
        id: "mistralai/Mistral-7B-Instruct-v0.3",
        name: "Mistral 7B Instruct v0.3",
        tier: "FAST_OPEN_WEIGHT",
        provider: "fireworks",
        costPer1kInput: 0.0002,
        costPer1kOutput: 0.0006,
        contextWindow: 32768,
        avgLatencyMs: 210,
        isHealthy: true,
        consecutiveFailures: 0
      },
      // BALANCED CODE & LOGIC TIER
      {
        id: "Qwen/Qwen2.5-72B-Instruct",
        name: "Qwen 2.5 72B Instruct",
        tier: "BALANCED_CODE",
        provider: "together",
        costPer1kInput: 0.0008,
        costPer1kOutput: 0.002,
        contextWindow: 32768,
        avgLatencyMs: 450,
        isHealthy: true,
        consecutiveFailures: 0
      },
      {
        id: "meta-llama/Llama-3.3-70B-Instruct",
        name: "Llama 3.3 70B Instruct",
        tier: "BALANCED_CODE",
        provider: "together",
        costPer1kInput: 0.0009,
        costPer1kOutput: 0.0025,
        contextWindow: 128000,
        avgLatencyMs: 520,
        isHealthy: true,
        consecutiveFailures: 0
      },
      // REASONING & FRONTIER FALLBACK TIER
      {
        id: "deepseek-ai/DeepSeek-R1",
        name: "DeepSeek R1 Reasoning",
        tier: "REASONING_FRONTIER",
        provider: "fireworks",
        costPer1kInput: 0.0015,
        costPer1kOutput: 0.005,
        contextWindow: 64000,
        avgLatencyMs: 980,
        isHealthy: true,
        consecutiveFailures: 0
      },
      {
        id: "anthropic/claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        tier: "REASONING_FRONTIER",
        provider: "anthropic",
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
        contextWindow: 200000,
        avgLatencyMs: 850,
        isHealthy: true,
        consecutiveFailures: 0
      }
    ];

    for (const model of defaultModels) {
      this.models.set(model.id, model);
    }
  }

  /**
   * Get all registered models
   */
  public getModels(): ModelEndpoint[] {
    return Array.from(this.models.values()).map(m => ({ ...m }));
  }

  /**
   * Get a specific model
   */
  public getModel(id: string): ModelEndpoint | undefined {
    const m = this.models.get(id);
    return m ? { ...m } : undefined;
  }

  /**
   * Select best primary and fallback sequence for a given tier
   */
  public resolveRoute(targetTier: ModelTier): { primary: ModelEndpoint; fallbacks: ModelEndpoint[] } {
    const now = Date.now();
    const candidateList = Array.from(this.models.values());

    // Filter candidate list: must be healthy or cooldown expired
    const isAvailable = (m: ModelEndpoint) => {
      if (m.isHealthy) return true;
      if (m.rateLimitResetTime && now >= m.rateLimitResetTime) {
        // Reset circuit breaker
        m.isHealthy = true;
        m.consecutiveFailures = 0;
        m.rateLimitResetTime = undefined;
        return true;
      }
      return false;
    };

    // Candidates matching tier exactly
    let tierCandidates = candidateList
      .filter(m => m.tier === targetTier && isAvailable(m))
      .sort((a, b) => a.costPer1kOutput - b.costPer1kOutput || a.avgLatencyMs - b.avgLatencyMs);

    // Candidates in higher tiers as contingency fallbacks
    const higherTierCandidates = candidateList
      .filter(m => m.tier !== targetTier && isAvailable(m))
      .sort((a, b) => a.costPer1kOutput - b.costPer1kOutput);

    if (tierCandidates.length === 0) {
      // Degrade or upgrade tier if target tier is completely offline
      if (higherTierCandidates.length === 0) {
        throw new Error(`Circuit Breaker: All models in pool are tripped or rate-limited!`);
      }
      tierCandidates = higherTierCandidates;
    }

    const primary = tierCandidates[0];
    const fallbacks = [
      ...tierCandidates.slice(1),
      ...higherTierCandidates.filter(m => m.id !== primary.id)
    ];

    return { primary, fallbacks };
  }

  /**
   * Record a successful response
   */
  public recordSuccess(modelId: string, latencyMs: number): void {
    const model = this.models.get(modelId);
    if (!model) return;

    model.isHealthy = true;
    model.consecutiveFailures = 0;
    model.rateLimitResetTime = undefined;
    // Exponential moving average for latency
    model.avgLatencyMs = Math.round(model.avgLatencyMs * 0.8 + latencyMs * 0.2);
  }

  /**
   * Record a failure (rate limit 429, timeout, or 5xx)
   */
  public recordFailure(modelId: string, errorType: "RATE_LIMIT" | "TIMEOUT" | "SERVER_ERROR"): void {
    const model = this.models.get(modelId);
    if (!model) return;

    model.consecutiveFailures += 1;

    if (errorType === "RATE_LIMIT" || model.consecutiveFailures >= this.maxConsecutiveFailures) {
      model.isHealthy = false;
      model.rateLimitResetTime = Date.now() + this.cooldownDurationMs;
    }
  }

  /**
   * Manually force model status for testing
   */
  public setModelHealth(modelId: string, isHealthy: boolean): void {
    const model = this.models.get(modelId);
    if (model) {
      model.isHealthy = isHealthy;
      if (!isHealthy) {
        model.consecutiveFailures = this.maxConsecutiveFailures;
        model.rateLimitResetTime = Date.now() + this.cooldownDurationMs;
      } else {
        model.consecutiveFailures = 0;
        model.rateLimitResetTime = undefined;
      }
    }
  }
}
