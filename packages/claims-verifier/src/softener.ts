// ============================================================================
// Auto-Softener - Rewrites unverifiable claims with hedging language
// ============================================================================

import type { Claim, LintResult, LintIssue } from './types.js';

export interface SoftenOptions {
  /** Only soften claims below this confidence threshold */
  confidenceThreshold?: number;
  
  /** Preserve original as comment */
  preserveOriginal?: boolean;
  
  /** Style of softening */
  style?: 'conservative' | 'moderate' | 'aggressive';
}

export interface SoftenResult {
  /** Original content */
  original: string;
  
  /** Softened content */
  softened: string;
  
  /** Number of claims softened */
  claimsSoftened: number;
  
  /** Details of each softening */
  changes: SoftenChange[];
}

export interface SoftenChange {
  /** Line number */
  line: number;
  
  /** Original text */
  originalText: string;
  
  /** Softened text */
  softenedText: string;
  
  /** Reason for softening */
  reason: string;
}

/**
 * Softening templates for different claim types
 */
const SOFTENING_TEMPLATES: Record<string, SoftenTemplate[]> = {
  percentage: [
    { pattern: /^(\d+)%$/, soft: 'approximately $1%', style: 'conservative' },
    { pattern: /^(\d+)%$/, soft: 'around $1%', style: 'moderate' },
    { pattern: /^(\d+)%$/, soft: 'up to $1%', style: 'aggressive' },
  ],
  
  count: [
    { pattern: /^(\d+)\s+(rules?|features?)$/i, soft: 'over $1 $2', style: 'conservative' },
    { pattern: /^(\d+)\s+(rules?|features?)$/i, soft: '$1+ $2', style: 'moderate' },
    { pattern: /^(\d+)\s+(rules?|features?)$/i, soft: 'dozens of $2', style: 'aggressive' },
  ],
  
  trust_score: [
    { pattern: /trust\s+score\s*:?\s*(\d+)%?/i, soft: 'trust scores typically around $1%', style: 'conservative' },
    { pattern: /trust\s+score\s*:?\s*(\d+)%?/i, soft: 'trust scores can reach $1%', style: 'moderate' },
    { pattern: /trust\s+score\s*:?\s*(\d+)%?/i, soft: 'high trust scores', style: 'aggressive' },
  ],
  
  average: [
    { pattern: /average\s+(?:of\s+)?(\d+)%?/i, soft: 'averages around $1%', style: 'conservative' },
    { pattern: /average\s+(?:of\s+)?(\d+)%?/i, soft: 'typically $1%', style: 'moderate' },
    { pattern: /average\s+(?:of\s+)?(\d+)%?/i, soft: 'strong performance', style: 'aggressive' },
  ],
  
  time: [
    { pattern: /(\d+)\s*(ms|milliseconds?)/i, soft: 'under $1$2', style: 'conservative' },
    { pattern: /(\d+)\s*(seconds?|minutes?)/i, soft: 'in about $1 $2', style: 'moderate' },
  ],
  
  multiplier: [
    { pattern: /(\d+)x\s+(faster|better)/i, soft: 'up to $1x $2', style: 'conservative' },
    { pattern: /(\d+)x\s+(faster|better)/i, soft: 'significantly $2', style: 'aggressive' },
  ],
};

interface SoftenTemplate {
  pattern: RegExp;
  soft: string;
  style: 'conservative' | 'moderate' | 'aggressive';
}

/**
 * AutoSoftener class for rewriting unverifiable claims
 */
export class AutoSoftener {
  private options: Required<SoftenOptions>;
  
  constructor(options: SoftenOptions = {}) {
    this.options = {
      confidenceThreshold: options.confidenceThreshold ?? 0.5,
      preserveOriginal: options.preserveOriginal ?? false,
      style: options.style ?? 'moderate',
    };
  }
  
  /**
   * Soften unverifiable claims in content based on lint results
   */
  soften(content: string, lintResult: LintResult): SoftenResult {
    const changes: SoftenChange[] = [];
    let softened = content;
    let claimsSoftened = 0;
    
    // Process issues in reverse order to preserve line numbers
    const sortedIssues = [...lintResult.issues]
      .filter(issue => issue.fixable && issue.softened)
      .sort((a, b) => b.claim.location.line - a.claim.location.line);
    
    for (const issue of sortedIssues) {
      const { claim } = issue;
      
      // Skip if claim has high confidence
      if (claim.confidence >= this.options.confidenceThreshold) {
        continue;
      }
      
      // Use pre-computed softened version or generate one
      const softenedText = issue.softened ?? this.softenClaim(claim);
      
      if (softenedText && softenedText !== claim.text) {
        softened = this.replaceInContent(softened, claim, softenedText);
        claimsSoftened++;
        
        changes.push({
          line: claim.location.line,
          originalText: claim.text,
          softenedText,
          reason: issue.message,
        });
      }
    }
    
    return {
      original: content,
      softened,
      claimsSoftened,
      changes,
    };
  }
  
  /**
   * Soften a single claim
   */
  softenClaim(claim: Claim): string {
    const { text, unit } = claim;
    
    // Determine claim type — text-based checks first (more specific),
    // then unit-based checks (more general)
    let claimType = 'percentage';
    if (text.toLowerCase().includes('trust score')) {
      claimType = 'trust_score';
    } else if (text.toLowerCase().includes('average')) {
      claimType = 'average';
    } else if (text.match(/\dx/i)) {
      claimType = 'multiplier';
    } else if (unit === '%' || unit === 'percent') {
      claimType = 'percentage';
    } else if (unit?.match(/rules?|features?|tests?/i)) {
      claimType = 'count';
    } else if (unit?.match(/ms|seconds?|minutes?/i)) {
      claimType = 'time';
    }
    
    // Find matching template
    const templates = SOFTENING_TEMPLATES[claimType] ?? [];
    const template = templates.find(t => 
      t.style === this.options.style && t.pattern.test(text)
    ) ?? templates.find(t => t.pattern.test(text));
    
    if (template) {
      return text.replace(template.pattern, template.soft);
    }
    
    // Default: prepend "approximately"
    return `approximately ${text}`;
  }
  
  /**
   * Replace a claim in content
   */
  private replaceInContent(content: string, claim: Claim, replacement: string): string {
    const lines = content.split('\n');
    const lineIndex = claim.location.line - 1;
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      lines[lineIndex] = line.replace(claim.text, replacement);
      
      // Optionally add comment with original
      if (this.options.preserveOriginal) {
        const ext = claim.location.file.split('.').pop();
        const comment = this.getCommentSyntax(ext);
        if (comment) {
          lines[lineIndex] += ` ${comment} Original: ${claim.text}`;
        }
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get comment syntax for file extension
   */
  private getCommentSyntax(ext?: string): string {
    switch (ext) {
      case 'md':
        return '<!--';
      case 'tsx':
      case 'ts':
      case 'js':
      case 'jsx':
        return '//';
      case 'html':
        return '<!--';
      default:
        return '//';
    }
  }
}

/**
 * Quick function to soften content
 */
export function softenContent(
  content: string,
  lintResult: LintResult,
  options?: SoftenOptions
): SoftenResult {
  const softener = new AutoSoftener(options);
  return softener.soften(content, lintResult);
}
