// ============================================================================
// @isl-lang/semantics - Versioned Semantics for ISL
// ============================================================================

// Core types
export type {
  SemanticVersion,
  BinaryOperator,
  UnaryOperator,
  Quantifier,
  TemporalOperator,
  Value,
  ValueType,
  BinaryOperatorSemantics,
  UnaryOperatorSemantics,
  QuantifierSemantics,
  TemporalOperatorSemantics,
  TemporalInterpretation,
  OperandTypeConstraint,
  VersionedSemantics,
} from './types.js';

// Version utilities
export {
  parseVersion,
  formatVersion,
  compareVersions,
  isCompatible,
} from './types.js';

// Registry (main API)
export {
  getSemantics,
  getSemanticsForVersion,
  getLatestSemantics,
  getAvailableVersions,
  isVersionSupported,
  getDefaultSemantics,
  DEFAULT_VERSION,
  V1_SEMANTICS,
  V1_VERSION,
} from './registry.js';

// V1 Semantics (direct access)
export {
  V1_BINARY_OPERATORS,
  V1_UNARY_OPERATORS,
  V1_QUANTIFIERS,
  V1_TEMPORAL_OPERATORS,
} from './v1/index.js';

// Adapters
export type {
  EvaluatorAdapter,
  EvaluatorAdapterOptions,
  CompilerAdapter,
  CompilerAdapterOptions,
  TypeCheckAdapter,
  OperatorInfo,
} from './adapter.js';

export {
  createEvaluatorAdapter,
  createCompilerAdapter,
  createTypeCheckAdapter,
  defaultEvaluatorAdapter,
  defaultCompilerAdapter,
  defaultTypeCheckAdapter,
} from './adapter.js';
