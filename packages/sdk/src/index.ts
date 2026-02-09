/**
 * @shipgate/sdk — Public Entry Point
 *
 * Programmatic access to ISL parsing, verification, gate decisions,
 * spec generation, and quality linting.
 *
 * STABILITY CONTRACT:
 * - All exports in this file are part of the public API
 * - AST internals are never exposed
 * - Breaking changes require a major version bump
 * - Returned objects are frozen (read-only)
 *
 * @packageDocumentation
 * @module @shipgate/sdk
 *
 * @example
 * ```typescript
 * import {
 *   parseISL,
 *   verifySpec,
 *   decideGate,
 *   lintISL,
 * } from '@shipgate/sdk';
 *
 * // Parse ISL
 * const parsed = parseISL('domain Auth version "1.0" { ... }');
 *
 * // Verify implementation
 * const result = await verifySpec({
 *   specPath: 'src/auth.isl',
 *   implPath: 'src/auth.ts',
 * });
 *
 * // Gate decision
 * const verdict = decideGate(result);
 * console.log(verdict); // 'SHIP' | 'WARN' | 'NO_SHIP'
 * ```
 */

// ── Functions ─────────────────────────────────────────────────────────
export { parseISL, parseISLFile } from './parse.js';
export { verifySpec } from './verify.js';
export { decideGate } from './gate.js';
export { generateSpecFromSource } from './generate.js';
export { lintISL } from './lint.js';

// ── Types ─────────────────────────────────────────────────────────────
export type {
  ParseResult,
  DomainSummary,
  BehaviorSummary,
  VerifyResult,
  GateVerdict,
  VerifyOptions,
  GeneratedSpec,
  QualityReport,
} from './types.js';
