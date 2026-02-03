// ============================================================================
// Utility Functions
// ============================================================================

import { createHash } from 'crypto';

/**
 * Generate a unique ID for a claim based on its location and content
 */
export function generateClaimId(
  filePath: string,
  lineNumber: number,
  text: string
): string {
  const input = `${filePath}:${lineNumber}:${text}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/**
 * Normalize a file path for consistent comparison
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase();
}

/**
 * Extract numeric value from a string
 */
export function extractNumber(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ''));
}

/**
 * Format a number for display
 */
export function formatNumber(value: number, unit?: string): string {
  if (unit === '%' || unit === 'percent') {
    return `${value}%`;
  }
  return unit ? `${value} ${unit}` : String(value);
}

/**
 * Calculate similarity between two strings (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  if (aLower === bLower) return 1;
  
  // Simple Jaccard similarity on words
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));
  
  const intersection = new Set([...aWords].filter(x => bWords.has(x)));
  const union = new Set([...aWords, ...bWords]);
  
  return intersection.size / union.size;
}

/**
 * Check if a value matches within a tolerance
 */
export function valuesMatch(
  claimed: number | string,
  actual: number | string,
  tolerance: number = 0.05
): boolean {
  const claimedNum = typeof claimed === 'number' ? claimed : parseFloat(String(claimed));
  const actualNum = typeof actual === 'number' ? actual : parseFloat(String(actual));
  
  if (isNaN(claimedNum) || isNaN(actualNum)) {
    return String(claimed).toLowerCase() === String(actual).toLowerCase();
  }
  
  if (actualNum === 0) return claimedNum === 0;
  
  const diff = Math.abs(claimedNum - actualNum) / actualNum;
  return diff <= tolerance;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  
  // Simple pluralization rules
  if (word.endsWith('y')) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }
  return word + 's';
}
