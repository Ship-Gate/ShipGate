/**
 * Chaos Checkout Demo Runner
 * 
 * Demonstrates chaos engineering verification of the checkout implementation.
 * 
 * Run with: npx tsx demos/chaos-checkout-demo/run-chaos.ts
 */

import {
  createCheckoutSession,
  resetSessions,
  countSessionsByIdempotencyKey,
  getSessionByIdempotencyKey,
  CheckoutError,
} from './implementation.js';
import {
  createRateLimitStorm,
  createConcurrentIdempotencyTracker,
  createRecoverableDatabaseFailure,
  createSpikeLatency,
  RateLimitError,
} from '../../packages/verifier-chaos/src/index.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string, color: string = colors.reset): void {
  process.stdout.write(`${color}${message}${colors.reset}\n`);
}

function logSection(title: string): void {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`  ${title}`, colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
}

function logResult(passed: boolean, message: string): void {
  const icon = passed ? '✓' : '✗';
  const color = passed ? colors.green : colors.red;
  log(`  ${icon} ${message}`, color);
}

/**
 * Scenario 1: Concurrent Duplicate Requests
 * 
 * Tests that concurrent requests with the same idempotency key
 * result in exactly one checkout session being created.
 */
async function runConcurrentDuplicatesScenario(): Promise<boolean> {
  logSection('Scenario 1: Concurrent Duplicate Requests');
  
  resetSessions();
  const idempotencyKey = `concurrent-test-${Date.now()}`;
  const idempotencyTracker = createConcurrentIdempotencyTracker();
  idempotencyTracker.activate();
  
  const input = {
    idempotency_key: idempotencyKey,
    line_items: [
      { name: 'Product A', quantity: 2, unit_price: 29.99, amount: 59.98 },
    ],
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  };
  
  log(`  Sending 10 concurrent requests with idempotency key: ${idempotencyKey}`, colors.dim);
  
  // Send 10 concurrent requests
  const promises = Array(10).fill(null).map(async (_, i) => {
    try {
      const result = await createCheckoutSession(input);
      return { success: true, result, index: i };
    } catch (error) {
      return { success: false, error, index: i };
    }
  });
  
  const results = await Promise.all(promises);
  
  // Count successful requests
  const successful = results.filter(r => r.success);
  const cachedResponses = successful.filter(r => (r.result as { is_cached: boolean }).is_cached);
  const newCreations = successful.filter(r => !(r.result as { is_cached: boolean }).is_cached);
  
  // Verify results
  const sessionCount = countSessionsByIdempotencyKey(idempotencyKey);
  const exactlyOneCreated = sessionCount === 1;
  const allSuccessful = successful.length === 10;
  const oneNewNineCached = newCreations.length === 1 && cachedResponses.length === 9;
  
  log(`  Results:`, colors.dim);
  log(`    - Total successful: ${successful.length}/10`, colors.dim);
  log(`    - New sessions created: ${newCreations.length}`, colors.dim);
  log(`    - Cached responses: ${cachedResponses.length}`, colors.dim);
  log(`    - Sessions in database: ${sessionCount}`, colors.dim);
  
  logResult(exactlyOneCreated, 'Exactly one session created');
  logResult(allSuccessful, 'All requests completed successfully');
  logResult(oneNewNineCached, 'One new creation, nine cached responses');
  
  // Verify all responses return the same session ID
  const sessionIds = successful.map(r => (r.result as { session: { id: string } }).session.id);
  const allSameSession = new Set(sessionIds).size === 1;
  logResult(allSameSession, 'All responses return the same session');
  
  idempotencyTracker.deactivate();
  
  return exactlyOneCreated && allSuccessful && allSameSession;
}

/**
 * Scenario 2: Idempotency Conflict Detection
 * 
 * Tests that using the same idempotency key with different parameters
 * results in an IDEMPOTENCY_CONFLICT error.
 */
async function runIdempotencyConflictScenario(): Promise<boolean> {
  logSection('Scenario 2: Idempotency Conflict Detection');
  
  resetSessions();
  const idempotencyKey = `conflict-test-${Date.now()}`;
  
  // First request
  const input1 = {
    idempotency_key: idempotencyKey,
    line_items: [
      { name: 'Product A', quantity: 1, unit_price: 10.00, amount: 10.00 },
    ],
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  };
  
  // Second request with different parameters
  const input2 = {
    idempotency_key: idempotencyKey,
    line_items: [
      { name: 'Product B', quantity: 2, unit_price: 20.00, amount: 40.00 }, // Different!
    ],
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  };
  
  log(`  Creating first session with idempotency key: ${idempotencyKey}`, colors.dim);
  
  let firstSuccess = false;
  let conflictDetected = false;
  
  try {
    await createCheckoutSession(input1);
    firstSuccess = true;
    log(`  First request succeeded`, colors.dim);
  } catch (error) {
    log(`  First request failed: ${error}`, colors.red);
  }
  
  log(`  Sending second request with different parameters...`, colors.dim);
  
  try {
    await createCheckoutSession(input2);
    log(`  Second request succeeded (unexpected!)`, colors.yellow);
  } catch (error) {
    if (error instanceof CheckoutError && error.code === 'IDEMPOTENCY_CONFLICT') {
      conflictDetected = true;
      log(`  Conflict detected: ${error.message}`, colors.dim);
    } else {
      log(`  Unexpected error: ${error}`, colors.red);
    }
  }
  
  logResult(firstSuccess, 'First request succeeded');
  logResult(conflictDetected, 'Conflict detected for different parameters');
  
  return firstSuccess && conflictDetected;
}

