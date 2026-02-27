/**
 * Claim Adapters
 * 
 * Adapters to convert claims from different engines into the unified claim format.
 * 
 * @module @isl-lang/proof/claim-adapters
 */

import * as crypto from 'crypto';
import type { UnifiedClaim, ClaimKind, ClaimStatus, ClaimSubject, ClaimEvidence } from './claim-graph.js';
import type { BundleClaim } from './bundle-hash.js';

// ============================================================================
// Proof Bundle Adapter
// ============================================================================

/**
 * Convert BundleClaim to UnifiedClaim
 */
export function fromBundleClaim(
  claim: BundleClaim,
  engine: string = 'proof-bundle'
): UnifiedClaim {
  const subject = claim.clauseId.includes(':')
    ? claim.clauseId.split(':')
    : ['unknown', claim.clauseId];

  return {
    id: `bundle:${claim.clauseId}`,
    kind: mapClauseTypeToKind(claim.clauseType),
    subject: {
      type: 'clause',
      identifier: claim.clauseId,
      namespace: subject[0],
    },
    locations: claim.source
      ? [
          {
            file: claim.source.file,
            line: claim.source.line,
            column: claim.source.column,
          },
        ]
      : [],
    evidence: claim.traceIds
      ? claim.traceIds.map(traceId => ({
          type: 'trace' as const,
          supports: claim.status === 'proven',
          confidence: claim.status === 'proven' ? 0.9 : 0.5,
          description: `Trace ${traceId}`,
          metadata: { traceId },
        }))
      : [],
    confidence: claim.status === 'proven' ? 0.9 : claim.status === 'violated' ? 0.1 : 0.5,
    engine,
    relationships: [],
    status: mapBundleClaimStatus(claim.status),
    description: claim.reason,
    original: {
      clauseId: claim.clauseId,
      clauseType: claim.clauseType,
      behavior: claim.behavior,
    },
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Claims Verifier Adapter
// ============================================================================

/**
 * Convert claims-verifier Claim to UnifiedClaim
 */
export function fromClaimsVerifierClaim(
  claim: {
    id: string;
    text: string;
    value: string | number;
    location: { file: string; line: number; column?: number };
    status: string;
    confidence: number;
  },
  engine: string = 'claims-verifier'
): UnifiedClaim {
  return {
    id: `claims:${claim.id}`,
    kind: 'documentation',
    subject: {
      type: 'other',
      identifier: `claim:${claim.id}`,
    },
    locations: [
      {
        file: claim.location.file,
        line: claim.location.line,
        column: claim.location.column,
      },
    ],
    evidence: [],
    confidence: claim.confidence,
    engine,
    relationships: [],
    status: mapClaimsVerifierStatus(claim.status),
    description: claim.text,
    original: {
      value: claim.value,
      text: claim.text,
    },
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Firewall Adapter
// ============================================================================

/**
 * Convert firewall Claim to UnifiedClaim
 */
export function fromFirewallClaim(
  claim: {
    id: string;
    type: string;
    value: string;
    location: { line: number; column: number; length: number };
    confidence: number;
  },
  filePath: string,
  engine: string = 'firewall'
): UnifiedClaim {
  const kind = mapFirewallClaimTypeToKind(claim.type);

  return {
    id: `firewall:${claim.id}`,
    kind,
    subject: {
      type: mapFirewallTypeToSubjectType(claim.type),
      identifier: claim.value,
    },
    locations: [
      {
        file: filePath,
        line: claim.location.line,
        column: claim.location.column,
      },
    ],
    evidence: [],
    confidence: claim.confidence,
    engine,
    relationships: [],
    status: 'unknown',
    description: `${claim.type}: ${claim.value}`,
    original: {
      type: claim.type,
      value: claim.value,
    },
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Verifier Adapter
// ============================================================================

/**
 * Convert verifier ClauseResult to UnifiedClaim
 */
export function fromVerifierClauseResult(
  clause: {
    clauseId: string;
    clauseType: string;
    expression: string;
    status: string;
    confidence: number;
    evidence: Array<{
      file: string;
      line: number;
      column: number;
      kind: string;
    }>;
  },
  engine: string = 'verifier'
): UnifiedClaim {
  const subject = clause.clauseId.includes(':')
    ? clause.clauseId.split(':')
    : ['unknown', clause.clauseId];

  return {
    id: `verifier:${clause.clauseId}`,
    kind: mapClauseTypeToKind(clause.clauseType as any),
    subject: {
      type: 'clause',
      identifier: clause.clauseId,
      namespace: subject[0],
    },
    locations: clause.evidence.map(ev => ({
      file: ev.file,
      line: ev.line,
      column: ev.column,
    })),
    evidence: clause.evidence.map(ev => ({
      type: mapEvidenceKindToType(ev.kind),
      supports: clause.status === 'PASS',
      confidence: clause.confidence / 100,
      description: `${ev.kind} evidence`,
      location: {
        file: ev.file,
        line: ev.line,
        column: ev.column,
      },
    })),
    confidence: clause.confidence / 100,
    engine,
    relationships: [],
    status: mapVerifierStatus(clause.status),
    description: clause.expression,
    original: {
      clauseId: clause.clauseId,
      clauseType: clause.clauseType,
      expression: clause.expression,
    },
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Route/Env Adapter (for truthpack-based claims)
// ============================================================================

/**
 * Create a unified claim for a route
 */
export function createRouteClaim(
  route: string,
  method: string,
  locations: Array<{ file: string; line: number; column?: number }>,
  engine: string = 'truthpack'
): UnifiedClaim {
  const normalizedRoute = `${method.toUpperCase()} ${route}`;

  return {
    id: `route:${crypto.createHash('sha256').update(normalizedRoute).digest('hex').slice(0, 16)}`,
    kind: 'route',
    subject: {
      type: 'route',
      identifier: normalizedRoute,
    },
    locations,
    evidence: [],
    confidence: 1.0,
    engine,
    relationships: [],
    status: 'proven',
    description: `Route: ${normalizedRoute}`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a unified claim for an environment variable
 */
export function createEnvClaim(
  envVar: string,
  locations: Array<{ file: string; line: number; column?: number }>,
  engine: string = 'truthpack'
): UnifiedClaim {
  return {
    id: `env:${crypto.createHash('sha256').update(envVar).digest('hex').slice(0, 16)}`,
    kind: 'env',
    subject: {
      type: 'env',
      identifier: envVar,
    },
    locations,
    evidence: [],
    confidence: 1.0,
    engine,
    relationships: [],
    status: 'proven',
    description: `Environment variable: ${envVar}`,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapClauseTypeToKind(clauseType: string): ClaimKind {
  switch (clauseType) {
    case 'postcondition':
      return 'postcondition';
    case 'precondition':
      return 'precondition';
    case 'invariant':
      return 'invariant';
    case 'security':
      return 'security';
    case 'temporal':
      return 'temporal';
    default:
      return 'other';
  }
}

function mapBundleClaimStatus(status: string): ClaimStatus {
  switch (status) {
    case 'proven':
      return 'proven';
    case 'violated':
      return 'violated';
    case 'not_proven':
      return 'not_proven';
    case 'unknown':
      return 'unknown';
    default:
      return 'unknown';
  }
}

function mapClaimsVerifierStatus(status: string): ClaimStatus {
  switch (status) {
    case 'verified':
      return 'proven';
    case 'mismatch':
      return 'violated';
    case 'unverifiable':
      return 'not_proven';
    default:
      return 'unknown';
  }
}

function mapVerifierStatus(status: string): ClaimStatus {
  switch (status) {
    case 'PASS':
      return 'proven';
    case 'FAIL':
      return 'violated';
    case 'PARTIAL':
      return 'partial';
    case 'SKIPPED':
      return 'skipped';
    default:
      return 'unknown';
  }
}

function mapFirewallClaimTypeToKind(type: string): ClaimKind {
  switch (type) {
    case 'api_endpoint':
      return 'route';
    case 'env_variable':
      return 'env';
    case 'import':
      return 'import';
    case 'file_reference':
      return 'file';
    case 'package_dependency':
      return 'package';
    case 'type_reference':
      return 'type';
    case 'function_call':
      return 'symbol';
    default:
      return 'other';
  }
}

function mapFirewallTypeToSubjectType(type: string): ClaimSubject['type'] {
  switch (type) {
    case 'api_endpoint':
      return 'route';
    case 'env_variable':
      return 'env';
    case 'file_reference':
      return 'file';
    case 'package_dependency':
      return 'package';
    case 'type_reference':
      return 'type';
    case 'function_call':
      return 'symbol';
    default:
      return 'other';
  }
}

function mapEvidenceKindToType(kind: string): ClaimEvidence['type'] {
  switch (kind) {
    case 'test_assertion':
    case 'assertion_pass':
    case 'assertion_fail':
      return 'test';
    case 'static_analysis':
      return 'static_analysis';
    case 'binding_found':
    case 'binding_missing':
      return 'filesystem';
    default:
      return 'other';
  }
}
