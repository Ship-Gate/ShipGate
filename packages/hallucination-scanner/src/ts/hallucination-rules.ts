/**
 * HallucinationRule — Extensible rule interface for AI hallucination detection
 *
 * Users can add custom rules to detect project-specific hallucinations.
 *
 * @module @isl-lang/hallucination-scanner/ts/hallucination-rules
 */

import type { HallucinationSeverity } from './hallucination-types.js';

/** Context passed to each rule during scanning */
export interface RuleContext {
  /** Full source code of the file being scanned */
  source: string;
  /** File path (relative or absolute) */
  file: string;
  /** Directory containing the file */
  fromDir: string;
  /** Environment variables defined in .env, .env.example, etc. */
  envVarsDefined: Set<string>;
  /** Env vars only in .env.local (won't exist in deployment) */
  envVarsInLocalOnly: Set<string>;
  /** Project file paths (resolved) */
  projectFiles: Set<string>;
  /** Async: check if a file exists */
  fileExists: (path: string) => Promise<boolean>;
  /** Async: read file contents */
  readFile: (path: string) => Promise<string>;
}

/** A single finding produced by a rule */
export interface RuleFinding {
  ruleId: string;
  category: string;
  severity: HallucinationSeverity;
  message: string;
  suggestion?: string;
  file: string;
  line: number;
  column: number;
  snippet?: string;
  raw?: string;
}

/**
 * HallucinationRule — interface for custom hallucination detection rules.
 * Rules can be sync or async.
 */
export interface HallucinationRule {
  /** Unique rule ID (e.g. "phantom-api-prisma-findByEmail") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Package/framework this rule applies to (e.g. "prisma", "next", "express") */
  package?: string;
  /** Run the rule. May be sync or async. */
  run(ctx: RuleContext): RuleFinding[] | Promise<RuleFinding[]>;
}

/** Rule set identifier for built-in rules */
export type RuleSetId =
  | 'nextjs'
  | 'express'
  | 'fastify'
  | 'react'
  | 'prisma'
  | 'stripe'
  | 'node'
  | 'phantom-api'
  | 'env-vars'
  | 'file-references'
  | 'confident-but-wrong'
  | 'copy-paste-artifacts'
  | 'stale-deprecated';
