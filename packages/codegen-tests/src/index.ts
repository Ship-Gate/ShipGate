// ============================================================================
// ISL Test Generator
// Generates executable Jest/Vitest tests from ISL behaviors and scenarios
// ============================================================================

export { generate } from './generator.js';

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
} from './types.js';

// Submodules
export {
  generatePreconditionTests,
  generatePreconditionsDescribeBlock,
  generatePreconditionValidators,
} from './preconditions.js';

export {
  generatePostconditionTests,
  generatePostconditionsDescribeBlock,
  generatePostconditionAssertions,
  generateImpliesTests,
} from './postconditions.js';

export {
  generateScenarioTests,
  generateAllScenariosDescribeBlock,
  extractScenarioContext,
  generateScenarioHelpers,
  generateScenarioDataBuilders,
} from './scenarios.js';

export {
  generateChaosTests,
  generateAllChaosDescribeBlock,
  generateChaosController,
  extractChaosContext,
} from './chaos.js';

export {
  compileExpression,
  compileAssertion,
  compileResultCheck,
} from './expression-compiler.js';

// Templates
export { getJestTemplate, getJestConfig, getJestSetup } from './templates/jest.js';
export { getVitestTemplate, getVitestConfig, getVitestSetup } from './templates/vitest.js';
