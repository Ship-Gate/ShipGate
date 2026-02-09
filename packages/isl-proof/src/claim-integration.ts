/**
 * Claim Graph Integration
 * 
 * Integration helpers to collect claims from multiple engines and build
 * a unified claim graph for use in proof bundles.
 * 
 * @module @isl-lang/proof/claim-integration
 */

import type { ClaimGraph, UnifiedClaim } from './claim-graph.js';
import { ClaimGraphBuilder } from './claim-graph.js';
import {
  fromBundleClaim,
  fromVerifierClauseResult,
  fromFirewallClaim,
  createRouteClaim,
  createEnvClaim,
} from './claim-adapters.js';
import type { BundleClaim } from './bundle-hash.js';

/**
 * ClauseResult from verifier - minimal interface for integration
 */
export interface ClauseResultInput {
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
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Collect claims from multiple sources and build unified graph
 */
export interface ClaimCollection {
  /** Proof bundle claims */
  bundleClaims?: BundleClaim[];
  /** Verifier clause results */
  verifierClauses?: ClauseResultInput[];
  /** Firewall claims */
  firewallClaims?: Array<{
    claim: {
      id: string;
      type: string;
      value: string;
      location: { line: number; column: number; length: number };
      confidence: number;
    };
    filePath: string;
  }>;
  /** Route claims (from truthpack) */
  routes?: Array<{
    route: string;
    method: string;
    locations: Array<{ file: string; line: number; column?: number }>;
  }>;
  /** Environment variable claims */
  envVars?: Array<{
    name: string;
    locations: Array<{ file: string; line: number; column?: number }>;
  }>;
  /** Custom claims */
  customClaims?: UnifiedClaim[];
}

/**
 * Build unified claim graph from multiple engine outputs
 */
export function buildUnifiedClaimGraph(
  collection: ClaimCollection,
  options?: {
    deduplicate?: boolean;
    minConfidence?: number;
    linkRelated?: boolean;
  }
): ClaimGraph {
  const builder = new ClaimGraphBuilder({
    deduplicate: options?.deduplicate ?? true,
    minConfidence: options?.minConfidence ?? 0,
    linkRelated: options?.linkRelated ?? true,
  });

  // Collect claims from proof bundle
  if (collection.bundleClaims) {
    for (const claim of collection.bundleClaims) {
      builder.addClaim(fromBundleClaim(claim, 'proof-bundle'));
    }
  }

  // Collect claims from verifier
  if (collection.verifierClauses) {
    for (const clause of collection.verifierClauses) {
      builder.addClaim(
        fromVerifierClauseResult(
          {
            clauseId: clause.clauseId,
            clauseType: clause.clauseType,
            expression: clause.expression,
            status: clause.status,
            confidence: clause.confidence,
            evidence: clause.evidence.map(ev => ({
              file: ev.file,
              line: ev.line,
              column: ev.column,
              kind: ev.kind,
            })),
          },
          'verifier'
        )
      );
    }
  }

  // Collect claims from firewall
  if (collection.firewallClaims) {
    for (const { claim, filePath } of collection.firewallClaims) {
      builder.addClaim(fromFirewallClaim(claim, filePath, 'firewall'));
    }
  }

  // Collect route claims
  if (collection.routes) {
    for (const route of collection.routes) {
      builder.addClaim(
        createRouteClaim(route.route, route.method, route.locations, 'truthpack')
      );
    }
  }

  // Collect environment variable claims
  if (collection.envVars) {
    for (const env of collection.envVars) {
      builder.addClaim(
        createEnvClaim(env.name, env.locations, 'truthpack')
      );
    }
  }

  // Add custom claims
  if (collection.customClaims) {
    builder.addClaims(collection.customClaims);
  }

  return builder.build();
}

/**
 * Extract claims from proof bundle for integration
 */
export function extractClaimsFromProofBundle(
  bundle: {
    claims?: BundleClaim[];
  }
): ClaimCollection {
  return {
    bundleClaims: bundle.claims || [],
  };
}

/**
 * Extract claims from verifier report for integration
 */
export function extractClaimsFromVerifierReport(
  report: {
    clauseResults?: ClauseResultInput[];
  }
): ClaimCollection {
  return {
    verifierClauses: report.clauseResults || [],
  };
}

/**
 * Merge multiple claim collections
 */
export function mergeClaimCollections(
  ...collections: ClaimCollection[]
): ClaimCollection {
  const merged: ClaimCollection = {};

  for (const collection of collections) {
    if (collection.bundleClaims) {
      merged.bundleClaims = [
        ...(merged.bundleClaims || []),
        ...collection.bundleClaims,
      ];
    }

    if (collection.verifierClauses) {
      merged.verifierClauses = [
        ...(merged.verifierClauses || []),
        ...collection.verifierClauses,
      ];
    }

    if (collection.firewallClaims) {
      merged.firewallClaims = [
        ...(merged.firewallClaims || []),
        ...collection.firewallClaims,
      ];
    }

    if (collection.routes) {
      merged.routes = [
        ...(merged.routes || []),
        ...collection.routes,
      ];
    }

    if (collection.envVars) {
      merged.envVars = [
        ...(merged.envVars || []),
        ...collection.envVars,
      ];
    }

    if (collection.customClaims) {
      merged.customClaims = [
        ...(merged.customClaims || []),
        ...collection.customClaims,
      ];
    }
  }

  return merged;
}
