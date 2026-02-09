// ============================================================================
// Phantom Dependency Scanner
// ============================================================================

export { scanDependencies } from './scanner.js';
export type {
  ScannerOptions,
  ScanResult,
  Finding,
  FindingKind,
  WorkspaceInfo,
  PackageJson,
  ParsedImport,
} from './types.js';

export { detectWorkspace, isWorkspacePackage, resolveWorkspacePackage } from './workspace.js';
export { RegistryChecker } from './registry.js';
export { findTypoCandidates, generateTypoCandidates } from './typo-detector.js';
export { parseImports, isRelativeImport, isNodeBuiltin } from './parser.js';
