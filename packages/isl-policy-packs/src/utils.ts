/**
 * ISL Policy Packs - Utility Functions
 * 
 * @module @isl-lang/policy-packs
 */

import type { Claim, Evidence } from '@isl-lang/firewall';
import type { RuleContext, TruthpackData } from './types.js';

/**
 * Find claims by type
 */
export function findClaimsByType(claims: Claim[], type: string): Claim[] {
  return claims.filter(c => c.type === type);
}

/**
 * Check if a claim has evidence
 */
export function hasEvidence(claim: Claim, evidence: Evidence[]): boolean {
  return evidence.some(e => e.claimId === claim.id && e.found);
}

/**
 * Get unverified claims of a specific type
 */
export function getUnverifiedClaims(
  claims: Claim[],
  evidence: Evidence[],
  type?: string
): Claim[] {
  return claims
    .filter(c => !type || c.type === type)
    .filter(c => !hasEvidence(c, evidence));
}

/**
 * Check if content matches any pattern
 */
export function matchesAnyPattern(content: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 * Check if content contains any keyword (case-insensitive)
 */
export function containsKeyword(content: string, keywords: string[]): string | null {
  const lower = content.toLowerCase();
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}

/**
 * Extract line number from content position
 */
export function getLineNumber(content: string, position: number): number {
  const upToPosition = content.slice(0, position);
  return (upToPosition.match(/\n/g) || []).length + 1;
}

/**
 * Check if route requires authentication based on truthpack
 */
export function routeRequiresAuth(
  route: string,
  method: string,
  truthpack: TruthpackData
): boolean {
  if (!truthpack.routes) return false;

  const routeDef = truthpack.routes.find(r => 
    r.path === route && r.method.toUpperCase() === method.toUpperCase()
  );

  return routeDef?.auth?.required ?? false;
}

/**
 * Check if a path is in the protected paths list
 */
export function isProtectedPath(path: string, truthpack: TruthpackData): boolean {
  if (!truthpack.auth?.protectedPaths) return false;

  return truthpack.auth.protectedPaths.some(pattern => {
    // Simple glob matching
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

/**
 * Check if a path is in the public paths list
 */
export function isPublicPath(path: string, truthpack: TruthpackData): boolean {
  if (!truthpack.auth?.publicPaths) return false;

  return truthpack.auth.publicPaths.some(pattern => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

/**
 * Check if environment variable is marked as sensitive
 */
export function isSensitiveEnv(envName: string, truthpack: TruthpackData): boolean {
  if (!truthpack.env) return false;

  const envDef = truthpack.env.find(e => e.name === envName);
  return envDef?.sensitive ?? false;
}
