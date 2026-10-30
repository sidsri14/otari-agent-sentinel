import { ComplexityEvaluation, ModelTier, OtariChatMessage } from "./types.js";

export class ComplexityClassifier {
  private static readonly REASONING_KEYWORDS = [
    "derive",
    "step-by-step",
    "calculate",
    "proof",
    "mathematical",
    "formal verification",
    "audit",
    "vulnerability",
    "invariant",
    "exploit",
    "synthesize",
    "architectural analysis",
    "game-theoretic"
  ];

  private static readonly CODE_KEYWORDS = [
    "function",
    "class",
    "import",
    "interface",
    "type",
    "async",
    "await",
    "def ",
    "fn ",
    "struct ",
    "impl ",
    "solidity",
    "rust",
    "typescript",
    "python",
    "c++",
    "sql"
  ];

  /**
   * Classify an array of messages into the optimal ModelTier
   */
  public static evaluate(messages: OtariChatMessage[]): ComplexityEvaluation {
    const fullText = messages.map(m => m.content).join("\n");
    const lower = fullText.toLowerCase();

    // Approximate token count (~4 characters per token)
    const estimatedTokens = Math.max(1, Math.ceil(fullText.length / 4));

    // Check for explicit code markers
    const hasCodeBlock = fullText.includes("```") || fullText.includes("    ") || this.detectCodeSyntax(lower);

    // Check for reasoning keywords
    const matchedKeywords: string[] = [];
    for (const kw of this.REASONING_KEYWORDS) {
      if (lower.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }

    const hasComplexReasoning = matchedKeywords.length >= 2 || 
      (matchedKeywords.length >= 1 && estimatedTokens > 400);

    let tier: ModelTier = "FAST_OPEN_WEIGHT";
    let confidence = 0.85;

    if (hasComplexReasoning || matchedKeywords.length >= 3) {
      tier = "REASONING_FRONTIER";
      confidence = Math.min(0.98, 0.75 + matchedKeywords.length * 0.08);
    } else if (hasCodeBlock || matchedKeywords.length >= 1 || estimatedTokens > 300) {
      tier = "BALANCED_CODE";
      confidence = Math.min(0.95, 0.70 + (hasCodeBlock ? 0.15 : 0.05));
    } else {
      tier = "FAST_OPEN_WEIGHT";
      confidence = 0.90;
    }

    return {
      tier,
      confidence: Math.round(confidence * 100) / 100,
      estimatedTokens,
      factors: {
        promptLength: fullText.length,
        hasCodeBlock,
        hasComplexReasoning,
        keywordMatches: matchedKeywords
      }
    };
  }

  private static detectCodeSyntax(text: string): boolean {
    return this.CODE_KEYWORDS.some(kw => text.includes(kw));
  }
}
