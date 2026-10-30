import test from "node:test";
import assert from "node:assert/strict";
import { CircuitBreakerRouter } from "../src/circuit-breaker-router.js";

test("CircuitBreakerRouter - resolves primary and fallback models by tier", () => {
  const router = new CircuitBreakerRouter();
  const route = router.resolveRoute("FAST_OPEN_WEIGHT");

  assert.equal(route.primary.tier, "FAST_OPEN_WEIGHT");
  assert.ok(route.fallbacks.length > 0);
  assert.equal(route.primary.isHealthy, true);
});

test("CircuitBreakerRouter - trips circuit breaker on 429 and fails over", () => {
  const router = new CircuitBreakerRouter();
  const initialRoute = router.resolveRoute("FAST_OPEN_WEIGHT");
  const primaryId = initialRoute.primary.id;

  // Simulate 429 RateLimit on primary model
  router.recordFailure(primaryId, "RATE_LIMIT");

  const modelState = router.getModel(primaryId);
  assert.ok(modelState);
  assert.equal(modelState.isHealthy, false);
  assert.ok(modelState.rateLimitResetTime !== undefined);

  // Next resolution should choose alternative healthy model
  const newRoute = router.resolveRoute("FAST_OPEN_WEIGHT");
  assert.notEqual(newRoute.primary.id, primaryId);
  assert.equal(newRoute.primary.isHealthy, true);
});

test("CircuitBreakerRouter - records success and maintains healthy status", () => {
  const router = new CircuitBreakerRouter();
  const route = router.resolveRoute("BALANCED_CODE");
  const primaryId = route.primary.id;

  router.recordSuccess(primaryId, 120);
  const modelState = router.getModel(primaryId);
  assert.ok(modelState);
  assert.equal(modelState.isHealthy, true);
  assert.equal(modelState.consecutiveFailures, 0);
});
