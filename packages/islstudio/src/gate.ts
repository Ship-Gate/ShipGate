/**
 * ISL Studio - Gate Runner
 * 
 * Provides machine-readable gate output suitable for healer ingestion.
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

/**
 * Rulepack version information for healer traceability
 */
export interface RulepackVersion {
  id: string;
  version: string;
  rulesCount: number;
}

/**
 * GateResult - Machine-readable output suitable for healer ingestion.
 * 
 * The fingerprint is a stable hash based on violations (not file content),
 * so identical violations will produce the same fingerprint across runs.
 */
export interface GateResult {
  /** Final verdict: SHIP or NO_SHIP */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Score from 0-100 */
  score: number;
  /** Array of policy violations detected */
  violations: RuleViolation[];
  /** 
   * Stable fingerprint based on violations.
   * Same violations = same fingerprint (regardless of file content changes).
   * Used by healer to track violation state across runs.
   */
  fingerprint: string;
  /** Version of the policy bundle used */
  policyBundleVersion: string;
  /** Version information for each rulepack */
  rulepackVersions: RulepackVersion[];
  /** Summary statistics */
  summary: {
    filesChecked: number;
    blockers: number;
    warnings: number;
  };
  /** Timestamp of the gate run (ISO 8601) */
  timestamp: string;
}

/** Policy bundle version - bump when rules change */
const POLICY_BUNDLE_VERSION = '1.0.0';

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
  
  // Collect rulepack versions from registry
  const rulepackVersions = collectRulepackVersions(registry);
  
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

  // Sort violations for deterministic output
  allViolations.sort((a, b) => {
    const pathCompare = (a.filePath || '').localeCompare(b.filePath || '');
    if (pathCompare !== 0) return pathCompare;
    const lineCompare = (a.line || 0) - (b.line || 0);
    if (lineCompare !== 0) return lineCompare;
    return a.ruleId.localeCompare(b.ruleId);
  });

  // Calculate score
  const blockers = allViolations.filter(v => v.tier === 'hard_block').length;
  const warnings = allViolations.filter(v => v.tier === 'soft_block' || v.tier === 'warn').length;
  
  const score = Math.max(0, 100 - (blockers * 25) - (warnings * 5));
  const threshold = config.threshold ?? 70;
  
  // Determine verdict
  const verdict = blockers > 0 || score < threshold ? 'NO_SHIP' : 'SHIP';
  
  // Generate stable fingerprint based on violations (not file content)
  // This allows healer to track violation state across runs
  const fingerprint = generateViolationFingerprint(allViolations, POLICY_BUNDLE_VERSION);

  return {
    verdict,
    score,
    violations: allViolations,
    fingerprint,
    policyBundleVersion: POLICY_BUNDLE_VERSION,
    rulepackVersions,
    summary: {
      filesChecked: files.length,
      blockers,
      warnings,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate a stable fingerprint based on violations.
 * Same violations produce the same fingerprint regardless of file content changes.
 * 
 * Hash includes: ruleId, filePath, line, message (sorted and deterministic)
 */
function generateViolationFingerprint(violations: RuleViolation[], bundleVersion: string): string {
  const hash = crypto.createHash('sha256');
  
  // Include bundle version for fingerprint invalidation on rule changes
  hash.update(`bundle:${bundleVersion}\n`);
  
  // Sort violations deterministically for stable hash
  const sortedViolations = [...violations].sort((a, b) => {
    const pathCmp = (a.filePath || '').localeCompare(b.filePath || '');
    if (pathCmp !== 0) return pathCmp;
    const lineCmp = (a.line || 0) - (b.line || 0);
    if (lineCmp !== 0) return lineCmp;
    return a.ruleId.localeCompare(b.ruleId);
  });
  
  for (const v of sortedViolations) {
    // Include stable violation identity fields
    hash.update(`${v.ruleId}:${v.filePath || ''}:${v.line || 0}:${v.tier}\n`);
  }
  
  return hash.digest('hex').slice(0, 16);
}

/**
 * Collect version information from all registered policy packs
 */
function collectRulepackVersions(registry: PolicyPackRegistry): RulepackVersion[] {
  const packs = registry.getAllPacks();
  return packs.map(pack => ({
    id: pack.id,
    version: pack.version,
    rulesCount: pack.rules.length,
  }));
}
