// ============================================================================
// Claim Verifier - Verifies claims against known facts and sources
// ============================================================================

import type {
  Claim,
  KnownFact,
  ClaimSource,
  VerificationStatus,
} from './types.js';
import { valuesMatch, stringSimilarity } from './utils.js';

export interface VerifierOptions {
  /** Known facts to verify against */
  knownFacts: KnownFact[];
  
  /** Tolerance for numeric comparisons (default: 5%) */
  tolerance?: number;
  
  /** Minimum similarity score to match a fact (default: 0.6) */
  minSimilarity?: number;
}

export interface VerificationResult {
  /** The claim that was verified */
  claim: Claim;
  
  /** Whether verification succeeded */
  verified: boolean;
  
  /** The matched fact (if any) */
  matchedFact?: KnownFact;
  
  /** Actual value from source */
  actualValue?: string | number;
  
  /** Updated verification status */
  status: VerificationStatus;
  
  /** Confidence in the verification (0-1) */
  confidence: number;
  
  /** Explanation of the result */
  explanation: string;
}

/**
 * Verifier class for checking claims against known facts
 */
export class ClaimVerifier {
  private facts: Map<string, KnownFact>;
  private tolerance: number;
  private minSimilarity: number;
  
  constructor(options: VerifierOptions) {
    this.facts = new Map();
    this.tolerance = options.tolerance ?? 0.05;
    this.minSimilarity = options.minSimilarity ?? 0.3;
    
    for (const fact of options.knownFacts) {
      this.facts.set(fact.id, fact);
    }
  }
  
  /**
   * Add a known fact
   */
  addFact(fact: KnownFact): void {
    this.facts.set(fact.id, fact);
  }
  
  /**
   * Remove a known fact
   */
  removeFact(id: string): void {
    this.facts.delete(id);
  }
  
  /**
   * Get all known facts
   */
  getFacts(): KnownFact[] {
    return Array.from(this.facts.values());
  }
  
  /**
   * Verify a single claim
   */
  verify(claim: Claim): VerificationResult {
    // First, check if claim already has a source
    if (claim.source) {
      return this.verifyWithSource(claim);
    }
    
    // Try to find a matching fact
    const match = this.findMatchingFact(claim);
    
    if (!match) {
      return {
        claim,
        verified: false,
        status: 'unverifiable',
        confidence: 0,
        explanation: `No known fact matches claim "${claim.text}". The value ${claim.value}${claim.unit ? ` ${claim.unit}` : ''} cannot be verified.`,
      };
    }
    
    // Check if values match
    const { fact, similarity } = match;
    const matches = valuesMatch(claim.value, fact.value, this.tolerance);
    
    if (matches) {
      return {
        claim: {
          ...claim,
          source: fact.source,
          status: 'verified',
          actualValue: fact.value,
          confidence: similarity,
        },
        verified: true,
        matchedFact: fact,
        actualValue: fact.value,
        status: 'verified',
        confidence: similarity,
        explanation: `Claim verified against "${fact.description}". Value ${claim.value} matches ${fact.value}.`,
      };
    } else {
      return {
        claim: {
          ...claim,
          source: fact.source,
          status: 'mismatch',
          actualValue: fact.value,
          confidence: similarity * 0.5, // Lower confidence for mismatch
        },
        verified: false,
        matchedFact: fact,
        actualValue: fact.value,
        status: 'mismatch',
        confidence: similarity * 0.5,
        explanation: `Claim mismatch: "${claim.text}" claims ${claim.value} but actual value is ${fact.value}.`,
      };
    }
  }
  
  /**
   * Verify multiple claims
   */
  verifyAll(claims: Claim[]): VerificationResult[] {
    return claims.map(claim => this.verify(claim));
  }
  
  /**
   * Verify a claim that already has a source
   */
  private verifyWithSource(claim: Claim): VerificationResult {
    // For now, trust claims with sources but mark as needing refresh
    return {
      claim: {
        ...claim,
        status: 'outdated',
        confidence: 0.7,
      },
      verified: true,
      status: 'outdated',
      confidence: 0.7,
      explanation: `Claim has source "${claim.source?.type}" but may need refresh.`,
    };
  }
  
  /**
   * Find a fact that matches the claim
   */
  private findMatchingFact(claim: Claim): { fact: KnownFact; similarity: number } | null {
    let bestMatch: { fact: KnownFact; similarity: number } | null = null;
    
    for (const fact of this.facts.values()) {
      // Check unit match first
      if (claim.unit && fact.unit && claim.unit !== fact.unit) {
        continue;
      }
      
      // Calculate similarity based on context
      const contextSimilarity = claim.location.context
        ? stringSimilarity(claim.location.context, fact.description)
        : 0;
      
      // Unit match bonus (strong signal when units align)
      const unitBonus = (claim.unit && claim.unit === fact.unit) ? 0.3 : 0;
      
      // Value proximity bonus (helps pick the right fact among candidates)
      const valueBonus = valuesMatch(claim.value, fact.value, this.tolerance) ? 0.2 : 0;
      
      // Matching score: context relevance + unit match + value proximity
      // Value is a bonus, not required — enables mismatch detection
      const similarity = contextSimilarity * 0.5 + unitBonus + valueBonus;
      
      if (similarity >= this.minSimilarity) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { fact, similarity };
        }
      }
    }
    
    return bestMatch;
  }
}

/**
 * Create default known facts from common ISL metrics
 */
export function createDefaultFacts(): KnownFact[] {
  return [
    {
      id: 'builtin-rules-count',
      description: 'Number of built-in rules in ShipGate',
      value: 25,
      unit: 'rules',
      source: {
        type: 'repo_metadata',
        filePath: 'packages/isl-policy-packs/src/packs/',
        description: 'Count of rule files in policy packs',
      },
      refreshMethod: {
        type: 'file_count',
        spec: 'packages/isl-policy-packs/src/packs/**/*.ts',
      },
    },
    {
      id: 'team-price',
      description: 'Team tier price per user per month',
      value: 29,
      unit: 'dollars',
      source: {
        type: 'repo_metadata',
        filePath: 'docs/PRICING.md',
        jsonPath: undefined,
        description: 'Pricing documentation',
      },
    },
    {
      id: 'max-team-users',
      description: 'Maximum users on Team tier',
      value: 50,
      unit: 'users',
      source: {
        type: 'repo_metadata',
        filePath: 'docs/PRICING.md',
        description: 'Pricing documentation',
      },
    },
  ];
}
