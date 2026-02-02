// ============================================================================
// ISL Effect System - Public API
// Algebraic effects for tracking and controlling side effects
// ============================================================================

// Runtime Effect Types
export type {
  Effect,
  AnyEffect,
  ReadEffect,
  WriteEffect,
  IOEffect as IOEffectType,
  NetworkEffect,
  DatabaseEffect,
  MessageEffect,
  LogEffect,
  TimeEffect as TimeEffectType,
  RandomEffect as RandomEffectType,
  EnvEffect,
  FileSystemEffect,
  ShellEffect,
  SequenceEffect,
  ParallelEffect,
  ConditionalEffect,
  RetryPolicy,
  RetryEffect,
  TimeoutEffect,
  CacheEffect,
  EffectHandler,
  EffectInterceptor,
  EffectRuntime,
  EffectConstraint,
  EffectSpec,
} from './types.js';

// Algebraic Effect Types
export type {
  EffectKind,
  AlgebraicEffect,
  EffectOperation,
  EffectParameter,
  EffectType,
  EffectSet,
  EffectRef,
  AlgebraicEffectHandler,
  EffectHandlerImpl,
  EffectRow,
  Effectful,
  Pure,
  IO,
  Async,
  Stateful,
  WithResource,
  AlgebraicEffectBoundConstraint,
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
