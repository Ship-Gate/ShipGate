/**
 * Hallucination Scanner
 * Static analysis for detecting ghost imports, fake modules, and missing dependencies.
 *
 * @module @isl-lang/hallucination-scanner
 */

// ---- Rust resolver ----
export { resolveRust, scanRustFile } from './rust/resolver.js';
export type {
  RustResolverOptions,
} from './rust/resolver.js';
export type {
  RustDependencyCheckResult,
  RustFinding,
  RustFindingKind,
  RustModuleGraph,
  RustModuleNode,
  RustUse,
  CargoManifest,
  CargoPackage,
  CargoDependencyValue,
  SourceLocation as RustSourceLocation,
} from './rust/types.js';

// ---- Go resolver ----
export { resolveGo, scanGoFile } from './go/go-resolver.js';
export type {
  GoResolverOptions,
} from './go/go-resolver.js';
export type {
  GoDependencyCheckResult,
  GoFinding,
  GoFindingKind,
  GoImport,
  GoModInfo,
  SourceLocation as GoSourceLocation,
} from './go/types.js';
export { isGoStdlib, hasStdlibPrefix, GO_STDLIB_PACKAGES } from './go/stdlib.js';
