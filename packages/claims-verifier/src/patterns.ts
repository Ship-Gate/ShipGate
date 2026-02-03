// ============================================================================
// Claim Detection Patterns
// ============================================================================

import type { ClaimPattern } from './types.js';

/**
 * Default patterns for detecting numeric claims in text.
 * These patterns identify statements that make quantitative assertions.
 */
export const DEFAULT_CLAIM_PATTERNS: ClaimPattern[] = [
  // Percentage claims: "94%", "up to 95%", "over 90%"
  {
    name: 'percentage',
    pattern: /(?:up to |over |approximately |about |around |~)?(\d+(?:\.\d+)?)\s*(%|percent)/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
  
  // Count claims: "25 rules", "100+ features", "over 50 tests"
  {
    name: 'count',
    pattern: /(?:over |more than |up to |approximately |about |around )?(\d+)(?:\+)?\s+(rules?|features?|tests?|users?|customers?|downloads?|integrations?|languages?|frameworks?)/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
  
  // Time claims: "in 5 minutes", "under 100ms", "2x faster"
  {
    name: 'time',
    pattern: /(?:in |under |within |about )?(\d+(?:\.\d+)?)\s*(minutes?|seconds?|ms|milliseconds?|hours?|days?)/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
  
  // Multiplier claims: "2x faster", "10x improvement"
  {
    name: 'multiplier',
    pattern: /(\d+(?:\.\d+)?)\s*[xX]\s*(faster|slower|better|improvement|more|increase|reduction)/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
  
  // Money claims: "$29/user", "costs $100"
  {
    name: 'money',
    pattern: /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/\s*(\w+))?/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
  
  // Trust score specific: "trust score of 95", "score: 87"
  {
    name: 'trust_score',
    pattern: /(?:trust\s+)?score(?:\s+of)?\s*:?\s*(\d+(?:\.\d+)?)\s*(%)?/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
  
  // Version claims: "v1.0", "version 2.5"
  {
    name: 'version',
    pattern: /(?:v|version\s*)(\d+(?:\.\d+)*)/gi,
    valueGroup: 1,
    requiresVerification: false, // Versions don't need fact-checking
  },
  
  // Range claims: "95-99%", "10-20 rules"
  {
    name: 'range',
    pattern: /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(%|rules?|features?|tests?)?/gi,
    valueGroup: 1, // Lower bound
    unitGroup: 3,
    requiresVerification: true,
  },
  
  // Average/mean claims: "average of 94", "mean score 87"
  {
    name: 'average',
    pattern: /(?:average|mean|median)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(%)?/gi,
    valueGroup: 1,
    unitGroup: 2,
    requiresVerification: true,
  },
];

/**
 * Patterns that indicate a claim is likely hedged/soft already
 */
export const HEDGE_PATTERNS: RegExp[] = [
  /approximately/i,
  /about/i,
  /around/i,
  /roughly/i,
  /typically/i,
  /generally/i,
  /often/i,
  /usually/i,
  /can be/i,
  /may be/i,
  /might/i,
  /up to/i,
  /as much as/i,
  /varies/i,
  /depending on/i,
];

/**
 * Check if a claim text already contains hedging language
 */
export function isHedged(text: string): boolean {
  return HEDGE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Phrases that indicate the claim is from a specific context
 */
export const CONTEXTUAL_MARKERS: RegExp[] = [
  /in this example/i,
  /in our tests/i,
  /for this demo/i,
  /sample/i,
  /example/i,
  /placeholder/i,
  /demo/i,
];

/**
 * Check if a claim appears to be contextual/example-specific
 */
export function isContextual(text: string): boolean {
  return CONTEXTUAL_MARKERS.some(pattern => pattern.test(text));
}
