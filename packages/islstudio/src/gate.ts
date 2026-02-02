/**
 * ISL Studio - Gate Runner
 */

import { 
  createRegistry, 
  loadBuiltinPacks,
  type RuleContext,
  type RuleViolation,
  type PolicyPackRegistry,
} from '@isl-lang/policy-packs';
import * as crypto from 'crypto';

export interface GateConfig {
  packs?: Record<string, { enabled: boolean; rules?: Record<string, string> }>;
  threshold?: number;
  evidence?: { outputDir: string; sign?: boolean };
}

export interface GateFile {
  path: string;
  content: string;
}

export interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: RuleViolation[];
  fingerprint: string;
  summary: {
    filesChecked: number;
    blockers: number;
    warnings: number;
  };
}

/**
 * Run the gate on a set of files
 */
export async function runGate(files: GateFile[], config: GateConfig): Promise<GateResult> {
  // Create fresh registry
  const registry = createRegistry();
  await loadBuiltinPacks(registry);
  
  // Get rules with config applied
  const packConfig = config.packs ? Object.fromEntries(
    Object.entries(config.packs).map(([id, cfg]) => [id, { enabled: cfg.enabled }])
  ) : undefined;
  
  const rules = registry.getEnabledRules(packConfig);
  const allViolations: RuleViolation[] = [];
  
  // Run rules on each file
  for (const file of files) {
    const ctx: RuleContext = {
      claims: [],
      evidence: [],
      filePath: file.path,
      content: file.content,
      truthpack: null as any,
    };
    
    for (const rule of rules) {
      const violation = rule.evaluate(ctx);
      if (violation) {
        allViolations.push({
          ...violation,
          filePath: file.path,
        });
      }
    }
  }

  // Calculate score
  const blockers = allViolations.filter(v => v.tier === 'hard_block').length;
  const warnings = allViolations.filter(v => v.tier === 'soft_block' || v.tier === 'warn').length;
  
  const score = Math.max(0, 100 - (blockers * 25) - (warnings * 5));
  const threshold = config.threshold ?? 70;
  
  // Determine verdict
  const verdict = blockers > 0 || score < threshold ? 'NO_SHIP' : 'SHIP';
  
  // Generate fingerprint
  const contentHash = crypto.createHash('sha256');
  for (const file of files) {
    contentHash.update(file.path + ':' + file.content);
  }
  const fingerprint = contentHash.digest('hex').slice(0, 16);

  return {
    verdict,
    score,
    violations: allViolations,
    fingerprint,
    summary: {
      filesChecked: files.length,
      blockers,
      warnings,
    },
  };
}
