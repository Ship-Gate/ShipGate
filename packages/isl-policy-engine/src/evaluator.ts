/**
 * ISL Policy Engine - Deterministic Evaluator
 *
 * Evaluates policy conditions against claims/evidence/verdicts.
 * Fully deterministic: same input → same output, always.
 *
 * @module @isl-lang/isl-policy-engine
 */

import type {
  PolicyCondition,
  PolicyDef,
  PolicyEnginePack,
  PolicyEvalInput,
  PolicyEngineResult,
  PolicyDecisionEntry,
  PolicyAction,
  EvidenceRef,
  ComparisonOp,
  StringMatchOp,
} from './types.js';

// ============================================================================
// Condition Evaluator
// ============================================================================

/**
 * Evaluate a single condition against the input context.
 * Returns true if the condition matches (i.e. the policy should fire).
 */
export function evaluateCondition(
  condition: PolicyCondition,
  input: PolicyEvalInput,
): boolean {
  switch (condition.kind) {
    case 'verdict':
      return input.verdict === condition.verdict;

    case 'confidence':
      return compareNum(input.confidence ?? 0, condition.op, condition.threshold);

    case 'blast_radius': {
      let measured: number;
      switch (condition.measure) {
        case 'files':
          measured = input.files.length;
          break;
        case 'claims':
          measured = input.claims.length;
          break;
        case 'violations':
          measured = input.existingViolations?.length ?? 0;
          break;
        default:
          measured = 0;
      }
      return compareNum(measured, condition.op, condition.threshold);
    }

    case 'claim_type':
      return input.claims.some(c => condition.types.includes(c.type));

    case 'claim_field':
      return input.claims.some(claim => {
        const fieldValue = claim[condition.field] ?? '';
        return matchString(String(fieldValue), condition.op, condition.value);
      });

    case 'metric': {
      let metricValue: number;
      switch (condition.metric) {
        case 'trust_score':
          metricValue = input.trustScore ?? 0;
          break;
        case 'confidence':
          metricValue = input.confidence ?? 0;
          break;
        case 'claim_count':
          metricValue = input.claims.length;
          break;
        case 'violation_count':
          metricValue = input.existingViolations?.length ?? 0;
          break;
        case 'file_count':
          metricValue = input.files.length;
          break;
        default:
          metricValue = 0;
      }
      return compareNum(metricValue, condition.op, condition.value);
    }

    case 'presence': {
      const parts = condition.field.split('.');
      let current: unknown = input;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') {
          current = undefined;
          break;
        }
        current = (current as Record<string, unknown>)[part];
      }
      const exists = current !== undefined && current !== null;
      return condition.present ? exists : !exists;
    }

    case 'logic': {
      switch (condition.op) {
        case 'and':
          return condition.conditions.every(c => evaluateCondition(c, input));
        case 'or':
          return condition.conditions.some(c => evaluateCondition(c, input));
        case 'not':
          return !condition.conditions.some(c => evaluateCondition(c, input));
        default:
          return false;
      }
    }

    default:
      return false;
  }
}

// ============================================================================
// Numeric comparison helper
// ============================================================================

function compareNum(actual: number, op: ComparisonOp, expected: number): boolean {
  switch (op) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return actual > expected;
    case 'gte': return actual >= expected;
    case 'lt': return actual < expected;
    case 'lte': return actual <= expected;
    default: return false;
  }
}

// ============================================================================
// String match helper
// ============================================================================

function matchString(actual: string, op: StringMatchOp, expected: string): boolean {
  switch (op) {
    case 'equals': return actual === expected;
    case 'contains': return actual.includes(expected);
    case 'startsWith': return actual.startsWith(expected);
    case 'endsWith': return actual.endsWith(expected);
    case 'matches': {
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    }
    default: return false;
  }
}

// ============================================================================
// Explanation Builder
// ============================================================================

/**
 * Expand an explanation template with context data.
 * Placeholders: {verdict}, {confidence}, {trustScore}, {fileCount},
 *               {claimCount}, {violationCount}
 */
function expandExplanation(template: string, input: PolicyEvalInput): string {
  return template
    .replace(/\{verdict\}/g, input.verdict ?? 'unknown')
    .replace(/\{confidence\}/g, String(input.confidence ?? 0))
    .replace(/\{trustScore\}/g, String(input.trustScore ?? 0))
    .replace(/\{fileCount\}/g, String(input.files.length))
    .replace(/\{claimCount\}/g, String(input.claims.length))
    .replace(/\{violationCount\}/g, String(input.existingViolations?.length ?? 0));
}

