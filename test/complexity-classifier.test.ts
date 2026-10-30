import test from "node:test";
import assert from "node:assert/strict";
import { ComplexityClassifier } from "../src/complexity-classifier.js";

test("ComplexityClassifier - classifies short factual prompt as FAST_OPEN_WEIGHT", () => {
  const evaluation = ComplexityClassifier.evaluate([
    { role: "user", content: "What is the capital of France?" }
  ]);

  assert.equal(evaluation.tier, "FAST_OPEN_WEIGHT");
  assert.ok(evaluation.confidence >= 0.8);
  assert.equal(evaluation.factors.hasCodeBlock, false);
  assert.equal(evaluation.factors.hasComplexReasoning, false);
});

test("ComplexityClassifier - classifies code snippet as BALANCED_CODE", () => {
  const evaluation = ComplexityClassifier.evaluate([
    {
      role: "user",
      content: `Please review this function:
      \`\`\`typescript
      export function parseOrder(raw: string): Order {
          return JSON.parse(raw);
      }
      \`\`\``
    }
  ]);

  assert.equal(evaluation.tier, "BALANCED_CODE");
  assert.ok(evaluation.confidence >= 0.85);
  assert.equal(evaluation.factors.hasCodeBlock, true);
});

test("ComplexityClassifier - classifies formal verification / security audit as REASONING_FRONTIER", () => {
  const evaluation = ComplexityClassifier.evaluate([
    {
      role: "user",
      content: "Perform step-by-step mathematical formal verification of the invariant and derive proof against vulnerability exploit vectors."
    }
  ]);

  assert.equal(evaluation.tier, "REASONING_FRONTIER");
  assert.ok(evaluation.factors.hasComplexReasoning);
  assert.ok(evaluation.factors.keywordMatches.length >= 3);
});
