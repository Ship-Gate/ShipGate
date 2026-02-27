/**
 * Coherence Engine
 *
 * Ensures generated files work together as a real project.
 * - ProjectManifest: tracks exports, types, dependencies per file
 * - CoherenceEngine: maintains manifest, provides codegen context, runs coherence checks
 * - ImportResolver: scans imports, validates against manifest, reports fixes, auto-fixes
 */

export { CoherenceEngine } from './coherence-engine.js';
export type { CoherenceEngineOptions } from './coherence-engine.js';

export { ThreadSafeProjectManifest } from './thread-safe-manifest.js';
export type { ThreadSafeManifestOptions } from './thread-safe-manifest.js';

export { ImportResolver } from './import-resolver.js';
export type { ImportResolverOptions } from './import-resolver.js';

export { parseImports, parseExports, isProjectImport, normalizePathForLookup } from './parser.js';

export type {
  ProjectManifest,
  ManifestEntry,
  ParsedImport,
  ParsedExport,
  UnresolvedImport,
  CoherenceCheckResult,
  CodegenContext,
} from './types.js';