/**
 * Build evidence references for a triggered policy.
 */
function buildEvidenceRefs(
  policy: PolicyDef,
  input: PolicyEvalInput,
): EvidenceRef[] {
  const refs: EvidenceRef[] = [];

  // Add verdict evidence if the policy checks verdict
  if (input.verdict) {
    refs.push({
      type: 'metric',
      id: 'verdict',
      label: 'Gate Verdict',
      detail: `Verdict: ${input.verdict}`,
    });
  }

  // Add confidence evidence
  if (input.confidence !== undefined) {
    refs.push({
      type: 'metric',
      id: 'confidence',
      label: 'Confidence',
      detail: `Confidence: ${input.confidence}%`,
    });
  }

  // Add trust score evidence
  if (input.trustScore !== undefined) {
    refs.push({
      type: 'metric',
      id: 'trust_score',
      label: 'Trust Score',
      detail: `Trust Score: ${input.trustScore}%`,
    });
  }

  // Add claim-based evidence refs
  if (input.claims.length > 0) {
    const relevantTypes = new Set(input.claims.map(c => c.type));
    refs.push({
      type: 'claim',
      id: 'claims-summary',
      label: 'Claims',
      detail: `${input.claims.length} claims of types: ${[...relevantTypes].join(', ')}`,
    });
  }

  // Add violation-based evidence
  if (input.existingViolations && input.existingViolations.length > 0) {
    refs.push({
      type: 'violation',
      id: 'violations-summary',
      label: 'Existing Violations',
      detail: `${input.existingViolations.length} existing violation(s)`,
    });
  }

  // Add file-based evidence
  if (input.files.length > 0) {
    refs.push({
      type: 'file',
      id: 'files-summary',
      label: 'Files',
      detail: `${input.files.length} file(s) evaluated`,
    });
  }

  // Add explicit evidence refs from policy
  if (policy.evidenceRefs) {
    for (const ref of policy.evidenceRefs) {
      refs.push({
        type: 'evidence',
        id: ref,
        label: ref,
        detail: `Referenced evidence: ${ref}`,
      });
    }
  }

  return refs;
}

// ============================================================================
// Engine: Evaluate All Policies
// ============================================================================

/**
 * Evaluate a set of policy packs against input.
 * Deterministic: same input + same policies → identical result.
 */
export function evaluate(
  packs: PolicyEnginePack[],
  input: PolicyEvalInput,
): PolicyEngineResult {
  const start = Date.now();
  const now = new Date().toISOString();

  const decisions: PolicyDecisionEntry[] = [];
  let policiesEvaluated = 0;

  // Sort packs by id, policies by id for determinism
  const sortedPacks = [...packs].sort((a, b) => a.id.localeCompare(b.id));

  for (const pack of sortedPacks) {
    const sortedPolicies = [...pack.policies].sort((a, b) => a.id.localeCompare(b.id));

    for (const policy of sortedPolicies) {
      if (policy.enabled === false) continue;
      policiesEvaluated++;

      const matches = evaluateCondition(policy.when, input);
      if (!matches) continue;

      const explanation = expandExplanation(policy.explanation, input);
      const evidenceRefs = buildEvidenceRefs(policy, input);
      const relatedClaims = input.claims.map(c => c.id);

      decisions.push({
        policyId: policy.id,
        policyName: policy.name,
        action: policy.action,
        severity: policy.severity,
        tier: policy.tier,
        explanation,
        evidenceRefs,
        relatedClaims,
        timestamp: now,
      });
    }
  }

  const blockers = decisions.filter(d => d.action === 'block');
  const warnings = decisions.filter(d => d.action === 'warn');
  const allows = decisions.filter(d => d.action === 'allow');

  const allowed = blockers.length === 0;

  const summaryParts: string[] = [];
  if (blockers.length > 0) {
    summaryParts.push(
      `BLOCKED: ${blockers.length} policy violation(s) — ${blockers.map(b => b.policyName).join(', ')}`,
    );
  }
  if (warnings.length > 0) {
    summaryParts.push(`${warnings.length} warning(s)`);
  }
  if (allowed && blockers.length === 0) {
    summaryParts.push('All policies passed');
  }

  return {
    allowed,
    decisions,
    blockers,
    warnings,
    summary: summaryParts.join('. '),
    durationMs: Date.now() - start,
    metadata: {
      policiesEvaluated,
      policiesTriggered: decisions.length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      allowCount: allows.length,
      timestamp: now,
    },
  };
}
