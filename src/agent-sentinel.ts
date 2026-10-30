import { BudgetGovernor } from "./budget-governor.js";
import { CircuitBreakerRouter } from "./circuit-breaker-router.js";
import { ComplexityClassifier } from "./complexity-classifier.js";
import { OtariClient } from "./otari-client.js";
import {
  ExecutionResult,
  ModelEndpoint,
  OtariChatMessage,
  RoutingDecision,
  SentinelTelemetry
} from "./types.js";

export class AgentSentinel {
  private classifier: typeof ComplexityClassifier;
  private budgetGovernor: BudgetGovernor;
  private router: CircuitBreakerRouter;
  private client: OtariClient;

  private telemetry: SentinelTelemetry = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalFailovers: 0,
    tierDistribution: {
      FAST_OPEN_WEIGHT: 0,
      BALANCED_CODE: 0,
      REASONING_FRONTIER: 0
    },
    totalSpendUsd: 0,
    totalFrontierBenchmarkUsd: 0,
    totalSavingsUsd: 0,
    savingsPercentage: 0
  };

  constructor(options: {
    budgetGovernor?: BudgetGovernor;
    router?: CircuitBreakerRouter;
    client?: OtariClient;
  } = {}) {
    this.classifier = ComplexityClassifier;
    this.budgetGovernor = options.budgetGovernor || new BudgetGovernor();
    this.router = options.router || new CircuitBreakerRouter();
    this.client = options.client || new OtariClient();
  }

  public getBudgetGovernor(): BudgetGovernor {
    return this.budgetGovernor;
  }

  public getRouter(): CircuitBreakerRouter {
    return this.router;
  }

  public getTelemetry(): SentinelTelemetry {
    return { ...this.telemetry, tierDistribution: { ...this.telemetry.tierDistribution } };
  }

  /**
   * Execute an Agent Task through the Sentinel & Otari Gateway
   */
  public async executeTask(
    keyId: string,
    messages: OtariChatMessage[],
    maxTokens: number = 500
  ): Promise<ExecutionResult> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const quota = this.budgetGovernor.getQuota(keyId);
    if (!quota) {
      throw new Error(`Execution rejected: Virtual Key [${keyId}] is not registered.`);
    }

    this.telemetry.totalRequests += 1;
    const startTime = Date.now();

    // 1. Evaluate Complexity
    const evaluation = this.classifier.evaluate(messages);
    this.telemetry.tierDistribution[evaluation.tier] += 1;

    // 2. Select Optimal Route & Fallbacks
    const { primary, fallbacks } = this.router.resolveRoute(evaluation.tier);
    const candidateChain = [primary, ...fallbacks];

    let lastError: Error | null = null;
    let fallbackCount = 0;
    const failoverHistory: string[] = [];

    // Attempt through candidate chain (Primary -> Secondary -> Tertiary)
    for (const currentModel of candidateChain) {
      let reservationId = "";
      try {
        // 3. Pre-Debit Budget Reservation
        const reservation = this.budgetGovernor.reserveBudget(
          keyId,
          evaluation.estimatedTokens,
          maxTokens,
          currentModel
        );
        reservationId = reservation.reservationId;

        // 4. Dispatch Request via Otari Gateway
        const reqStart = Date.now();
        const response = await this.client.createChatCompletion({
          model: currentModel.id,
          messages,
          max_tokens: maxTokens
        });
        const latencyMs = Date.now() - reqStart;

        // 5. Post-Debit Reconciliation
        const reconciliation = this.budgetGovernor.reconcile(
          reservationId,
          response.usage,
          currentModel
        );

        // Record Route Success
        this.router.recordSuccess(currentModel.id, latencyMs);

        // Update Telemetry
        this.telemetry.successfulRequests += 1;
        this.telemetry.totalSpendUsd = Math.round((this.telemetry.totalSpendUsd + reconciliation.actualCostUsd) * 1000000) / 1000000;
        this.telemetry.totalFrontierBenchmarkUsd = Math.round((this.telemetry.totalFrontierBenchmarkUsd + reconciliation.frontierBenchmarkUsd) * 1000000) / 1000000;
        this.telemetry.totalSavingsUsd = Math.round((this.telemetry.totalSavingsUsd + reconciliation.costSavingsUsd) * 1000000) / 1000000;
        if (this.telemetry.totalFrontierBenchmarkUsd > 0) {
          this.telemetry.savingsPercentage = Math.round((this.telemetry.totalSavingsUsd / this.telemetry.totalFrontierBenchmarkUsd) * 10000) / 100;
        }

        const routing: RoutingDecision = {
          taskId,
          agentId: quota.agentId,
          selectedModel: currentModel,
          targetTier: evaluation.tier,
          fallbackCount,
          failoverHistory,
          estimatedCostUsd: reservation.estimatedCostUsd,
          reservationId
        };

        return {
          taskId,
          agentId: quota.agentId,
          routing,
          response,
          actualCostUsd: reconciliation.actualCostUsd,
          frontierCostUsd: reconciliation.frontierBenchmarkUsd,
          costSavingsUsd: reconciliation.costSavingsUsd,
          latencyMs: Date.now() - startTime,
          status: "SUCCESS"
        };
      } catch (err: any) {
        lastError = err;
        // Release reservation if created
        if (reservationId) {
          this.budgetGovernor.releaseReservation(reservationId);
        }

        // If error was budget quota exceeded, do NOT failover to another model (fail fast)
        if (err.message && err.message.includes("Pre-debit reservation denied")) {
          this.telemetry.failedRequests += 1;
          throw err;
        }

        // Record model failure and trigger failover
        const isRateLimit = err.message && (err.message.includes("429") || err.message.includes("Rate Limit"));
        this.router.recordFailure(currentModel.id, isRateLimit ? "RATE_LIMIT" : "SERVER_ERROR");

        fallbackCount += 1;
        this.telemetry.totalFailovers += 1;
        failoverHistory.push(`${currentModel.id} [${isRateLimit ? "429 RateLimit" : "Error"}]`);
      }
    }

    // All candidates failed
    this.telemetry.failedRequests += 1;
    throw new Error(
      `Sentinel Execution Failed across ${candidateChain.length} models: ${lastError?.message || "Unknown error"}`
    );
  }
}
