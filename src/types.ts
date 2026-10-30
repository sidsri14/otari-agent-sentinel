/**
 * Otari Agent Sentinel — Core Types & Interfaces
 * Compatible with Mozilla Otari LLM Gateway & Control Plane
 */

export type ModelTier = "FAST_OPEN_WEIGHT" | "BALANCED_CODE" | "REASONING_FRONTIER";

export interface ModelEndpoint {
  id: string;
  name: string;
  tier: ModelTier;
  provider: string; // e.g., "together", "fireworks", "groq", "anthropic"
  costPer1kInput: number; // in USD
  costPer1kOutput: number; // in USD
  contextWindow: number;
  avgLatencyMs: number;
  isHealthy: boolean;
  consecutiveFailures: number;
  rateLimitResetTime?: number;
}

export interface VirtualApiKeyQuota {
  keyId: string;
  agentId: string;
  agentName: string;
  allocatedBudgetUsd: number;
  spentBudgetUsd: number;
  activeReservationsUsd: number;
  maxTokensPerRequest: number;
  isActive: boolean;
}

export interface PreDebitReservation {
  reservationId: string;
  keyId: string;
  agentId: string;
  estimatedCostUsd: number;
  maxTokens: number;
  reservedAt: number;
  status: "PENDING" | "RECONCILED" | "RELEASED" | "EXPIRED";
}

export interface OtariChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OtariChatRequest {
  model: string;
  messages: OtariChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface OtariUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OtariChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OtariChatMessage;
    finish_reason: string;
  }>;
  usage: OtariUsage;
}

export interface ComplexityEvaluation {
  tier: ModelTier;
  confidence: number;
  estimatedTokens: number;
  factors: {
    promptLength: number;
    hasCodeBlock: boolean;
    hasComplexReasoning: boolean;
    keywordMatches: string[];
  };
}

export interface RoutingDecision {
  taskId: string;
  agentId: string;
  selectedModel: ModelEndpoint;
  targetTier: ModelTier;
  fallbackCount: number;
  failoverHistory: string[];
  estimatedCostUsd: number;
  reservationId: string;
}

export interface ExecutionResult {
  taskId: string;
  agentId: string;
  routing: RoutingDecision;
  response: OtariChatResponse;
  actualCostUsd: number;
  frontierCostUsd: number;
  costSavingsUsd: number;
  latencyMs: number;
  status: "SUCCESS" | "FAILED" | "BUDGET_EXCEEDED" | "CIRCUIT_OPEN";
}

export interface SentinelTelemetry {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalFailovers: number;
  tierDistribution: Record<ModelTier, number>;
  totalSpendUsd: number;
  totalFrontierBenchmarkUsd: number;
  totalSavingsUsd: number;
  savingsPercentage: number;
}
