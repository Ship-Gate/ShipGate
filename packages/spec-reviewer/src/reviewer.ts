/**
 * Spec Reviewer
 * 
 * Main review logic that coordinates analyzers and generates results.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import { analyzeCompleteness } from './analyzers/completeness.js';
import { analyzeConsistency } from './analyzers/consistency.js';
import { analyzeSecurity } from './analyzers/security.js';
import { analyzePerformance } from './analyzers/performance.js';
import { analyzeNaming } from './analyzers/naming.js';
import { analyzeBestPractices } from './analyzers/best-practices.js';
import { generateSuggestions, type Suggestion as GeneratedSuggestion } from './suggestions/generator.js';
import { AIClient, type AIClientConfig, type AIReviewResult } from './ai/client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewOptions {
  /**
   * Categories to include in review (default: all)
   */
  categories?: ReviewCategory[];

  /**
   * Whether to include AI-powered analysis
   */
  useAI?: boolean;

  /**
   * AI client configuration (required if useAI is true)
   */
  aiConfig?: AIClientConfig;

  /**
   * Minimum severity to include
   */
  minSeverity?: 'critical' | 'warning' | 'info';

  /**
   * Maximum number of issues per category
   */
  maxIssuesPerCategory?: number;

  /**
   * Whether to generate suggestions
   */
  includeSuggestions?: boolean;

  /**
   * Minimum confidence for suggestions
   */
  minSuggestionConfidence?: number;
}

export type ReviewCategory = 
  | 'completeness'
  | 'consistency'
  | 'security'
  | 'performance'
  | 'naming'
  | 'bestPractices';

export interface ReviewResult {
  /**
   * Summary statistics
   */
  summary: {
    score: number;
    issues: number;
    suggestions: number;
    criticalIssues: number;
  };

  /**
   * Results by category
   */
  categories: {
    completeness: CategoryResult;
    consistency: CategoryResult;
    security: CategoryResult;
    performance: CategoryResult;
    naming: CategoryResult;
    bestPractices: CategoryResult;
  };

  /**
   * All issues found
   */
  issues: Issue[];

  /**
   * All suggestions generated
   */
  suggestions: Suggestion[];

  /**
   * AI analysis results (if enabled)
   */
  aiAnalysis?: AIReviewResult;

  /**
   * Metadata about the review
   */
  metadata: {
    reviewedAt: string;
    duration: number;
    categoriesAnalyzed: ReviewCategory[];
    aiEnabled: boolean;
  };
}

export interface CategoryResult {
  score: number;
  issues: number;
  suggestions: number;
}

export interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  location?: SourceLocation;
  fix?: string;
  cwe?: string;
}

export interface Suggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  location?: SourceLocation;
  suggestedCode?: string;
  confidence: number;
  priority?: 'high' | 'medium' | 'low';
}

export interface SourceLocation {
  line: number;
  column: number;
}

// ============================================================================
// REVIEWER CLASS
// ============================================================================

export class SpecReviewer {
  private options: Required<ReviewOptions>;
  private aiClient?: AIClient;

  constructor(options: ReviewOptions = {}) {
    this.options = {
      categories: options.categories ?? [
        'completeness',
        'consistency',
        'security',
        'performance',
        'naming',
        'bestPractices',
      ],
      useAI: options.useAI ?? false,
      aiConfig: options.aiConfig ?? { provider: 'mock' },
      minSeverity: options.minSeverity ?? 'info',
      maxIssuesPerCategory: options.maxIssuesPerCategory ?? 50,
      includeSuggestions: options.includeSuggestions ?? true,
      minSuggestionConfidence: options.minSuggestionConfidence ?? 0.5,
    };

    if (this.options.useAI && this.options.aiConfig) {
      this.aiClient = new AIClient(this.options.aiConfig);
    }
  }

