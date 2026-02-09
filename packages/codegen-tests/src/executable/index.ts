// ============================================================================
// Executable Test Generator
// Generates tests that actually run and fail when contracts are violated
// ============================================================================

export { ExecutableTestGenerator } from './generator.js';
export { TypeScriptAdapter } from './adapters/typescript.js';
export { GoAdapter } from './adapters/go.js';
export { PythonAdapter } from './adapters/python.js';

export type {
  LanguageAdapter,
  ExecutableTestOptions,
  ExecutableTestResult,
  TestBinding,
  ContractAssertion,
  PostconditionBinding,
} from './types.js';

export {
  createTestBinding,
  bindToImplementation,
  assertPostcondition,
} from './runtime.js';
