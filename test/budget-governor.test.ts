import test from "node:test";
import assert from "node:assert/strict";
import { BudgetGovernor } from "../src/budget-governor.js";
import { ModelEndpoint, VirtualApiKeyQuota } from "../src/types.js";

const testModel: ModelEndpoint = {
  id: "test-model",
  name: "Test Model",
  tier: "FAST_OPEN_WEIGHT",
  provider: "test",
  costPer1kInput: 0.0002,
  costPer1kOutput: 0.0008,
  contextWindow: 8192,
  avgLatencyMs: 200,
  isHealthy: true,
  consecutiveFailures: 0
};

test("BudgetGovernor - manages virtual key lifecycle and pre-debit reservation", () => {
  const governor = new BudgetGovernor();
  const quota: VirtualApiKeyQuota = {
    keyId: "vk_test_1",
    agentId: "agent_01",
    agentName: "Test Agent",
    allocatedBudgetUsd: 1.0,
    spentBudgetUsd: 0.0,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 500,
    isActive: true
  };

  governor.registerQuota(quota);

  // Reserve budget for 100 prompt tokens and 200 output tokens
  const reservation = governor.reserveBudget("vk_test_1", 100, 200, testModel);

  assert.ok(reservation.reservationId.startsWith("res_"));
  assert.equal(reservation.status, "PENDING");
  assert.ok(reservation.estimatedCostUsd > 0);

  // Check that in-flight reservation is tracked
  const updatedQuota = governor.getQuota("vk_test_1");
  assert.ok(updatedQuota);
  assert.equal(updatedQuota.activeReservationsUsd, reservation.estimatedCostUsd);
  assert.equal(updatedQuota.spentBudgetUsd, 0);

  // Reconcile with actual usage
  const recon = governor.reconcile(
    reservation.reservationId,
    { prompt_tokens: 80, completion_tokens: 150, total_tokens: 230 },
    testModel
  );

  assert.ok(recon.actualCostUsd > 0);
  assert.ok(recon.frontierBenchmarkUsd > recon.actualCostUsd);
  assert.ok(recon.costSavingsUsd > 0);

  const finalQuota = governor.getQuota("vk_test_1");
  assert.ok(finalQuota);
  assert.equal(finalQuota.activeReservationsUsd, 0);
  assert.equal(finalQuota.spentBudgetUsd, recon.actualCostUsd);
});

test("BudgetGovernor - rejects reservation when cost exceeds remaining budget", () => {
  const governor = new BudgetGovernor();
  const quota: VirtualApiKeyQuota = {
    keyId: "vk_constrained",
    agentId: "agent_02",
    agentName: "Constrained Agent",
    allocatedBudgetUsd: 0.00001, // extremely small
    spentBudgetUsd: 0.0,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 500,
    isActive: true
  };

  governor.registerQuota(quota);

  assert.throws(
    () => {
      governor.reserveBudget("vk_constrained", 1000, 1000, testModel);
    },
    { message: /Pre-debit reservation denied/ }
  );
});

test("BudgetGovernor - releases reservation on error", () => {
  const governor = new BudgetGovernor();
  const quota: VirtualApiKeyQuota = {
    keyId: "vk_release_test",
    agentId: "agent_03",
    agentName: "Release Test Agent",
    allocatedBudgetUsd: 5.0,
    spentBudgetUsd: 0.0,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 500,
    isActive: true
  };

  governor.registerQuota(quota);
  const reservation = governor.reserveBudget("vk_release_test", 100, 200, testModel);

  let q = governor.getQuota("vk_release_test");
  assert.ok(q && q.activeReservationsUsd > 0);

  governor.releaseReservation(reservation.reservationId);

  q = governor.getQuota("vk_release_test");
  assert.ok(q);
  assert.equal(q.activeReservationsUsd, 0);
  assert.equal(q.spentBudgetUsd, 0);
});
