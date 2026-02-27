/**
 * ISL Mutation Testing
 * 
 * Generate and run mutation tests to verify test quality.
 * A surviving mutant indicates a gap in your test suite.
 */

export { mutate, createMutants, MutationEngine } from './mutator';
export { MutationRunner, runMutations } from './runner';
export { MutationReporter, generateReport } from './reporter';
export { analyzeSurvivors, SurvivorAnalyzer } from './survivor';

// Mutation types
export * from './mutations/arithmetic';
export * from './mutations/comparison';
export * from './mutations/logical';
export * from './mutations/boundary';
export * from './mutations/null';
export * from './mutations/temporal';

// Types
export type {
  Mutant,
  MutantStatus,
  MutationType,
  MutationResult,
  MutationReport,
  MutationConfig,
  SurvivorAnalysis,
} from './types';
