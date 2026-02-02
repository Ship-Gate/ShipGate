/**
 * Test Fixtures
 *
 * Sample verification results for testing.
 */

import type { VerificationResult, ClauseResult, CategoryBreakdown } from '../src/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function createCategoryBreakdown(
  postconditions: [number, number],
  invariants: [number, number],
  scenarios: [number, number],
  temporal: [number, number]
): CategoryBreakdown {
  const calcScore = (passed: number, total: number) =>
    total === 0 ? 100 : Math.round((passed / total) * 100);

  return {
    postconditions: {
      score: calcScore(postconditions[0], postconditions[0] + postconditions[1]),
      passed: postconditions[0],
      failed: postconditions[1],
      total: postconditions[0] + postconditions[1],
    },
    invariants: {
      score: calcScore(invariants[0], invariants[0] + invariants[1]),
      passed: invariants[0],
      failed: invariants[1],
      total: invariants[0] + invariants[1],
    },
    scenarios: {
      score: calcScore(scenarios[0], scenarios[0] + scenarios[1]),
      passed: scenarios[0],
      failed: scenarios[1],
      total: scenarios[0] + scenarios[1],
    },
    temporal: {
      score: calcScore(temporal[0], temporal[0] + temporal[1]),
      passed: temporal[0],
      failed: temporal[1],
      total: temporal[0] + temporal[1],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Passing Result Fixture
// ─────────────────────────────────────────────────────────────────────────────

export const passingClauses: ClauseResult[] = [
  {
    name: 'transfer_deducts_sender_balance',
    status: 'passed',
    category: 'postcondition',
    duration: 12,
    file: 'specs/payment.isl',
    line: 15,
  },
  {
    name: 'transfer_credits_receiver_balance',
    status: 'passed',
    category: 'postcondition',
    duration: 8,
    file: 'specs/payment.isl',
    line: 16,
  },
  {
    name: 'balance_never_negative',
    status: 'passed',
    category: 'invariant',
    duration: 5,
    file: 'specs/payment.isl',
    line: 22,
  },
  {
    name: 'successful_transfer_scenario',
    status: 'passed',
    category: 'scenario',
    duration: 45,
    file: 'specs/payment.isl',
    line: 30,
  },
  {
    name: 'transfer_completes_within_timeout',
    status: 'passed',
    category: 'temporal',
    duration: 23,
    file: 'specs/payment.isl',
    line: 40,
  },
];

export const passingResult: VerificationResult = {
  success: true,
  score: 100,
  confidence: 95,
  recommendation: 'production_ready',
  specFile: 'specs/payment.isl',
  implFile: 'src/payment.ts',
  clauses: passingClauses,
  breakdown: createCategoryBreakdown([2, 0], [1, 0], [1, 0], [1, 0]),
  duration: 93,
  timestamp: '2026-02-01T12:00:00.000Z',
  islVersion: '0.1.0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Failing Result Fixture
// ─────────────────────────────────────────────────────────────────────────────

export const failingClauses: ClauseResult[] = [
  {
    name: 'transfer_deducts_sender_balance',
    status: 'passed',
    category: 'postcondition',
    duration: 12,
    file: 'specs/payment.isl',
    line: 15,
  },
  {
    name: 'transfer_credits_receiver_balance',
    status: 'failed',
    category: 'postcondition',
    impact: 'critical',
    duration: 8,
    file: 'specs/payment.isl',
    line: 16,
    column: 5,
    error: 'Receiver balance not updated correctly',
    expression: 'receiver.balance == old(receiver.balance) + amount',
    expected: 150,
    actual: 100,
    suggestedFix: 'Check that transfer() adds amount to receiver balance',
  },
  {
    name: 'balance_never_negative',
    status: 'failed',
    category: 'invariant',
    impact: 'high',
    duration: 5,
    file: 'specs/payment.isl',
    line: 22,
    error: 'Invariant violated: balance became negative',
    expression: 'account.balance >= 0',
    expected: true,
    actual: false,
    suggestedFix: 'Add balance check before deduction',
  },
  {
    name: 'insufficient_funds_rejection',
    status: 'failed',
    category: 'scenario',
    impact: 'medium',
    duration: 32,
    file: 'specs/payment.isl',
    line: 35,
    error: 'Transfer should have been rejected but succeeded',
  },
  {
    name: 'successful_transfer_scenario',
    status: 'passed',
    category: 'scenario',
    duration: 45,
    file: 'specs/payment.isl',
    line: 30,
  },
  {
    name: 'transfer_completes_within_timeout',
    status: 'passed',
    category: 'temporal',
    duration: 23,
    file: 'specs/payment.isl',
    line: 40,
  },
];

export const failingResult: VerificationResult = {
  success: false,
  score: 50,
  confidence: 85,
  recommendation: 'not_ready',
  specFile: 'specs/payment.isl',
  implFile: 'src/payment.ts',
  clauses: failingClauses,
  breakdown: createCategoryBreakdown([1, 1], [0, 1], [1, 1], [1, 0]),
  duration: 125,
  timestamp: '2026-02-01T12:00:00.000Z',
  islVersion: '0.1.0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Critical Failure Fixture
// ─────────────────────────────────────────────────────────────────────────────

export const criticalClauses: ClauseResult[] = [
  {
    name: 'auth_token_validation',
    status: 'failed',
    category: 'precondition',
    impact: 'critical',
    duration: 3,
    file: 'specs/auth.isl',
    line: 10,
    error: 'Authentication bypass detected',
    suggestedFix: 'Ensure token is validated before processing request',
  },
  {
    name: 'password_hashing',
    status: 'failed',
    category: 'postcondition',
    impact: 'critical',
    duration: 5,
    file: 'specs/auth.isl',
    line: 25,
    error: 'Password stored in plaintext',
    suggestedFix: 'Use bcrypt or argon2 for password hashing',
  },
  {
    name: 'session_invalidation',
    status: 'failed',
    category: 'postcondition',
    impact: 'high',
    duration: 8,
    file: 'specs/auth.isl',
    line: 40,
    error: 'Session not invalidated on logout',
  },
];

export const criticalResult: VerificationResult = {
  success: false,
  score: 0,
  confidence: 90,
  recommendation: 'critical_issues',
  specFile: 'specs/auth.isl',
  implFile: 'src/auth.ts',
  clauses: criticalClauses,
  breakdown: createCategoryBreakdown([0, 2], [0, 0], [0, 0], [0, 0]),
  duration: 16,
  timestamp: '2026-02-01T12:00:00.000Z',
  islVersion: '0.1.0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Partial Pass Fixture (staging recommended)
// ─────────────────────────────────────────────────────────────────────────────

export const partialClauses: ClauseResult[] = [
  {
    name: 'create_user_success',
    status: 'passed',
    category: 'postcondition',
    duration: 15,
  },
  {
    name: 'update_user_success',
    status: 'passed',
    category: 'postcondition',
    duration: 12,
  },
  {
    name: 'delete_user_success',
    status: 'passed',
    category: 'postcondition',
    duration: 10,
  },
  {
    name: 'user_email_unique',
    status: 'passed',
    category: 'invariant',
    duration: 8,
  },
  {
    name: 'edge_case_empty_name',
    status: 'failed',
    category: 'scenario',
    impact: 'low',
    duration: 20,
    error: 'Empty name should be rejected',
    file: 'specs/user.isl',
    line: 50,
  },
];

export const partialResult: VerificationResult = {
  success: false,
  score: 87,
  confidence: 88,
  recommendation: 'staging_recommended',
  specFile: 'specs/user.isl',
  implFile: 'src/user.ts',
  clauses: partialClauses,
  breakdown: createCategoryBreakdown([3, 0], [1, 0], [0, 1], [0, 0]),
  duration: 65,
  timestamp: '2026-02-01T12:00:00.000Z',
  islVersion: '0.1.0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty/Minimal Fixtures
// ─────────────────────────────────────────────────────────────────────────────

export const emptyResult: VerificationResult = {
  success: true,
  score: 100,
  confidence: 0,
  recommendation: 'production_ready',
  specFile: 'specs/empty.isl',
  implFile: 'src/empty.ts',
  clauses: [],
  breakdown: createCategoryBreakdown([0, 0], [0, 0], [0, 0], [0, 0]),
  duration: 5,
  timestamp: '2026-02-01T12:00:00.000Z',
};

// ─────────────────────────────────────────────────────────────────────────────
// All Fixtures Export
// ─────────────────────────────────────────────────────────────────────────────

export const fixtures = {
  passing: passingResult,
  failing: failingResult,
  critical: criticalResult,
  partial: partialResult,
  empty: emptyResult,
};
