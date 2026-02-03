#!/usr/bin/env tsx
/**
 * Standalone Test Runner for Login Test Harness
 * 
 * Run with: npx tsx run-tests.ts
 * 
 * This script runs the login test harness and outputs:
 * - Test results
 * - Traces in isl-trace-format
 * - Proof bundle verification
 */

import { createLoginTestHarness } from './src/login-harness.js';
import type { TestSummary } from './src/login-harness.js';
import { formatForISLVerify, assertTestsExecuted } from './src/fixture-adapter.js';

// Colors for terminal output
const pc = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function runTests(): Promise<{ success: boolean; summary: TestSummary }> {
  console.log(pc.bold('\n========================================'));
  console.log(pc.bold('  ISL Test Runtime - Login Tests'));
  console.log(pc.bold('========================================\n'));

  const harness = createLoginTestHarness({ verbose: true });
  
  console.log(pc.cyan('Running core scenarios (SUCCESS, INVALID_CREDENTIALS, USER_LOCKED)...\n'));
  
  const summary = await harness.runCoreScenarios();

  // Verify tests were actually executed
  try {
    assertTestsExecuted(summary);
  } catch (error) {
    console.error(pc.red(`\nFATAL: ${error}`));
    return { success: false, summary };
  }

  // Output summary
  console.log(pc.bold('\n========================================'));
  console.log(pc.bold('  Test Results'));
  console.log(pc.bold('========================================'));
  console.log(`  Total:    ${summary.total}`);
  console.log(`  Passed:   ${pc.green(String(summary.passed))}`);
  console.log(`  Failed:   ${summary.failed > 0 ? pc.red(String(summary.failed)) : String(summary.failed)}`);

  // Output traces summary
  console.log(pc.bold('\n========================================'));
  console.log(pc.bold('  Trace Summary'));
  console.log(pc.bold('========================================'));
  console.log(`  Traces generated: ${summary.traces.length}`);
  
  for (const trace of summary.traces) {
    const icon = trace.metadata?.passed ? pc.green('✓') : pc.red('✗');
    console.log(`  ${icon} ${trace.metadata?.testName} (${trace.events.length} events)`);
  }

  // Format for isl verify
  const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

  console.log(pc.bold('\n========================================'));
  console.log(pc.bold('  ISL Verify Output'));
  console.log(pc.bold('========================================'));
  console.log(`  Spec:     login.isl`);
  console.log(`  Domain:   Auth v1.0.0`);
  console.log(`  Tests:    ${verifyOutput.summary}`);
  console.log(`  Verdict:  ${verifyOutput.proofBundle.verdict === 'PROVEN' ? pc.green(verifyOutput.proofBundle.verdict) : pc.red(verifyOutput.proofBundle.verdict)}`);
  console.log(`  Bundle:   ${verifyOutput.proofBundle.bundleId}`);

  console.log(pc.bold('\n========================================'));
  
  const success = summary.failed === 0 && summary.total > 0;
  
  if (success) {
    console.log(pc.green(pc.bold('  ALL TESTS PASSED ✓')));
  } else {
    console.log(pc.red(pc.bold('  TESTS FAILED ✗')));
  }
  
  console.log(pc.bold('========================================\n'));

  return { success, summary };
}

// Test individual scenarios
async function testScenarios(): Promise<void> {
  const harness = createLoginTestHarness({ verbose: false });
  
  console.log(pc.cyan('\nTesting individual scenarios...\n'));

  // Test SUCCESS path
  console.log(pc.bold('SUCCESS Path:'));
  const successResult = await harness.runTest({
    name: 'success_manual_test',
    scenario: 'success',
    input: { email: 'manual@test.com', password: 'ValidPass1!' },
    setup: (store) => {
      store.seedUser({
        id: 'manual_user',
        email: 'manual@test.com',
        password_hash: 'hashed_ValidPass1!',
        status: 'ACTIVE',
        failed_attempts: 0,
      });
    },
    expectedStatus: 200,
  });
  console.log(`  ${successResult.passed ? pc.green('✓') : pc.red('✗')} ${successResult.name}`);

  // Test INVALID_CREDENTIALS path
  console.log(pc.bold('\nINVALID_CREDENTIALS Path:'));
  harness.getStore().clear();
  const invalidResult = await harness.runTest({
    name: 'invalid_credentials_manual_test',
    scenario: 'invalid_credentials',
    input: { email: 'noone@test.com', password: 'AnyPassword1!' },
    expectedStatus: 401,
    expectedCode: 'INVALID_CREDENTIALS',
  });
  console.log(`  ${invalidResult.passed ? pc.green('✓') : pc.red('✗')} ${invalidResult.name}`);

  // Test USER_LOCKED path
  console.log(pc.bold('\nUSER_LOCKED Path:'));
  harness.getStore().clear();
  const lockedResult = await harness.runTest({
    name: 'user_locked_manual_test',
    scenario: 'user_locked',
    input: { email: 'locked@test.com', password: 'ValidPass1!' },
    setup: (store) => {
      store.seedUser({
        id: 'locked_user',
        email: 'locked@test.com',
        password_hash: 'hashed_ValidPass1!',
        status: 'LOCKED',
        failed_attempts: 5,
        locked_until: Date.now() + 10 * 60 * 1000,
      });
    },
    expectedStatus: 401,
    expectedCode: 'ACCOUNT_LOCKED',
  });
  console.log(`  ${lockedResult.passed ? pc.green('✓') : pc.red('✗')} ${lockedResult.name}`);

  console.log();
}

// Export traces
async function exportTraces(): Promise<void> {
  const harness = createLoginTestHarness({ verbose: false });
  await harness.runCoreScenarios();
  
  console.log(pc.cyan('\nExporting traces...\n'));
  console.log(harness.exportTraces());
}

// Main
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--scenarios')) {
    await testScenarios();
  } else if (args.includes('--export')) {
    await exportTraces();
  } else {
    const { success } = await runTests();
    process.exit(success ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
