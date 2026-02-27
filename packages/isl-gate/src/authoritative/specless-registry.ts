/**
 * Specless Check Registry
 *
 * Integration point for Wave 3 agents to plug specless checks into
 * the authoritative gate. Each registered check runs against
 * implementation files when no ISL spec is available.
 *
 * @module @isl-lang/gate/authoritative/specless-registry
 */

import type { GateEvidence } from './verdict-engine.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Context passed to every specless check.
 */
export interface GateContext {
  /** Absolute path to project root */
  projectRoot: string;
  /** Implementation source code (concatenated if directory) */
  implementation: string;
  /** Whether spec was explicitly marked optional */
  specOptional: boolean;
}

/**
 * A pluggable specless check.
 *
 * Agents implement this interface and register via `registerSpeclessCheck`.
 */
export interface SpeclessCheck {
  /** Unique human-readable name, e.g. "auth-bypass-scanner" */
  name: string;
  /** Run the check against a file within the given context. */
  run(file: string, context: GateContext): Promise<GateEvidence[]>;
}

// ============================================================================
// Registry (module-level singleton)
// ============================================================================

const speclessChecks: SpeclessCheck[] = [];

/**
 * Register a specless check.
 * Checks are executed in registration order when the gate runs in specless mode.
 */
export function registerSpeclessCheck(check: SpeclessCheck): void {
  // Prevent duplicate registrations by name
  if (speclessChecks.some(c => c.name === check.name)) {
    return;
  }
  speclessChecks.push(check);
}

/**
 * Unregister a specless check by name.
 * Returns `true` if a check was removed, `false` otherwise.
 */
export function unregisterSpeclessCheck(name: string): boolean {
  const idx = speclessChecks.findIndex(c => c.name === name);
  if (idx >= 0) {
    speclessChecks.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Retrieve a snapshot of all registered specless checks.
 * The returned array is a copy — mutating it does not affect the registry.
 */
export function getSpeclessChecks(): readonly SpeclessCheck[] {
  return [...speclessChecks];
}

/**
 * Remove all registered specless checks.
 * Useful for test teardown.
 */
export function clearSpeclessChecks(): void {
  speclessChecks.length = 0;
}

/**
 * Run all registered specless checks against a file.
 * Returns a flat array of evidence from every check.
 */
export async function runSpeclessChecks(
  file: string,
  context: GateContext,
): Promise<GateEvidence[]> {
  const allEvidence: GateEvidence[] = [];

  if (!file || typeof file !== 'string') {
    return [{
      source: 'specless-scanner',
      check: 'specless-registry',
      result: 'skip',
      confidence: 0,
      details: 'Invalid file path: file was undefined or not a string',
    }];
  }

  for (const check of speclessChecks) {
    try {
      const evidence = await check.run(file, context);
      allEvidence.push(...evidence);
    } catch {
      // If a check throws, record the failure as evidence
      allEvidence.push({
        source: 'specless-scanner',
        check: check.name,
        result: 'fail',
        confidence: 0.5,
        details: `Specless check "${check.name}" threw an error`,
      });
    }
  }

  return allEvidence;
}
