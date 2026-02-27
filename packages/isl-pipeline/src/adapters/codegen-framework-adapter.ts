/**
 * Codegen Framework Adapter Interface
 *
 * Unified interface for generating backend code from ISL specs.
 * Supports Next.js App Router and Express.js.
 *
 * @module @isl-lang/pipeline/adapters/codegen-framework-adapter
 */

import type { ISLAST, BehaviorAST, RepoContext } from '@isl-lang/translator';

// ============================================================================
// Types (align with user spec: ISLSpec = ISLAST, ISLEndpoint = BehaviorAST)
// ============================================================================

/** Alias for ISL spec (domain + behaviors) */
export type ISLSpec = ISLAST;

/** Alias for ISL endpoint (behavior) */
export type ISLEndpoint = BehaviorAST;

/** Map of file path -> content */
export type FileMap = Map<string, string>;

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CodegenContext {
  spec: ISLSpec;
  repoContext: RepoContext;
}

// ============================================================================
// Framework Adapter Interface
// ============================================================================

export interface FrameworkAdapter {
  name: string;

  /** Generate full project structure from ISL spec */
  generateProjectStructure(spec: ISLSpec): FileMap;

  /** Generate a single route file for an endpoint */
  generateRouteFile(endpoint: ISLEndpoint, context: CodegenContext): GeneratedFile;

  /** Generate middleware files (auth, error handling, logging, CORS, rate limiting) */
  generateMiddleware(spec: ISLSpec): GeneratedFile[];

  /** Generate main entry point */
  generateEntryPoint(spec: ISLSpec): GeneratedFile;

  /** Package dependencies (name -> version) */
  getPackageDeps(): Record<string, string>;

  /** NPM scripts */
  getScripts(): Record<string, string>;

  /** tsconfig.json base */
  getTsConfig(): object;
}
