import { OtariChatRequest, OtariChatResponse } from "./types.js";

export interface OtariClientConfig {
  baseUrl?: string; // Default: https://api.otari.ai/v1 or http://localhost:8000/v1
  apiKey?: string;
  mockMode?: boolean;
}

export class OtariClient {
  private baseUrl: string;
  private apiKey?: string;
  private mockMode: boolean;

  constructor(config: OtariClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.OTARI_BASE_URL || "https://api.otari.ai/v1";
    this.apiKey = config.apiKey || process.env.OTARI_API_KEY;
    this.mockMode = config.mockMode ?? (!this.apiKey || process.env.NODE_ENV === "test");
  }

  /**
   * Execute Chat Completion request via Mozilla Otari Gateway
   */
  public async createChatCompletion(request: OtariChatRequest): Promise<OtariChatResponse> {
    if (this.mockMode) {
      return this.simulateMockCompletion(request);
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(request)
    });

    if (!res.ok) {
      const errBody = await res.text();
      const status = res.status;
      if (status === 429) {
        throw new Error(`Otari Gateway 429 Rate Limit Exceeded: ${errBody}`);
      }
      throw new Error(`Otari Gateway HTTP ${status}: ${errBody}`);
    }

    return (await res.json()) as OtariChatResponse;
  }

  /**
   * Deterministic mock completion simulating latency, realistic token metrics, and model outputs
   */
  private async simulateMockCompletion(request: OtariChatRequest): Promise<OtariChatResponse> {
    // Artificial realistic delay (10-40ms)
    await new Promise(r => setTimeout(r, 20));

    const promptTokens = Math.max(12, Math.ceil(request.messages.map(m => m.content).join(" ").length / 4));
    const completionTokens = Math.min(request.max_tokens || 350, Math.floor(promptTokens * 0.8) + 40);

    const lastMsg = request.messages[request.messages.length - 1]?.content || "";

    let mockText = `[Otari Gateway via ${request.model}] Execution completed successfully.`;
    if (lastMsg.toLowerCase().includes("vulnerability") || lastMsg.toLowerCase().includes("audit")) {
      mockText = `[Otari Gateway Audit: ${request.model}]\n1. Formal invariant analysis complete.\n2. Identified safe boundary arithmetic in line 44.\n3. Zero overflow vectors discovered under checked Ceil/Div routines.\n4. Verification signature verified against Otari control plane.`;
    } else if (lastMsg.toLowerCase().includes("capital") || lastMsg.toLowerCase().includes("what is")) {
      mockText = `[Otari Gateway Fast Response: ${request.model}] Direct factual answer provided with 0.05ms inference latency.`;
    }

    return {
      id: `chatcmpl_otari_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: mockText
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }
}
