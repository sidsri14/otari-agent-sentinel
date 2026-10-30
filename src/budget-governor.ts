import {
  ModelEndpoint,
  OtariUsage,
  PreDebitReservation,
  VirtualApiKeyQuota
} from "./types.js";

export class BudgetGovernor {
  private quotas: Map<string, VirtualApiKeyQuota> = new Map();
  private reservations: Map<string, PreDebitReservation> = new Map();

  // Standard Frontier Model Cost Benchmark for Savings Analysis ($0.003/1k input, $0.015/1k output)
  public static readonly FRONTIER_BENCHMARK_INPUT_PER_1K = 0.003;
  public static readonly FRONTIER_BENCHMARK_OUTPUT_PER_1K = 0.015;

  /**
   * Register a new Virtual API Key Quota for an autonomous agent
   */
  public registerQuota(quota: VirtualApiKeyQuota): void {
    this.quotas.set(quota.keyId, { ...quota });
  }

  /**
   * Get current quota state
   */
  public getQuota(keyId: string): VirtualApiKeyQuota | undefined {
    const q = this.quotas.get(keyId);
    return q ? { ...q } : undefined;
  }

  /**
   * Estimate the maximum cost ceiling for a request
   */
  public estimateCost(
    promptTokens: number,
    maxOutputTokens: number,
    model: ModelEndpoint
  ): number {
    const inputCost = (promptTokens / 1000) * model.costPer1kInput;
    const outputCost = (maxOutputTokens / 1000) * model.costPer1kOutput;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }

  /**
   * Pre-Debit Token Budget Reservation
   * Atomic check against remaining allocated budget.
   */
  public reserveBudget(
    keyId: string,
    promptTokens: number,
    maxOutputTokens: number,
    model: ModelEndpoint
  ): PreDebitReservation {
    const quota = this.quotas.get(keyId);
    if (!quota) {
      throw new Error(`Virtual Key [${keyId}] not recognized or unallocated.`);
    }

    if (!quota.isActive) {
      throw new Error(`Virtual Key [${keyId}] is currently deactivated.`);
    }

    const estimatedCostUsd = this.estimateCost(promptTokens, maxOutputTokens, model);
    const availableBudget = quota.allocatedBudgetUsd - (quota.spentBudgetUsd + quota.activeReservationsUsd);

    if (estimatedCostUsd > availableBudget) {
      throw new Error(
        `Pre-debit reservation denied: Estimated cost $${estimatedCostUsd.toFixed(6)} exceeds available quota $${availableBudget.toFixed(6)} (Allocated: $${quota.allocatedBudgetUsd.toFixed(2)}, Spent: $${quota.spentBudgetUsd.toFixed(4)}, In-Flight: $${quota.activeReservationsUsd.toFixed(4)}).`
      );
    }

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const reservation: PreDebitReservation = {
      reservationId,
      keyId,
      agentId: quota.agentId,
      estimatedCostUsd,
      maxTokens: maxOutputTokens,
      reservedAt: Date.now(),
      status: "PENDING"
    };

    // Update in-flight reservations
    quota.activeReservationsUsd = Math.round((quota.activeReservationsUsd + estimatedCostUsd) * 1000000) / 1000000;
    this.reservations.set(reservationId, reservation);

    return reservation;
  }

  /**
   * Post-Debit Reconciliation
   * Adjusts actual token cost, releases the reservation, and commits actual spend.
   */
  public reconcile(
    reservationId: string,
    usage: OtariUsage,
    model: ModelEndpoint
  ): { actualCostUsd: number; frontierBenchmarkUsd: number; costSavingsUsd: number } {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new Error(`Reservation [${reservationId}] not found.`);
    }

    if (reservation.status !== "PENDING") {
      throw new Error(`Reservation [${reservationId}] is already ${reservation.status}.`);
    }

    const quota = this.quotas.get(reservation.keyId);
    if (!quota) {
      throw new Error(`Virtual Key [${reservation.keyId}] associated with reservation not found.`);
    }

    // Calculate actual cost
    const actualInputCost = (usage.prompt_tokens / 1000) * model.costPer1kInput;
    const actualOutputCost = (usage.completion_tokens / 1000) * model.costPer1kOutput;
    const actualCostUsd = Math.round((actualInputCost + actualOutputCost) * 1000000) / 1000000;

    // Calculate frontier benchmark cost
    const frontierInputCost = (usage.prompt_tokens / 1000) * BudgetGovernor.FRONTIER_BENCHMARK_INPUT_PER_1K;
    const frontierOutputCost = (usage.completion_tokens / 1000) * BudgetGovernor.FRONTIER_BENCHMARK_OUTPUT_PER_1K;
    const frontierBenchmarkUsd = Math.round((frontierInputCost + frontierOutputCost) * 1000000) / 1000000;
    const costSavingsUsd = Math.max(0, Math.round((frontierBenchmarkUsd - actualCostUsd) * 1000000) / 1000000);

    // Commit actual spend and release reservation
    quota.activeReservationsUsd = Math.max(
      0,
      Math.round((quota.activeReservationsUsd - reservation.estimatedCostUsd) * 1000000) / 1000000
    );
    quota.spentBudgetUsd = Math.round((quota.spentBudgetUsd + actualCostUsd) * 1000000) / 1000000;

    reservation.status = "RECONCILED";

    return {
      actualCostUsd,
      frontierBenchmarkUsd,
      costSavingsUsd
    };
  }

  /**
   * Release reservation if request fails before execution
   */
  public releaseReservation(reservationId: string): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.status !== "PENDING") return;

    const quota = this.quotas.get(reservation.keyId);
    if (quota) {
      quota.activeReservationsUsd = Math.max(
        0,
        Math.round((quota.activeReservationsUsd - reservation.estimatedCostUsd) * 1000000) / 1000000
      );
    }

    reservation.status = "RELEASED";
  }

  /**
   * Get all registered quotas
   */
  public getAllQuotas(): VirtualApiKeyQuota[] {
    return Array.from(this.quotas.values()).map(q => ({ ...q }));
  }
}
