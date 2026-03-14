/**
 * Semgrep Integration → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/semgrep-integration to run Semgrep static analysis
 * with AI-specific rule packs. Falls back gracefully when Semgrep
 * is not installed.
 *
 * @module @isl-lang/gate/specless/semgrep-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

let hasRunForProject = false;
let cachedEvidence: GateEvidence[] = [];

export const semgrepCheck: SpeclessCheck = {
  name: 'semgrep-scanner',

  async run(_file: string, context: GateContext): Promise<GateEvidence[]> {
    if (hasRunForProject) return cachedEvidence;
    hasRunForProject = true;

    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/semgrep-integration');
      const createSemgrepCheck = mod.createSemgrepCheck as (config?: unknown) => {
        name: string;
        run(file: string, ctx: unknown): Promise<GateEvidence[]>;
      };

      const check = createSemgrepCheck();
      const evidence = await check.run(context.projectRoot, context);
      cachedEvidence = evidence;
      return evidence;
    } catch {
      cachedEvidence = [{
        source: 'specless-scanner',
        check: 'semgrep-scanner',
        result: 'skip',
        confidence: 0,
        details: 'Semgrep integration not available (package not installed)',
      }];
      return cachedEvidence;
    }
  },
};

registerSpeclessCheck(semgrepCheck);
