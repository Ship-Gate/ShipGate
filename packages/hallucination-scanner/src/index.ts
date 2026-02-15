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

// ---- TypeScript/JavaScript resolver ----
export { resolveTs, scanTsFile } from './ts/resolver.js';
export type {
  TsResolverOptions,
} from './ts/resolver.js';
export type {
  TsDependencyCheckResult,
  TsFinding,
  TsFindingKind,
  TsImport,
  TsImportKind,
  PackageManifest,
  SourceLocation as TsSourceLocation,
} from './ts/types.js';
export { parseImports, extractPackageName } from './ts/import-parser.js';
export { isNodeBuiltin, isFakeNodeBuiltin, NODE_BUILTINS } from './ts/builtins.js';

// ---- HallucinationDetector (AI-specific behavioral checks) ----
export { HallucinationDetector, toFindings } from './ts/hallucination-detector.js';
export type { HallucinationDetectorOptions } from './ts/hallucination-detector.js';
export type {
  HallucinationFinding,
  HallucinationScanResult,
  HallucinationSeverity,
  HallucinationCategory,
  Finding,
} from './ts/hallucination-types.js';
export type { HallucinationRule, RuleContext, RuleSetId } from './ts/hallucination-rules.js';
export { loadRules, loadRulesFromFile } from './ts/rule-loader.js';
export type { RuleLoaderOptions } from './ts/rule-loader.js';
export { getBuiltinRules } from './ts/rules/builtin.js';
export { PHANTOM_API_SIGNATURES } from './ts/phantom-api-signatures.js';
export type { PhantomApiSignature, PhantomApiSeverity } from './ts/phantom-api-signatures.js';
