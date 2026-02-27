/**
 * SOC2 Control Evaluator
 *
 * Evaluates proof bundle data (verdicts, violations) and produces
 * SOC2 control status for auditor consumption.
 */

import {
  SHIPGATE_RULE_TO_SOC2,
  GATE_PHASES_FOR_CC8,
  SOC2_CONTROL_META,
  type SOC2ControlMapping,
  type ContributingCheck,
  type EvidenceRef,
  type SOC2ControlStatus,
} from './soc2-mapping.js';

/** Input from proof bundle verdicts */
export interface VerdictArtifact {
  phase: string;
  verdict: string;
  score?: number;
  details?: Record<string, unknown>;
  timestamp?: string;
}

/** Input from firewall violations */
export interface Violation {
  policyId?: string;
  ruleId?: string;
  message?: string;
  severity?: string;
  tier?: string;
}

/** Input for SOC2 evaluation */
export interface SOC2EvaluationInput {
  /** Bundle hash for evidence refs */
  bundleHash?: string;
  /** Bundle path for evidence refs */
  bundlePath?: string;
  /** Verdicts from gate/build/test/verify phases */
  verdicts: VerdictArtifact[];
  /** Firewall violations (policyId or ruleId) */
  violations?: Violation[];
  /** Violated rule IDs (from gate results) */
  violatedRuleIds?: string[];
}

/** Result of SOC2 evaluation */
export interface SOC2EvaluationResult {
  /** Controls with pass/warn/fail status */
  controls: SOC2ControlMapping[];
  /** Summary for auditor */
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
}

/**
 * Evaluate proof bundle data and produce SOC2 control mappings.
 */
export function evaluateSOC2(input: SOC2EvaluationInput): SOC2EvaluationResult {
  const controlMap = new Map<string, SOC2ControlMapping>();

  // Initialize all known controls
  for (const [id, meta] of Object.entries(SOC2_CONTROL_META)) {
    controlMap.set(id, {
      controlId: id,
      controlName: meta.name,
      description: meta.description,
      status: 'fail',
      contributingChecks: [],
      evidenceRefs: [],
    });
  }

  // 1. Process firewall violations -> negative impact on CC6.x, CC7.x
  const violatedIds = new Set<string>(
    input.violatedRuleIds ?? input.violations?.map((v) => v.policyId ?? v.ruleId ?? '').filter(Boolean) ?? []
  );

  for (const ruleId of violatedIds) {
    const controls = SHIPGATE_RULE_TO_SOC2[ruleId];
    if (!controls) continue;

    for (const controlId of controls) {
      const c = controlMap.get(controlId);
      if (!c) continue;

      c.contributingChecks.push({
        checkId: ruleId,
        checkName: formatCheckName(ruleId),
        passed: false,
        impact: 'negative',
      });
      if (input.bundleHash) {
        c.evidenceRefs.push({
          type: 'firewall_violation',
          ref: `bundle:${input.bundleHash}`,
          description: `Violation: ${ruleId}`,
        });
      }
    }
  }

  // 2. Process gate phases -> CC8.1 (Change Management)
  for (const v of input.verdicts) {
    if (!GATE_PHASES_FOR_CC8.includes(v.phase)) continue;

    const c = controlMap.get('CC8.1');
    if (!c) continue;

    const passed = /SHIP|pass|pass|PROVEN/i.test(v.verdict);
    c.contributingChecks.push({
      checkId: v.phase,
      checkName: `${v.phase} phase`,
      passed,
      impact: passed ? 'positive' : 'negative',
    });
    if (input.bundleHash) {
      c.evidenceRefs.push({
        type: 'gate_verdict',
        ref: `bundle:${input.bundleHash}#phase=${v.phase}`,
        description: `${v.phase}: ${v.verdict}`,
      });
    }
  }

  // 3. Determine status per control
  for (const c of controlMap.values()) {
    const neg = c.contributingChecks.filter((x) => x.impact === 'negative' && !x.passed);
    const pos = c.contributingChecks.filter((x) => x.impact === 'positive' && x.passed);

    if (neg.length > 0) {
      c.status = 'fail';
    } else if (pos.length > 0 || c.contributingChecks.length === 0) {
      // CC8.1: no phase evidence = fail; has phases = pass if all passed
      if (c.controlId === 'CC8.1') {
        const phaseChecks = c.contributingChecks.filter((x) =>
          GATE_PHASES_FOR_CC8.includes(x.checkId)
        );
        if (phaseChecks.length === 0) {
          c.status = 'fail';
        } else if (phaseChecks.every((x) => x.passed)) {
          c.status = 'pass';
        } else {
          c.status = 'warn';
        }
      } else {
        c.status = c.contributingChecks.length === 0 ? 'fail' : 'pass';
      }
    } else {
      c.status = 'warn';
    }
  }

  // 4. If gate passed and we have no violations, infer firewall checks passed (positive)
  const gateVerdict = input.verdicts.find((v) => v.phase === 'gate');
  const gatePassed = gateVerdict && /SHIP/i.test(gateVerdict.verdict);
  if (gatePassed && violatedIds.size === 0 && input.verdicts.length > 0) {
    for (const [ruleId, controls] of Object.entries(SHIPGATE_RULE_TO_SOC2)) {
      for (const controlId of controls) {
        const c = controlMap.get(controlId);
        if (!c || c.contributingChecks.some((x) => x.checkId === ruleId)) continue;
        c.contributingChecks.push({
          checkId: ruleId,
          checkName: formatCheckName(ruleId),
          passed: true,
          impact: 'positive',
        });
      }
    }
  }

  // 5. Recompute status for CC6/CC7 after adding positive checks
  for (const c of controlMap.values()) {
    if (c.controlId === 'CC8.1') continue;

    const neg = c.contributingChecks.filter((x) => x.impact === 'negative' && !x.passed);
    const pos = c.contributingChecks.filter((x) => x.impact === 'positive' && x.passed);

    if (neg.length > 0) {
      c.status = 'fail';
    } else if (pos.length > 0) {
      c.status = 'pass';
    } else if (c.contributingChecks.length === 0) {
      c.status = 'fail';
    } else {
      c.status = 'warn';
    }
  }

  const controls = Array.from(controlMap.values()).sort((a, b) =>
    a.controlId.localeCompare(b.controlId)
  );

  const summary = {
    total: controls.length,
    pass: controls.filter((c) => c.status === 'pass').length,
    warn: controls.filter((c) => c.status === 'warn').length,
    fail: controls.filter((c) => c.status === 'fail').length,
  };

  return { controls, summary };
}

function formatCheckName(ruleId: string): string {
  const parts = ruleId.split('/');
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1].replace(/-/g, ' ')}`;
  }
  return ruleId.replace(/-/g, ' ');
}
