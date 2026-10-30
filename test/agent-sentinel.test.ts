import test from "node:test";
import assert from "node:assert/strict";
import { AgentSentinel } from "../src/agent-sentinel.js";

test("AgentSentinel - executes full task lifecycle with pre-debit budget reconciliation", async () => {
  const sentinel = new AgentSentinel();
  const governor = sentinel.getBudgetGovernor();

  governor.registerQuota({
    keyId: "vk_test_agent",
    agentId: "agent-test",
    agentName: "Unit Test Agent",
    allocatedBudgetUsd: 10.0,
    spentBudgetUsd: 0.0,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 256,
    isActive: true
  });

  const result = await sentinel.executeTask(
    "vk_test_agent",
    [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is the capital of Japan?" }
    ],
    100
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.routing.targetTier, "FAST_OPEN_WEIGHT");
  assert.ok(result.actualCostUsd > 0);
  assert.ok(result.costSavingsUsd > 0);
  assert.ok(result.response.choices[0].message.content.length > 0);

  const telemetry = sentinel.getTelemetry();
  assert.equal(telemetry.successfulRequests, 1);
  assert.equal(telemetry.failedRequests, 0);
  assert.ok(telemetry.totalSavingsUsd > 0);
});

test("AgentSentinel - executes automatic failover cascade when primary model fails", async () => {
  const sentinel = new AgentSentinel();
  const governor = sentinel.getBudgetGovernor();
  const router = sentinel.getRouter();

  governor.registerQuota({
    keyId: "vk_failover_agent",
    agentId: "agent-failover",
    agentName: "Failover Test Agent",
    allocatedBudgetUsd: 10.0,
    spentBudgetUsd: 0.0,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 256,
    isActive: true
  });

  // Manually trip the primary fast model
  router.setModelHealth("meta-llama/Llama-3.1-8B-Instruct", false);

  const result = await sentinel.executeTask(
    "vk_failover_agent",
    [
      { role: "user", content: "Quick greeting" }
    ],
    100
  );

  assert.equal(result.status, "SUCCESS");
  assert.notEqual(result.routing.selectedModel.id, "meta-llama/Llama-3.1-8B-Instruct");
  assert.equal(result.routing.selectedModel.id, "mistralai/Mistral-7B-Instruct-v0.3");
});

test("AgentSentinel - enforces pre-debit budget guardrail without caller token drain", async () => {
  const sentinel = new AgentSentinel();
  const governor = sentinel.getBudgetGovernor();

  governor.registerQuota({
    keyId: "vk_broke_agent",
    agentId: "agent-broke",
    agentName: "Broke Agent",
    allocatedBudgetUsd: 0.000001, // 0.0001 cents
    spentBudgetUsd: 0.0,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 500,
    isActive: true
  });

  await assert.rejects(
    async () => {
      await sentinel.executeTask(
        "vk_broke_agent",
        [{ role: "user", content: "Generate huge complex report" }],
        500
      );
    },
    { message: /Pre-debit reservation denied/ }
  );

  const telemetry = sentinel.getTelemetry();
  assert.equal(telemetry.failedRequests, 1);
  assert.equal(telemetry.successfulRequests, 0);
  assert.equal(telemetry.totalSpendUsd, 0); // Zero balance drained!
});
