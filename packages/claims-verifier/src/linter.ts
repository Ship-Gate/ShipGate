// ============================================================================
// Claims Linter - Flags unverifiable claims in documentation/landing content
// ============================================================================

import type {
  Claim,
  LintResult,
  LintIssue,
  KnownFact,
  VerifierConfig,
} from './types.js';
import { ClaimExtractor } from './extractor.js';
import { ClaimVerifier, createDefaultFacts } from './verifier.js';
import { DEFAULT_CLAIM_PATTERNS } from './patterns.js';

export interface LinterOptions {
  /** Known facts to verify against */
  knownFacts?: KnownFact[];
  
  /** Whether to auto-soften unverifiable claims */
  autoSoften?: boolean;
  
  /** Severity for unverifiable claims */
  unverifiableSeverity?: 'error' | 'warning' | 'info';
  
  /** Severity for mismatched claims */
  mismatchSeverity?: 'error' | 'warning';
  
  /** Include hedged claims in linting */
  includeHedged?: boolean;
  
  /** Tolerance for numeric comparisons */
  tolerance?: number;
}

/**
 * Claims Linter - checks content for unverifiable numeric claims
 */
export class ClaimsLinter {
  private extractor: ClaimExtractor;
  private verifier: ClaimVerifier;
  private options: Required<LinterOptions>;
  
  constructor(options: LinterOptions = {}) {
    this.options = {
      knownFacts: options.knownFacts ?? createDefaultFacts(),
      autoSoften: options.autoSoften ?? true,
      unverifiableSeverity: options.unverifiableSeverity ?? 'warning',
      mismatchSeverity: options.mismatchSeverity ?? 'error',
      includeHedged: options.includeHedged ?? false,
      tolerance: options.tolerance ?? 0.05,
    };
    
    this.extractor = new ClaimExtractor({
      patterns: DEFAULT_CLAIM_PATTERNS,
      includeHedged: this.options.includeHedged,
    });
    
    this.verifier = new ClaimVerifier({
      knownFacts: this.options.knownFacts,
      tolerance: this.options.tolerance,
    });
  }
  
  /**
   * Add a known fact for verification
   */
  addFact(fact: KnownFact): void {
    this.verifier.addFact(fact);
  }
  
  /**
   * Lint content for unverifiable claims
   */
  lint(content: string, filePath: string): LintResult {
    // Extract all claims from content
    const claims = this.extractor.extract(content, filePath);
    
    // Verify each claim
    const results = this.verifier.verifyAll(claims);
    
    // Build issues list
    const issues: LintIssue[] = [];
    let verified = 0;
    let unverifiable = 0;
    let mismatched = 0;
    
    for (const result of results) {
      const { claim, status } = result;
      
      switch (status) {
        case 'verified':
          verified++;
          break;
          
        case 'unverifiable':
          unverifiable++;
          issues.push(this.createUnverifiableIssue(claim, result.explanation));
          break;
          
        case 'mismatch':
          mismatched++;
          issues.push(this.createMismatchIssue(claim, result.actualValue!, result.explanation));
          break;
          
        case 'outdated':
          // Not an error, but could add info-level notice
          verified++;
          break;
      }
    }
    
    return {
      file: filePath,
      claims,
      issues,
      summary: {
        total: claims.length,
        verified,
        unverifiable,
        mismatched,
      },
    };
  }
  
  /**
   * Lint multiple files
   */
  lintFiles(files: Map<string, string>): Map<string, LintResult> {
    const results = new Map<string, LintResult>();
    
    for (const [path, content] of files) {
      results.set(path, this.lint(content, path));
    }
    
    return results;
  }
  
  /**
   * Create an issue for an unverifiable claim
   */
  private createUnverifiableIssue(claim: Claim, explanation: string): LintIssue {
    const softened = this.options.autoSoften
      ? this.softenClaim(claim)
      : undefined;
    
    return {
      severity: this.options.unverifiableSeverity,
      message: `Unverifiable claim: "${claim.text}" at line ${claim.location.line}. ${explanation}`,
      claim,
      suggestion: softened
        ? `Consider softening to: "${softened}"`
        : 'Provide a verifiable source or soften the claim.',
      fixable: !!softened,
      softened,
    };
  }
  
  /**
   * Create an issue for a mismatched claim
   */
  private createMismatchIssue(
    claim: Claim,
    actualValue: string | number,
    explanation: string
  ): LintIssue {
    const corrected = claim.text.replace(
      String(claim.value),
      String(actualValue)
    );
    
    return {
      severity: this.options.mismatchSeverity,
      message: `Claim mismatch: "${claim.text}" at line ${claim.location.line}. ${explanation}`,
      claim,
      suggestion: `Update to actual value: "${corrected}"`,
      fixable: true,
      softened: corrected,
    };
  }
  
  /**
   * Soften a claim by adding hedging language
   */
  private softenClaim(claim: Claim): string {
    const { text, value, unit } = claim;
    
    // Patterns for different types of claims
    const patterns: Array<{ match: RegExp; replace: string | ((...args: string[]) => string) }> = [
      // "94%" -> "typically around 94%"
      { match: /^(\d+)%$/, replace: 'typically around $1%' },
      
      // "Trust Score 94%" -> "Trust scores can reach 94%"
      { match: /trust\s+score\s*:?\s*(\d+)%?/i, replace: 'Trust scores can reach $1%' },
      
      // "25 rules" -> "over 20 rules" (round down to nearest 5)
      { match: /^(\d+)\s+(rules?)$/i, replace: (m, n, u) => {
        const rounded = Math.floor(parseInt(n) / 5) * 5;
        return `over ${rounded} ${u}`;
      }},
      
      // "Average Trust Score 94%" -> "Trust scores typically range from 85-95%"
      { match: /average\s+(?:trust\s+)?score\s*:?\s*(\d+)%?/i, replace: (m, n) => {
        const num = parseInt(n);
        const low = Math.max(0, num - 10);
        const high = Math.min(100, num + 5);
        return `Trust scores typically range from ${low}-${high}%`;
      }},
    ];
    
    for (const { match, replace } of patterns) {
      if (match.test(text)) {
        if (typeof replace === 'function') {
          return text.replace(match, replace as (...args: string[]) => string);
        }
        return text.replace(match, replace);
      }
    }
    
    // Default softening: prepend "approximately"
    if (unit === '%' || unit === 'percent') {
      return `approximately ${value}%`;
    }
    
    return `approximately ${text}`;
  }
}

/**
 * Format lint results for display
 */
export function formatLintResults(results: LintResult[]): string {
  const lines: string[] = [];
  let totalIssues = 0;
  
  for (const result of results) {
    if (result.issues.length === 0) continue;
    
    lines.push(`\n${result.file}:`);
    
    for (const issue of result.issues) {
      totalIssues++;
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} Line ${issue.claim.location.line}: ${issue.message}`);
      
      if (issue.suggestion) {
        lines.push(`     💡 ${issue.suggestion}`);
      }
    }
  }
  
  if (totalIssues === 0) {
    return '✅ No unverifiable claims found.';
  }
  
  lines.unshift(`Found ${totalIssues} issue(s):`);
  return lines.join('\n');
}
