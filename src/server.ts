import http from "node:http";
import { AgentSentinel } from "./agent-sentinel.js";
import { VirtualApiKeyQuota } from "./types.js";

const sentinel = new AgentSentinel();
const governor = sentinel.getBudgetGovernor();

// Seed initial virtual keys
const defaultQuotas: VirtualApiKeyQuota[] = [
  {
    keyId: "vk_market_scanner",
    agentId: "agent-01",
    agentName: "DeFi Market Depth Scanner",
    allocatedBudgetUsd: 10.0,
    spentBudgetUsd: 0.1245,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 256,
    isActive: true
  },
  {
    keyId: "vk_contract_auditor",
    agentId: "agent-02",
    agentName: "Smart Contract Sentinel Auditor",
    allocatedBudgetUsd: 50.0,
    spentBudgetUsd: 1.482,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 1024,
    isActive: true
  },
  {
    keyId: "vk_data_pipeline",
    agentId: "agent-03",
    agentName: "Data Analytics Harvester",
    allocatedBudgetUsd: 20.0,
    spentBudgetUsd: 0.651,
    activeReservationsUsd: 0.0,
    maxTokensPerRequest: 512,
    isActive: true
  }
];

for (const q of defaultQuotas) {
  governor.registerQuota(q);
}

// Track execution log in memory
const executionLog: Array<{
  id: string;
  timestamp: string;
  model: string;
  tier: string;
  cost: number;
  savings: number;
  prompt: string;
}> = [];

function renderHtml(): string {
  const telemetry = sentinel.getTelemetry();
  const quotas = governor.getAllQuotas();
  const models = sentinel.getRouter().getModels();

  const quotaRows = quotas
    .map(
      q => `
    <div style="background:#161b22; border:1px solid #30363d; border-radius:8px; padding:14px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600; color:#58a6ff;">${q.agentName}</span>
        <span style="font-size:12px; background:#238636; color:#fff; padding:2px 8px; border-radius:12px;">ACTIVE</span>
      </div>
      <div style="font-size:12px; color:#8b949e; margin-top:4px;">Key ID: <code>${q.keyId}</code></div>
      <div style="margin-top:10px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#c9d1d9;">
          <span>Spent: $${q.spentBudgetUsd.toFixed(4)}</span>
          <span>Allocated: $${q.allocatedBudgetUsd.toFixed(2)}</span>
        </div>
        <div style="background:#21262d; border-radius:4px; height:8px; margin-top:4px; overflow:hidden;">
          <div style="background:#2ea043; height:100%; width:${Math.min(100, (q.spentBudgetUsd / q.allocatedBudgetUsd) * 100)}%;"></div>
        </div>
      </div>
    </div>`
    )
    .join("");

  const modelRows = models
    .map(
      m => `
    <tr style="border-bottom:1px solid #21262d;">
      <td style="padding:10px; font-weight:600;">${m.name}</td>
      <td style="padding:10px;"><code style="font-size:11px; background:#21262d; padding:2px 6px; border-radius:4px;">${m.tier}</code></td>
      <td style="padding:10px;">$${m.costPer1kOutput.toFixed(4)}</td>
      <td style="padding:10px;">${m.avgLatencyMs}ms</td>
      <td style="padding:10px;">
        <span style="padding:2px 8px; border-radius:12px; font-size:11px; background:${m.isHealthy ? "#238636" : "#da3633"}; color:#fff;">
          ${m.isHealthy ? "HEALTHY" : "CIRCUIT TRIPPED"}
        </span>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Otari Agent Sentinel HUD</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 24px; }
    h1, h2, h3 { color: #f0f6fc; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-val { font-size: 28px; font-weight: 700; color: #58a6ff; margin-top: 6px; }
    .btn { background: #238636; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn:hover { background: #2ea043; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 10px; border-bottom: 2px solid #30363d; color: #8b949e; font-size: 13px; }
  </style>
</head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
    <div>
      <h1 style="margin:0;">Otari Agent Sentinel HUD</h1>
      <p style="margin:4px 0 0; color:#8b949e;">Autonomous Multi-Agent Governance & Pre-Debit Router on Mozilla Otari</p>
    </div>
    <form method="POST" action="/api/trigger-task">
      <button type="submit" class="btn">⚡ Dispatch Test Task via Sentinel</button>
    </form>
  </div>

  <div class="grid">
    <div class="card">
      <div style="color:#8b949e; font-size:13px;">Total Requests</div>
      <div class="stat-val">${telemetry.totalRequests}</div>
    </div>
    <div class="card">
      <div style="color:#8b949e; font-size:13px;">Actual Spend (USD)</div>
      <div class="stat-val" style="color:#3fb950;">$${telemetry.totalSpendUsd.toFixed(4)}</div>
    </div>
    <div class="card">
      <div style="color:#8b949e; font-size:13px;">Frontier Benchmark Cost</div>
      <div class="stat-val" style="color:#8b949e;">$${telemetry.totalFrontierBenchmarkUsd.toFixed(4)}</div>
    </div>
    <div class="card">
      <div style="color:#8b949e; font-size:13px;">Net Capital Saved</div>
      <div class="stat-val" style="color:#d29922;">$${telemetry.totalSavingsUsd.toFixed(4)} (${telemetry.savingsPercentage}%)</div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns: 1fr 2fr; gap: 20px;">
    <div>
      <h2>Agent Virtual Key Quotas</h2>
      ${quotaRows}
    </div>
    <div>
      <h2>Otari Gateway Model Pool</h2>
      <div class="card" style="padding:0; overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Tier</th>
              <th>Output/1k</th>
              <th>Latency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${modelRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function startServer(port = 3458) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderHtml());
    } else if (req.method === "POST" && req.url === "/api/trigger-task") {
      try {
        const result = await sentinel.executeTask(
          "vk_contract_auditor",
          [
            { role: "system", content: "You are a code synthesis assistant." },
            { role: "user", content: "Check formal invariant on AMM constant product pool." }
          ],
          256
        );
        executionLog.unshift({
          id: result.taskId,
          timestamp: new Date().toLocaleTimeString(),
          model: result.routing.selectedModel.name,
          tier: result.routing.targetTier,
          cost: result.actualCostUsd,
          savings: result.costSavingsUsd,
          prompt: "Check formal invariant on AMM constant product pool."
        });
        res.writeHead(302, { Location: "/" });
        res.end();
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Task execution error: ${err.message}`);
      }
    } else if (req.method === "GET" && req.url === "/api/telemetry") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(sentinel.getTelemetry()));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(port, () => {
    console.log(`Otari Agent Sentinel HUD listening on http://localhost:${port}`);
  });

  return server;
}

if (
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js")
) {
  startServer(3458);
}