/**
 * Scenario 3: Rate Limit Storm
 * 
 * Tests that the system handles rate limiting gracefully.
 */
async function runRateLimitStormScenario(): Promise<boolean> {
  logSection('Scenario 3: Rate Limit Storm');
  
  resetSessions();
  
  // Create rate limiter: 10 requests per second
  const rateLimiter = createRateLimitStorm(10, 1000);
  rateLimiter.activate();
  
  log(`  Simulating 50 requests through rate limiter (limit: 10/s)`, colors.dim);
  
  let accepted = 0;
  let rejected = 0;
  let errors = 0;
  
  for (let i = 0; i < 50; i++) {
    const check = rateLimiter.checkRateLimit();
    
    if (check.allowed) {
      accepted++;
      
      // Actually create a session for accepted requests
      try {
        await createCheckoutSession({
          line_items: [
            { name: `Product ${i}`, quantity: 1, unit_price: 10.00, amount: 10.00 },
          ],
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
        });
      } catch {
        errors++;
      }
    } else {
      rejected++;
    }
  }
  
  const state = rateLimiter.getState();
  
  log(`  Results:`, colors.dim);
  log(`    - Accepted: ${accepted}`, colors.dim);
  log(`    - Rejected: ${rejected}`, colors.dim);
  log(`    - Errors: ${errors}`, colors.dim);
  log(`    - Rate limiter state:`, colors.dim);
  log(`      - Total requests: ${state.totalRequests}`, colors.dim);
  log(`      - Rejected requests: ${state.rejectedRequests}`, colors.dim);
  
  rateLimiter.deactivate();
  
  // Verify rate limiting is working
  const rateLimitEnforced = rejected > 30; // At least 80% should be rejected
  const noErrors = errors === 0;
  
  logResult(rateLimitEnforced, `Rate limiting enforced (${rejected}/50 rejected)`);
  logResult(noErrors, 'No errors during processing');
  
  return rateLimitEnforced && noErrors;
}

/**
 * Scenario 4: Latency Spike Handling
 * 
 * Tests that the system handles latency spikes gracefully.
 */
async function runLatencySpikeScenario(): Promise<boolean> {
  logSection('Scenario 4: Latency Spike Handling');
  
  resetSessions();
  
  // Create latency injector with exponential distribution
  const latencyInjector = createSpikeLatency(50, 500);
  latencyInjector.activate();
  
  log(`  Simulating 10 requests with latency injection (50-500ms)`, colors.dim);
  
  const timings: number[] = [];
  let allSuccessful = true;
  
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    
    try {
      // Wrap the operation with latency injection
      await latencyInjector.inject(async () => {
        return createCheckoutSession({
          line_items: [
            { name: `Product ${i}`, quantity: 1, unit_price: 10.00, amount: 10.00 },
          ],
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
        });
      }, 'createCheckoutSession');
    } catch {
      allSuccessful = false;
    }
    
    timings.push(Date.now() - start);
  }
  
  const state = latencyInjector.getState();
  const avgLatency = timings.reduce((a, b) => a + b, 0) / timings.length;
  const maxLatency = Math.max(...timings);
  const p99 = latencyInjector.getPercentile(99);
  
  log(`  Results:`, colors.dim);
  log(`    - All successful: ${allSuccessful}`, colors.dim);
  log(`    - Average latency: ${avgLatency.toFixed(0)}ms`, colors.dim);
  log(`    - Max latency: ${maxLatency}ms`, colors.dim);
  log(`    - P99 latency: ${p99.toFixed(0)}ms`, colors.dim);
  log(`    - Operations delayed: ${state.operationsDelayed}`, colors.dim);
  
  latencyInjector.deactivate();
  
  const withinTimeout = maxLatency < 5000; // All completed within 5s
  
  logResult(allSuccessful, 'All requests completed successfully');
  logResult(withinTimeout, `All requests completed within timeout (max: ${maxLatency}ms)`);
  
  return allSuccessful && withinTimeout;
}

/**
 * Main demo runner
 */
async function main(): Promise<void> {
  log('\n🔥 Chaos Checkout Demo', colors.cyan);
  log('   Testing checkout resilience under chaos conditions\n', colors.dim);
  
  const results: Array<{ name: string; passed: boolean }> = [];
  
  // Run all scenarios
  results.push({
    name: 'Concurrent Duplicate Requests',
    passed: await runConcurrentDuplicatesScenario(),
  });
  
  results.push({
    name: 'Idempotency Conflict Detection',
    passed: await runIdempotencyConflictScenario(),
  });
  
  results.push({
    name: 'Rate Limit Storm',
    passed: await runRateLimitStormScenario(),
  });
  
  results.push({
    name: 'Latency Spike Handling',
    passed: await runLatencySpikeScenario(),
  });
  
  // Summary
  logSection('Summary');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const result of results) {
    logResult(result.passed, result.name);
  }
  
  log('');
  
  if (passed === total) {
    log(`✅ All ${total} scenarios passed!`, colors.green);
  } else {
    log(`❌ ${passed}/${total} scenarios passed`, colors.red);
  }
  
  log('');
  
  // Exit with appropriate code
  process.exit(passed === total ? 0 : 1);
}

main().catch(error => {
  log(`Fatal error: ${error}`, colors.red);
  process.exit(1);
});
