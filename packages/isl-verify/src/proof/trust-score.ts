import type { PropertyProof } from './types.js';

interface PropertyTierConfig {
  tier: 1 | 2;
  provenPoints: number;
  partialPoints: number;
}

const PROPERTY_TIERS: Record<string, PropertyTierConfig> = {
  // Tier 1 properties - critical security/correctness (10 points each when proven)
  'import-integrity': { tier: 1, provenPoints: 10, partialPoints: 5 },
  'type-safety': { tier: 1, provenPoints: 10, partialPoints: 5 },
  'error-handling': { tier: 1, provenPoints: 10, partialPoints: 5 },
  'auth-coverage': { tier: 1, provenPoints: 10, partialPoints: 5 },
  'input-validation': { tier: 1, provenPoints: 10, partialPoints: 5 },
  'sql-injection': { tier: 1, provenPoints: 10, partialPoints: 5 },
  'xss-prevention': { tier: 1, provenPoints: 10, partialPoints: 5 },

  // Tier 2 properties - important but not critical (5 points each when proven)
  'secret-exposure': { tier: 2, provenPoints: 5, partialPoints: 2 },
  'dependency-security': { tier: 2, provenPoints: 5, partialPoints: 2 },
  'rate-limiting': { tier: 2, provenPoints: 5, partialPoints: 2 },
  'logging-compliance': { tier: 2, provenPoints: 5, partialPoints: 2 },
  'data-encryption': { tier: 2, provenPoints: 5, partialPoints: 2 },
  'session-security': { tier: 2, provenPoints: 5, partialPoints: 2 },
};

export function calculateTrustScore(properties: PropertyProof[]): number {
  let score = 0;

  for (const property of properties) {
    const config = PROPERTY_TIERS[property.property];
    if (!config) {
      // Unknown property type - skip
      continue;
    }

    switch (property.status) {
      case 'PROVEN':
        score += config.provenPoints;
        break;
      case 'PARTIAL':
        score += config.partialPoints;
        break;
      case 'FAILED':
      case 'NOT_VERIFIED':
        // No points awarded
        break;
    }
  }

  // Cap at 100
  return Math.min(100, score);
}

export function getTrustScoreGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function getTrustScoreVerdict(score: number): 'VERIFIED' | 'PARTIAL' | 'INSUFFICIENT' {
  if (score >= 80) return 'VERIFIED';
  if (score >= 50) return 'PARTIAL';
  return 'INSUFFICIENT';
}
