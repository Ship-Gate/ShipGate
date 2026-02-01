// ============================================================================
// ISL Effect System - Public API
// Algebraic effects for tracking and controlling side effects
// ============================================================================

// Types
export type {
  EffectKind,
  Effect,
  EffectOperation,
  EffectParameter,
  EffectType,
  EffectSet,
  EffectRef,
  EffectHandler,
  EffectHandlerImpl,
  EffectRow,
  Effectful,
  Pure,
  IO,
  Async,
  Stateful,
  WithResource,
  EffectConstraint,
  EffectBound,
  EffectInference,
  EffectError,
  EffectWarning,
  EffectAlgebra,
  ResourceLifecycle,
  EffectScope,
  EffectContext,
  EffectFrame,
} from './types.js';

// Core
export {
  effectAlgebra,
  createScope,
  createContext,
  registerHandler,
  findHandler,
  perform,
  runWith,
  runPure,
  inferEffects,
  checkEffectsHandled,
  validateHandlers,
  EffectNotHandledError,
  ResourceLeakError,
} from './core.js';

// Built-in effects
export {
  IOEffect,
  StateEffect,
  ExceptionEffect,
  AsyncEffect,
  ResourceEffect,
  RandomEffect,
  TimeEffect,
  LoggingEffect,
  BUILTIN_EFFECTS,
  createStateHandler,
  createConsoleHandler,
  createRandomHandler,
  createExceptionHandler,
  createLoggingHandler,
} from './builtins.js';

// ISL Syntax
export {
  parseEffectDeclaration,
  parseEffectAnnotation,
  parseHandlerDeclaration,
  generateISLSyntax,
  generateBehaviorEffects,
  generateTypeScript,
  type ISLEffectDeclaration,
  type ISLEffectOperation,
  type ISLEffectParam,
  type ISLEffectAnnotation,
  type ISLHandlerDeclaration,
  type ISLHandlerImpl,
  type ISLEffectPolymorphicFn,
  type ISLEffectScope,
} from './syntax.js';
