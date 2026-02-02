/**
 * ISL Translator
 * 
 * NL → ISL translation with pattern matching and structured output.
 * 
 * @module @isl-lang/translator
 */

export {
  ISLTranslator,
  createTranslator,
  patternLibrary,
  DEFAULT_PATTERN_LIBRARY,
  AUTH_PATTERNS,
  CRUD_PATTERNS,
  PAYMENT_PATTERNS,
} from './translator.js';

export type {
  TranslationRequest,
  TranslationResult,
  RepoContext,
  PatternLibrary,
  Pattern,
  Assumption,
  OpenQuestion,
  ISLAST,
  BehaviorAST,
  EntityAST,
  FieldAST,
  TypeAST,
  OutputAST,
  ErrorAST,
  ExpressionAST,
  PostconditionAST,
  IntentAST,
} from './translator.js';
