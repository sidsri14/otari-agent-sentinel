import { AgentSentinel } from "./agent-sentinel.js";
import { VirtualApiKeyQuota } from "./types.js";

async function runDemo() {
  console.log("================================================================================");
  console.log("  OTARI AGENT SENTINEL — Autonomous Multi-Agent Governance on Mozilla Otari");
  console.log("  Developers Wilding Hackathon 2026 Submission");
  console.log("================================================================================\n");

  const sentinel = new AgentSentinel();
  const governor = sentinel.getBudgetGovernor();

  // 1. Provision Virtual API Keys with Pre-Debit Quotas
  const agentQuotas: VirtualApiKeyQuota[] = [
    {
      keyId: "vk_market_scanner",
      agentId: "agent-01",
      agentName: "DeFi Market Depth Scanner",
      allocatedBudgetUsd: 5.0,
      spentBudgetUsd: 0.0,
      activeReservationsUsd: 0.0,
      maxTokensPerRequest: 256,
      isActive: true
    },
    {
      keyId: "vk_contract_auditor",
      agentId: "agent-02",
      agentName: "Smart Contract Sentinel Auditor",
      allocatedBudgetUsd: 25.0,
      spentBudgetUsd: 0.0,
      activeReservationsUsd: 0.0,
      maxTokensPerRequest: 1024,
      isActive: true
    },
    {
      keyId: "vk_budget_constrained",
      agentId: "agent-03",
      agentName: "Micro-Budget Agent",
      allocatedBudgetUsd: 0.00005, // Extremely small quota to test safety guard
      spentBudgetUsd: 0.0,
      activeReservationsUsd: 0.0,
      maxTokensPerRequest: 500,
      isActive: true
    }
  ];

  console.log("[1] Registering Virtual API Keys & Pre-Debit Quotas via Otari Control Plane...");
  for (const q of agentQuotas) {
    governor.registerQuota(q);
    console.log(`  ✓ Registered Key: ${q.keyId} (${q.agentName}) | Quota: $${q.allocatedBudgetUsd.toFixed(5)}`);
  }
  console.log("");

  // 2. Scenario A: Fast Open-Weight Task (Tier 1)
  console.log("[2] Executing Scenario A: Fast Market Depth Query (Tier 1 - Open Weight)");
  try {
    const resA = await sentinel.executeTask(
      "vk_market_scanner",
      [
        { role: "system", content: "You are an automated market telemetry parser." },
        { role: "user", content: "What is the current ETH/USDC mid-market price and spread?" }
      ],
      128
    );
    console.log(`  ✓ Route Selected: ${resA.routing.selectedModel.id} [${resA.routing.targetTier}]`);
    console.log(`  ✓ Tokens: ${resA.response.usage.prompt_tokens} in / ${resA.response.usage.completion_tokens} out`);
    console.log(`  ✓ Actual Cost: $${resA.actualCostUsd.toFixed(6)} (Frontier Benchmark: $${resA.frontierCostUsd.toFixed(6)})`);
    console.log(`  ✓ Cost Saved: $${resA.costSavingsUsd.toFixed(6)} (${Math.round((resA.costSavingsUsd / resA.frontierCostUsd) * 100)}%)`);
    console.log(`  ✓ Response Preview: "${resA.response.choices[0].message.content.substring(0, 60)}..."`);
  } catch (err: any) {
    console.error(`  ✗ Scenario A failed:`, err.message);
  }
  console.log("");

  // 3. Scenario B: Complex Smart Contract Security Audit (Tier 2/3)
  console.log("[3] Executing Scenario B: Smart Contract Security Audit (Tier 2/3 - Code & Logic)");
  try {
    const resB = await sentinel.executeTask(
      "vk_contract_auditor",
      [
        { role: "system", content: "You are a formal verification security auditor." },
        {
          role: "user",
          content: `Audit this Rust Solana AMM invariant check for mathematical overflow vulnerabilities:
          \`\`\`rust
          pub fn calculate_liquidation_price(entry: u64, leverage: u64, mmr_bps: u64) -> Result<u64> {
              let factor = 10_000 - (10_000 / leverage) + mmr_bps;
              Ok((entry * factor) / 10_000)
          }
          \`\`\`
          Perform step-by-step invariant verification and architectural analysis.`
        }
      ],
      512
    );
    console.log(`  ✓ Route Selected: ${resB.routing.selectedModel.id} [${resB.routing.targetTier}]`);
    console.log(`  ✓ Tokens: ${resB.response.usage.prompt_tokens} in / ${resB.response.usage.completion_tokens} out`);
    console.log(`  ✓ Actual Cost: $${resB.actualCostUsd.toFixed(6)} (Frontier Benchmark: $${resB.frontierCostUsd.toFixed(6)})`);
    console.log(`  ✓ Cost Saved: $${resB.costSavingsUsd.toFixed(6)} (${Math.round((resB.costSavingsUsd / resB.frontierCostUsd) * 100)}%)`);
    console.log(`  ✓ Audit Invariant Output:`);
    console.log(`    ${resB.response.choices[0].message.content.split("\n")[0]}`);
  } catch (err: any) {
    console.error(`  ✗ Scenario B failed:`, err.message);
  }
  console.log("");

  // 4. Scenario C: Circuit-Breaker Failover Simulation
  console.log("[4] Executing Scenario C: Primary Endpoint Outage & Automatic Failover Cascade");
  // Simulate outage on primary model
  const router = sentinel.getRouter();
  router.setModelHealth("Qwen/Qwen2.5-72B-Instruct", false);
  console.log("  ! Injected 429 RateLimit / Outage on primary model [Qwen/Qwen2.5-72B-Instruct]");

  try {
    const resC = await sentinel.executeTask(
      "vk_contract_auditor",
      [
        { role: "system", content: "You are a code synthesis assistant." },
        { role: "user", content: "Write a high-throughput async event router in TypeScript with class interfaces." }
      ],
      256
    );
    console.log(`  ✓ Failover Triggered: Switched to healthy secondary model [${resC.routing.selectedModel.id}]`);
    console.log(`  ✓ Fallback Count: ${resC.routing.fallbackCount}`);
    console.log(`  ✓ Failover History: ${JSON.stringify(resC.routing.failoverHistory)}`);
    console.log(`  ✓ Status: SUCCESS without caller pipeline disruption`);
  } catch (err: any) {
    console.error(`  ✗ Scenario C failed:`, err.message);
  }
  console.log("");

  // 5. Scenario D: Pre-Debit Budget Exhaustion Guardrail
  console.log("[5] Executing Scenario D: Pre-Debit Budget Protection Guardrail");
  try {
    await sentinel.executeTask(
      "vk_budget_constrained",
      [
        { role: "user", content: "Generate an exhaustive multi-page analysis of distributed consensus mechanisms." }
      ],
      500
    );
    console.log("  ✗ Unreachable: Task succeeded when it should have been blocked!");
  } catch (err: any) {
    console.log(`  ✓ Pre-Debit Guardrail Enforced:`);
    console.log(`    "${err.message}"`);
    console.log(`  ✓ Zero token drain. Hot wallet protected.`);
  }
  console.log("");

  // 6. Global Telemetry & Cost Efficiency Summary
  const telemetry = sentinel.getTelemetry();
  console.log("================================================================================");
  console.log("  OTARI SENTINEL TELEMETRY & COST EFFICIENCY REPORT");
  console.log("================================================================================");
  console.log(`  Total Requests Executed:    ${telemetry.totalRequests}`);
  console.log(`  Successful Executions:      ${telemetry.successfulRequests}`);
  console.log(`  Blocked / Guardrail Trips:  ${telemetry.failedRequests}`);
  console.log(`  Total Automatic Failovers:  ${telemetry.totalFailovers}`);
  console.log(`  Tier Distribution:          Fast: ${telemetry.tierDistribution.FAST_OPEN_WEIGHT} | Balanced: ${telemetry.tierDistribution.BALANCED_CODE} | Frontier: ${telemetry.tierDistribution.REASONING_FRONTIER}`);
  console.log(`  Total Actual Spend:         $${telemetry.totalSpendUsd.toFixed(6)} USD`);
  console.log(`  Frontier Benchmark Cost:    $${telemetry.totalFrontierBenchmarkUsd.toFixed(6)} USD`);
  console.log(`  NET CAPITAL SAVINGS:        $${telemetry.totalSavingsUsd.toFixed(6)} USD (${telemetry.savingsPercentage}% Saved)`);
  console.log("================================================================================\n");
}

runDemo().catch(console.error);
