/**
 * ISL Mutation Testing Harness
 * 
 * Validates the ISL verification system by intentionally introducing
 * bugs and ensuring the verifier detects them.
 */

// Type exports
export type {
  MutationType,
  MutationTarget,
  MutationDefinition,
  Mutator,
  MutatorContext,
  MutationResult,
  VerifyVerdict,
  ClauseResult,
  VerificationSnapshot,
  MutationStatus,
  MutationTestResult,
  FixtureConfig,
  FixtureSuite,
  FixtureReport,
  MutationReport,
  HarnessConfig,
} from './types.js';

// Mutator exports
export {
  mutatorRegistry,
  getMutator,
  getMutationTypes,
  isValidMutationType,
  applyMutation,
  removeAssertMutator,
  changeComparatorMutator,
  deleteExpectationMutator,
  bypassPreconditionMutator,
} from './mutators/index.js';

// Harness exports
export {
  createMockVerificationEngine,
  loadFixture,
  discoverFixtures,
  runMutationTest,
  runFixtureMutations,
  runMutationHarness,
  writeReport,
  printReportSummary,
} from './harness.js';
