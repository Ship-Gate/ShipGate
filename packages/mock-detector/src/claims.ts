/**
 * Claim integration for mock detector
 * 
 * Converts mock findings into claims for the claim graph.
 */

import type { MockFinding, MockClaim } from './types.js';
import type { Claim, ClaimLocation, VerificationMethod } from '@isl-lang/claims-verifier';

/**
 * Convert a mock finding to a claim
 */
export function findingToClaim(finding: MockFinding): Claim {
  const location: ClaimLocation = {
    file: finding.location.file,
    line: finding.location.line,
    column: finding.location.column,
    context: finding.location.snippet,
  };

  return {
    id: finding.id,
    text: `Mock behavior detected: ${finding.reason}`,
    value: finding.type,
    unit: 'finding',
    location,
    verificationMethod: 'manual_check',
    status: 'unverifiable',
    confidence: finding.confidence,
  };
}

/**
 * Convert multiple findings to claims
 */
export function findingsToClaims(findings: MockFinding[]): Claim[] {
  return findings.map(findingToClaim);
}

/**
 * Create a mock claim with enhanced metadata
 */
export function createMockClaim(finding: MockFinding): MockClaim {
  return {
    id: finding.id,
    text: `Mock behavior detected: ${finding.reason} at ${finding.location.file}:${finding.location.line}`,
    finding,
    confidence: finding.confidence,
    status: 'detected',
  };
}

/**
 * Convert mock claims to standard claims for integration
 */
export function mockClaimsToClaims(mockClaims: MockClaim[]): Claim[] {
  return mockClaims.map(mc => findingToClaim(mc.finding));
}