  /**
   * Review a domain specification
   */
  async review(domain: DomainDeclaration): Promise<ReviewResult> {
    const startTime = Date.now();

    // Initialize results
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    const categoryResults: ReviewResult['categories'] = {
      completeness: { score: 100, issues: 0, suggestions: 0 },
      consistency: { score: 100, issues: 0, suggestions: 0 },
      security: { score: 100, issues: 0, suggestions: 0 },
      performance: { score: 100, issues: 0, suggestions: 0 },
      naming: { score: 100, issues: 0, suggestions: 0 },
      bestPractices: { score: 100, issues: 0, suggestions: 0 },
    };

    // Run analyzers
    if (this.options.categories.includes('completeness')) {
      const result = analyzeCompleteness(domain);
      categoryResults.completeness = this.processCategoryResult(result, 'completeness', issues);
    }

    if (this.options.categories.includes('consistency')) {
      const result = analyzeConsistency(domain);
      categoryResults.consistency = this.processCategoryResult(result, 'consistency', issues);
    }

    if (this.options.categories.includes('security')) {
      const result = analyzeSecurity(domain);
      categoryResults.security = this.processCategoryResult(result, 'security', issues);
    }

    if (this.options.categories.includes('performance')) {
      const result = analyzePerformance(domain);
      categoryResults.performance = this.processCategoryResult(result, 'performance', issues);
    }

    if (this.options.categories.includes('naming')) {
      const result = analyzeNaming(domain);
      categoryResults.naming = this.processCategoryResult(result, 'naming', issues);
    }

    if (this.options.categories.includes('bestPractices')) {
      const result = analyzeBestPractices(domain);
      categoryResults.bestPractices = this.processCategoryResult(result, 'bestPractices', issues);
    }

    // Generate suggestions
    if (this.options.includeSuggestions) {
      const generated = generateSuggestions(domain, {
        minConfidence: this.options.minSuggestionConfidence,
      });
      suggestions.push(...this.convertSuggestions(generated));
    }

    // Run AI analysis if enabled
    let aiAnalysis: AIReviewResult | undefined;
    if (this.options.useAI && this.aiClient) {
      const specText = this.domainToText(domain);
      const aiResponse = await this.aiClient.review({
        spec: specText,
        promptId: 'comprehensive-review',
      });
      if (aiResponse.success && aiResponse.parsed) {
        aiAnalysis = aiResponse.parsed;
        
        // Merge AI issues
        if (aiAnalysis.criticalIssues) {
          for (const aiIssue of aiAnalysis.criticalIssues) {
            issues.push({
              id: `ai-${aiIssue.title.toLowerCase().replace(/\s+/g, '-')}`,
              severity: 'critical',
              category: 'ai-review',
              title: aiIssue.title,
              description: aiIssue.description,
              fix: aiIssue.fix,
            });
          }
        }
        
        if (aiAnalysis.warnings) {
          for (const aiWarning of aiAnalysis.warnings) {
            issues.push({
              id: `ai-${aiWarning.title.toLowerCase().replace(/\s+/g, '-')}`,
              severity: 'warning',
              category: 'ai-review',
              title: aiWarning.title,
              description: aiWarning.description,
              fix: aiWarning.fix,
            });
          }
        }
        
        if (aiAnalysis.suggestions) {
          for (const aiSuggestion of aiAnalysis.suggestions) {
            suggestions.push({
              id: `ai-${aiSuggestion.title.toLowerCase().replace(/\s+/g, '-')}`,
              category: 'ai-review',
              title: aiSuggestion.title,
              description: aiSuggestion.description,
              suggestedCode: aiSuggestion.suggestedCode,
              confidence: 0.8,
              priority: (aiSuggestion.priority as 'high' | 'medium' | 'low') ?? 'medium',
            });
          }
        }
      }
    }

    // Filter by severity
    const filteredIssues = this.filterBySeverity(issues);

    // Calculate overall score
    const categoryScores = Object.values(categoryResults).map(c => c.score);
    const overallScore = Math.round(
      categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length
    );

    // Count critical issues
    const criticalCount = filteredIssues.filter(i => i.severity === 'critical').length;

    return {
      summary: {
        score: overallScore,
        issues: filteredIssues.length,
        suggestions: suggestions.length,
        criticalIssues: criticalCount,
      },
      categories: categoryResults,
      issues: filteredIssues,
      suggestions,
      aiAnalysis,
      metadata: {
        reviewedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        categoriesAnalyzed: this.options.categories,
        aiEnabled: this.options.useAI,
      },
    };
  }

  /**
   * Process category result and add issues
   */
  private processCategoryResult(
    result: { score: number; issues: Array<{ id: string; severity: string; title: string; description: string; location?: { line: number; column: number }; fix?: string; cwe?: string }> },
    category: string,
    allIssues: Issue[]
  ): CategoryResult {
    const categoryIssues = result.issues
      .slice(0, this.options.maxIssuesPerCategory)
      .map(issue => ({
        ...issue,
        severity: issue.severity as 'critical' | 'warning' | 'info',
        category,
      }));

    allIssues.push(...categoryIssues);

    return {
      score: result.score,
      issues: result.issues.length,
      suggestions: 0,
    };
  }

  /**
   * Convert generated suggestions to output format
   */
  private convertSuggestions(generated: GeneratedSuggestion[]): Suggestion[] {
    return generated.map(s => ({
      id: s.id,
      category: s.category,
      title: s.title,
      description: s.description,
      location: s.location,
      suggestedCode: s.suggestedCode,
      confidence: s.confidence,
      priority: s.priority,
    }));
  }

  /**
   * Filter issues by minimum severity
   */
  private filterBySeverity(issues: Issue[]): Issue[] {
    const severityOrder: Record<string, number> = {
      'critical': 3,
      'warning': 2,
      'info': 1,
    };

    const minLevel = severityOrder[this.options.minSeverity] ?? 1;
    return issues.filter(i => (severityOrder[i.severity] ?? 0) >= minLevel);
  }

  /**
   * Convert domain to text representation for AI
   */
  private domainToText(domain: DomainDeclaration): string {
    // Simplified serialization - in real implementation would use proper ISL printer
    const parts: string[] = [];
    
    parts.push(`domain ${domain.name.name} {`);
    
    if (domain.version) {
      parts.push(`  version: "${domain.version}"`);
    }

    for (const type of domain.types) {
      parts.push(`  type ${type.name.name} = ...`);
    }

    for (const enumDecl of domain.enums) {
      parts.push(`  enum ${enumDecl.name.name} { ${enumDecl.variants.map(v => v.name).join(', ')} }`);
    }

    for (const entity of domain.entities) {
      parts.push(`  entity ${entity.name.name} {`);
      for (const field of entity.fields) {
        const annotations = field.annotations?.map(a => `[${a.name.name}]`).join(' ') ?? '';
        parts.push(`    ${field.name.name}: ... ${annotations}`);
      }
      parts.push(`  }`);
    }

    for (const behavior of domain.behaviors) {
      parts.push(`  behavior ${behavior.name.name} {`);
      if (behavior.input) {
        parts.push(`    input { ... }`);
      }
      if (behavior.output) {
        parts.push(`    output { ... }`);
      }
      parts.push(`  }`);
    }

    parts.push('}');

    return parts.join('\n');
  }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Review a domain specification
 * 
 * @param domain - The domain declaration to review
 * @param options - Review options
 * @returns Review result
 */
export async function review(
  domain: DomainDeclaration,
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const reviewer = new SpecReviewer(options);
  return reviewer.review(domain);
}
