/**
 * Codegen Harness Types
 *
 * Defines the generator contract that all codegen targets must satisfy.
 */

import type { Domain } from '@isl-lang/parser';

/**
 * A single generated file from a generator.
 */
export interface GeneratedFile {
  /** Relative file path */
  path: string;
  /** File content (must be deterministic for golden comparison) */
  content: string;
}

/**
 * Every generator target must implement this contract.
 * Input: parsed ISL Domain AST
 * Output: deterministic file list (stable formatting, no timestamps)
 */
export interface CodeGenerator {
  /** Unique target name (e.g. 'typescript', 'rust', 'go', 'openapi') */
  readonly name: string;
  /** File extension for primary output */
  readonly extension: string;
  /** Generate deterministic files from a parsed ISL domain */
  generate(domain: Domain): GeneratedFile[];
}

/**
 * Result of a golden comparison for a single generator.
 */
export interface GoldenComparisonResult {
  generator: string;
  file: string;
  passed: boolean;
  diff?: string;
}
