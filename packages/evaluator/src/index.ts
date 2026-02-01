// ============================================================================
// ISL Expression Evaluator - Public API
// ============================================================================

// Types
export type {
  // Core types
  Value,
  SourceLocation,
  ASTNode,
  
  // Environment types
  Environment,
  Binding,
  
  // Entity types
  EntityStore,
  EntityStoreSnapshot,
  EntityInstance,
  
  // Evaluation context
  EvaluationContext,
  EvaluationErrorInfo,
  DomainDef,
  EntityDef,
  TypeDef,
  FieldDef,
  
  // Verification types
  CheckType,
  CheckResult,
  VerificationFailure,
  VerificationResult,
  
  // Builtin types
  BuiltinFn,
  BuiltinRegistry,
  
  // Lambda type
  LambdaValue,
} from './types.js';

// Errors
export {
  EvaluationError,
  TypeError,
  ReferenceError,
  RuntimeError,
  isEntityInstance,
  isLambdaValue,
  getValueType,
} from './types.js';

// Environment
export {
  Scope,
  InMemoryEntityStore,
  SnapshotEntityStore,
  createScope,
  createEntityStore,
  createSnapshotStore,
} from './environment.js';

// Builtins
export {
  DefaultBuiltinRegistry,
  createBuiltinRegistry,
  getDefaultBuiltins,
} from './builtins.js';

// Evaluator
export {
  Evaluator,
  evaluate,
  expressionToString,
  type EvaluatorOptions,
} from './evaluator.js';

// Verifier
export {
  Verifier,
  verifyExpression,
  createVerifier,
  type VerificationInput,
} from './verifier.js';
