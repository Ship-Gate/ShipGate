/**
 * Claim Graph Integration for Temporal Verification
 * 
 * Converts temporal verification results into unified claims for the claim graph.
 * 
 * @module @isl-lang/verifier-temporal/claim-integration
 */

// Note: @isl-lang/proof types are imported conditionally to avoid build-time dependency
// In production, ensure @isl-lang/proof is available
type UnifiedClaim = any;
type ClaimSubject = any;
type ClaimLocation = any;
type ClaimEvidence = any;
type ClaimStatus = 'proven' | 'not_proven' | 'violated' | 'unknown' | 'partial' | 'skipped';
import type {
  SequenceVerificationResult,
  SequenceRuleUnion,
} from './sequence-verifier.js';
import type { TemporalPropertyResult } from './verifier.js';
import * as crypto from 'crypto';

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert a sequence verification result to a unified claim
 */
export function sequenceResultToClaim(
  result: SequenceVerificationResult,
  locations: ClaimLocation[] = []
): UnifiedClaim {
  const claimId = generateClaimId(result.rule);
  const subject = createSubjectForRule(result.rule);
  
  // Determine claim status
  const status: ClaimStatus = result.satisfied
    ? 'proven'
    : result.verdict === 'VIOLATED'
    ? 'violated'
    : 'unknown';
  
  // Create evidence
  const evidence: ClaimEvidence[] = [
    {
      type: 'trace',
      supports: result.satisfied,
      confidence: result.satisfied ? 0.9 : 0.1,
      description: result.explanation,
      metadata: {
        ruleType: result.rule.type,
        ruleId: result.rule.id,
        matchedEvents: result.evidence.matchedEvents.length,
        totalEvents: result.evidence.totalEvents,
        traceDurationMs: result.evidence.traceDurationMs,
        violation: result.violation ? {
          type: result.violation.type,
          timestampMs: result.violation.timestampMs,
          expected: result.violation.expected,
          actual: result.violation.actual,
        } : undefined,
      },
    },
  ];
  
  return {
    id: claimId,
    kind: 'temporal',
    subject,
    locations,
    evidence,
    confidence: result.satisfied ? 0.9 : (result.verdict === 'VIOLATED' ? 0.1 : 0.5),
    engine: 'verifier-temporal',
    relationships: [],
    status,
    description: result.rule.description || formatRuleDescription(result.rule),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Convert a temporal property result to a unified claim
 */
export function temporalPropertyResultToClaim(
  result: TemporalPropertyResult,
  locations: ClaimLocation[] = []
): UnifiedClaim {
  const claimId = generateClaimIdForProperty(result);
  const subject: ClaimSubject = {
    type: 'clause',
    identifier: `temporal:${result.type}:${result.description}`,
    namespace: 'temporal',
  };
  
  // Determine claim status
  const status: ClaimStatus = result.success
    ? 'proven'
    : 'violated';
  
  // Create evidence
  const evidence: ClaimEvidence[] = [
    {
      type: 'runtime',
      supports: result.success,
      confidence: result.success ? 0.85 : 0.15,
      description: `${result.type} property: ${result.description}`,
      metadata: {
        propertyType: result.type,
        duration: result.duration,
        details: result.details,
      },
    },
  ];
  
  return {
    id: claimId,
    kind: 'temporal',
    subject,
    locations,
    evidence,
    confidence: result.success ? 0.85 : 0.15,
    engine: 'verifier-temporal',
    relationships: [],
    status,
    description: result.description,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Convert multiple sequence results to claims
 */
export function sequenceResultsToClaims(
  results: SequenceVerificationResult[],
  locations: ClaimLocation[] = []
): UnifiedClaim[] {
  return results.map(result => sequenceResultToClaim(result, locations));
}

/**
 * Convert multiple temporal property results to claims
 */
export function temporalPropertyResultsToClaims(
  results: TemporalPropertyResult[],
  locations: ClaimLocation[] = []
): UnifiedClaim[] {
  return results.map(result => temporalPropertyResultToClaim(result, locations));
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a deterministic claim ID from a rule
 */
function generateClaimId(rule: SequenceRuleUnion): string {
  const key = `${rule.type}:${rule.id}:${JSON.stringify(rule)}`;
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex').substring(0, 16);
}

/**
 * Generate a deterministic claim ID from a temporal property result
 */
function generateClaimIdForProperty(result: TemporalPropertyResult): string {
  const key = `temporal:${result.type}:${result.description}:${JSON.stringify(result.spec)}`;
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex').substring(0, 16);
}

/**
 * Create a subject for a sequence rule
 */
function createSubjectForRule(rule: SequenceRuleUnion): ClaimSubject {
  switch (rule.type) {
    case 'before':
      return {
        type: 'clause',
        identifier: `before:${formatEventMatcherIdentifier(rule.firstEvent)}:${formatEventMatcherIdentifier(rule.secondEvent)}`,
        namespace: 'temporal',
      };
    case 'cooldown':
      return {
        type: 'clause',
        identifier: `cooldown:${formatEventMatcherIdentifier(rule.event)}:${rule.duration.value}${rule.duration.unit}`,
        namespace: 'temporal',
      };
    case 'retry':
      return {
        type: 'clause',
        identifier: `retry:${formatEventMatcherIdentifier(rule.event)}:${rule.retryWindow.value}${rule.retryWindow.unit}`,
        namespace: 'temporal',
      };
    case 'time_window':
      return {
        type: 'clause',
        identifier: `time_window:${formatEventMatcherIdentifier(rule.event)}:${typeof rule.windowStart === 'number' ? rule.windowStart : rule.windowStart.value}${typeof rule.windowStart === 'number' ? 'ms' : rule.windowStart.unit}-${typeof rule.windowEnd === 'number' ? rule.windowEnd : rule.windowEnd.value}${typeof rule.windowEnd === 'number' ? 'ms' : rule.windowEnd.unit}`,
        namespace: 'temporal',
      };
  }
}

/**
 * Format an event matcher as an identifier string
 */
function formatEventMatcherIdentifier(matcher: { kind?: string; handler?: string | RegExp }): string {
  const parts: string[] = [];
  
  if (matcher.kind) {
    parts.push(`kind=${matcher.kind}`);
  }
  
  if (matcher.handler) {
    if (typeof matcher.handler === 'string') {
      parts.push(`handler=${matcher.handler}`);
    } else {
      parts.push(`handler=${matcher.handler.source}`);
    }
  }
  
  return parts.length > 0 ? parts.join(',') : 'any';
}

/**
 * Format a rule description
 */
function formatRuleDescription(rule: SequenceRuleUnion): string {
  switch (rule.type) {
    case 'before':
      return `${formatEventMatcherIdentifier(rule.firstEvent)} must occur before ${formatEventMatcherIdentifier(rule.secondEvent)}`;
    case 'cooldown':
      return `${formatEventMatcherIdentifier(rule.event)} must not occur again within ${rule.duration.value}${rule.duration.unit}`;
    case 'retry':
      return `${formatEventMatcherIdentifier(rule.event)} must retry within ${rule.retryWindow.value}${rule.retryWindow.unit} after failure`;
    case 'time_window':
      return `${formatEventMatcherIdentifier(rule.event)} must occur within time window`;
  }
}
