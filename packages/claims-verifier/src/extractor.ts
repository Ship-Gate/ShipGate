// ============================================================================
// Claim Extractor - Finds numeric claims in text content
// ============================================================================

import type { Claim, ClaimLocation, ClaimPattern, VerificationMethod } from './types.js';
import { DEFAULT_CLAIM_PATTERNS, isHedged, isContextual } from './patterns.js';
import { generateClaimId } from './utils.js';

export interface ExtractorOptions {
  /** Custom patterns to use (defaults to DEFAULT_CLAIM_PATTERNS) */
  patterns?: ClaimPattern[];
  
  /** Include hedged claims */
  includeHedged?: boolean;
  
  /** Include contextual/example claims */
  includeContextual?: boolean;
}

/**
 * Extract claims from a single line of text
 */
export function extractClaimsFromLine(
  line: string,
  lineNumber: number,
  filePath: string,
  options: ExtractorOptions = {}
): Claim[] {
  const {
    patterns = DEFAULT_CLAIM_PATTERNS,
    includeHedged = false,
    includeContextual = false,
  } = options;

  const claims: Claim[] = [];

  for (const pattern of patterns) {
    if (!pattern.requiresVerification) continue;

    // Reset regex state
    pattern.pattern.lastIndex = 0;
    
    let match: RegExpExecArray | null;
    while ((match = pattern.pattern.exec(line)) !== null) {
      const fullMatch = match[0];
      const value = match[pattern.valueGroup];
      const unit = pattern.unitGroup ? match[pattern.unitGroup] : undefined;
      
      // Get context around the match
      const contextStart = Math.max(0, match.index - 30);
      const contextEnd = Math.min(line.length, match.index + fullMatch.length + 30);
      const context = line.slice(contextStart, contextEnd);
      
      // Skip if hedged and not including hedged
      if (!includeHedged && isHedged(context)) continue;
      
      // Skip if contextual and not including contextual
      if (!includeContextual && isContextual(context)) continue;
      
      const location: ClaimLocation = {
        file: filePath,
        line: lineNumber,
        column: match.index + 1,
        context: context.trim(),
      };
      
      const claim: Claim = {
        id: generateClaimId(filePath, lineNumber, fullMatch),
        text: fullMatch,
        value: parseValue(value),
        unit: unit?.toLowerCase(),
        location,
        verificationMethod: inferVerificationMethod(pattern.name, unit),
        status: 'unverifiable', // Default until verified
        confidence: 0,
      };
      
      claims.push(claim);
    }
  }

  return claims;
}

/**
 * Extract all claims from a file's content
 */
export function extractClaimsFromContent(
  content: string,
  filePath: string,
  options: ExtractorOptions = {}
): Claim[] {
  const lines = content.split('\n');
  const allClaims: Claim[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const lineClaims = extractClaimsFromLine(
      lines[i],
      i + 1, // 1-indexed line numbers
      filePath,
      options
    );
    allClaims.push(...lineClaims);
  }
  
  // Deduplicate claims at the same location
  return deduplicateClaims(allClaims);
}

/**
 * Parse a string value to number if possible
 */
function parseValue(value: string): string | number {
  const cleaned = value.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? value : num;
}

/**
 * Infer verification method based on claim pattern
 */
function inferVerificationMethod(patternName: string, unit?: string): VerificationMethod {
  switch (patternName) {
    case 'count':
      if (unit?.includes('rule')) return 'count_files';
      if (unit?.includes('test')) return 'count_files';
      return 'manual_check';
      
    case 'percentage':
    case 'trust_score':
    case 'average':
      return 'command_output';
      
    case 'money':
      return 'json_field';
      
    case 'time':
    case 'multiplier':
      return 'command_output';
      
    default:
      return 'manual_check';
  }
}

/**
 * Remove duplicate claims at the same location
 */
function deduplicateClaims(claims: Claim[]): Claim[] {
  const seen = new Set<string>();
  return claims.filter(claim => {
    const key = `${claim.location.file}:${claim.location.line}:${claim.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * ClaimExtractor class for stateful extraction with configuration
 */
export class ClaimExtractor {
  private options: ExtractorOptions;
  
  constructor(options: ExtractorOptions = {}) {
    this.options = options;
  }
  
  /**
   * Extract claims from content
   */
  extract(content: string, filePath: string): Claim[] {
    return extractClaimsFromContent(content, filePath, this.options);
  }
  
  /**
   * Extract claims from multiple files
   */
  extractFromFiles(files: Map<string, string>): Map<string, Claim[]> {
    const results = new Map<string, Claim[]>();
    
    for (const [path, content] of files) {
      results.set(path, this.extract(content, path));
    }
    
    return results;
  }
}
