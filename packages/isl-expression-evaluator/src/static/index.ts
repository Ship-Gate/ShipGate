// ============================================================================
// ISL Static Analyzer - Module Public API
// ============================================================================

// Core analysis functions
export {
  analyzeStatically,
  analyzeAll,
  summarizeResults,
} from './analyzer.js';

// Type definitions
export type {
  TypeContext,
  TypeConstraintInfo,
  TypeConstraints,
  BaseType,
  FieldInfo,
  EntityInfo,
  StaticAnalysisResult,
  StaticVerdict,
  AnalysisCategory,
} from './types.js';

// Factory/helper functions
export {
  createTypeContext,
  typeInfo,
  fieldInfo,
  entityInfo,
} from './types.js';
