/**
 * ISL Core Package
 * 
 * Provides ISL translator utilities, evidence handling, scoring,
 * caching, and logging infrastructure.
 * 
 * All exports use defensive loading - missing modules are gracefully
 * handled and features can be detected via exported flags.
 */

// ============================================================================
// Corpus Runner (always available)
// Note: Exports ValidationResult and Policy as CorpusValidationResult and CorpusPolicy
// to avoid conflicts with evidence and policies modules
// ============================================================================

export {
  // Types
  type SourceLocation,
  type ASTNode,
  type Domain,
  type Identifier,
  type StringLiteral,
  type NumberLiteral,
  type BooleanLiteral,
  type Import,
  type ImportItem,
  type TypeDeclaration,
  type TypeDefinition,
  type PrimitiveType,
  type ConstrainedType,
  type Constraint,
  type EnumType,
  type EnumVariant,
  type StructType,
  type UnionType,
  type UnionVariant,
  type ListType,
  type MapType,
  type OptionalType,
  type ReferenceType,
  type QualifiedName,
  type Annotation,
  type Field,
  type Entity,
  type LifecycleSpec,
  type LifecycleTransition,
  type Behavior,
  type ActorSpec,
  type InputSpec,
  type OutputSpec,
  type ErrorSpec,
  type PostconditionBlock,
  type TemporalSpec,
  type SecuritySpec,
  type ComplianceSpec,
  type ObservabilitySpec,
  type MetricSpec,
  type TraceSpec,
  type LogSpec,
  type InvariantBlock,
  type PolicyTarget,
  type PolicyRule,
  type Policy as CorpusPolicy,
  type View,
  type ViewField,
  type ConsistencySpec,
  type CacheSpec,
  type ScenarioBlock,
  type Scenario,
  type ChaosBlock,
  type ChaosScenario,
  type Injection,
  type InjectionParam,
  type DurationLiteral,
  type Expression,
  type BinaryExpr,
  type UnaryExpr,
  type CallExpr,
  type MemberExpr,
  type ListExpr,
  type MapExpr,
  type MapEntry,
  type Statement,
  type AssignmentStmt,
  type CallStmt,
  type ShapeRule,
  type CorpusEntry,
  type ValidationResult as CorpusValidationResult,
  type CorpusRunResult,
  type CorpusSummary,
  // Helper functions
  createIdentifier,
  createStringLiteral,
  createNumberLiteral,
  createBooleanLiteral,
  createPrimitiveType,
  createReferenceType,
  createField,
  createEntity,
  createInputSpec,
  createOutputSpec,
  createBehavior,
  createDomain,
  // Core functions
  normalizeAST,
  printAST,
  printASTCompact,
  fingerprintAST,
  shortFingerprint,
  validateShape,
  // Classes and instances
  MockExtractor,
  CorpusRunner,
  mockExtractor,
  corpusRunner,
} from './isl-translator/corpus-tests/corpusRunner.js';

// ============================================================================
// Evidence Module
// ============================================================================

export * from './evidence/index.js';

// ============================================================================
// Scoring Module (ISL Agent)
// ============================================================================

export * from './isl-agent/index.js';

// ============================================================================
// Cache Module
// ============================================================================

export * from './cache/index.js';

// ============================================================================
// Logging Types
// ============================================================================

export * from './logging/logTypes.js';

// ============================================================================
// Auto-Verify Module (file watcher)
// ============================================================================

export * from './auto-verify/index.js';

// ============================================================================
// Integration utilities (for defensive feature detection)
// ============================================================================

export * from './integration/index.js';

// ============================================================================
// Policy Pack (PII, secrets, auth, logging constraints)
// ============================================================================

export * from './policies/index.js';

// ============================================================================
// Filesystem Guard (safe paths, write allowlists)
// ============================================================================

export * from './fs-guard/index.js';

// ============================================================================
// Context Extractor (repository scanning for translator context)
// ============================================================================

export * from './context/index.js';

// ============================================================================
// ISL Diff Engine (deterministic AST diffing)
// ============================================================================

export * from './isl-diff/index.js';
