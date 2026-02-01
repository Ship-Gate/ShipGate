// ============================================================================
// ISL Test Generator
// Generates executable Jest/Vitest tests from ISL behaviors and scenarios
// ============================================================================

export { generate } from './generator';

// Types
export type {
  GenerateOptions,
  GeneratedFile,
  GenerateResult,
  GeneratorError,
  TestFramework,
  TestBlock,
  AssertionContext,
  ScenarioContext,
  ChaosContext,
  PreconditionTest,
  PostconditionTest,
} from './types';

// Submodules
export {
  generatePreconditionTests,
  generatePreconditionsDescribeBlock,
  generatePreconditionValidators,
} from './preconditions';

export {
  generatePostconditionTests,
  generatePostconditionsDescribeBlock,
  generatePostconditionAssertions,
  generateImpliesTests,
} from './postconditions';

export {
  generateScenarioTests,
  generateAllScenariosDescribeBlock,
  extractScenarioContext,
  generateScenarioHelpers,
  generateScenarioDataBuilders,
} from './scenarios';

export {
  generateChaosTests,
  generateAllChaosDescribeBlock,
  generateChaosController,
  extractChaosContext,
} from './chaos';

export {
  compileExpression,
  compileAssertion,
  compileResultCheck,
} from './expression-compiler';

// Templates
export { getJestTemplate, getJestConfig, getJestSetup } from '../templates/jest';
export { getVitestTemplate, getVitestConfig, getVitestSetup } from '../templates/vitest';
