// ============================================================================
// Security Lint Analyzer
// ============================================================================

import type {
  Domain,
  Finding,
  LintRule,
  LintResult,
  SecurityPolicyOptions,
} from '../types.js';
import { DEFAULT_SECURITY_OPTIONS, SEVERITY_PRIORITY } from '../types.js';
import { allLintRules } from './rules/index.js';

/**
 * Security Lint Analyzer
 * 
 * Analyzes ISL specs against security lint rules and provides
 * auto-fix suggestions as AST patches.
 */
export class SecurityLintAnalyzer {
  private options: Required<SecurityPolicyOptions>;
  private rules: LintRule[];

  constructor(options: Partial<SecurityPolicyOptions> = {}) {
    this.options = { ...DEFAULT_SECURITY_OPTIONS, ...options };
    this.rules = this.buildRuleSet();
  }

  /**
   * Analyze a domain spec
   */
  analyze(domain: Domain): LintResult {
    const startTime = performance.now();
    const findings: Finding[] = [];

    // Run all lint rules
    for (const rule of this.rules) {
      if (this.shouldRunRule(rule)) {
        const ruleFindings = rule.check({ domain });
        findings.push(...ruleFindings);
      }
    }

    // Run custom lint rules
    for (const customRule of this.options.customLintRules) {
      if (this.shouldRunRule(customRule)) {
        const customFindings = customRule.check({ domain });
        findings.push(...customFindings);
      }
    }

    // Filter by severity
    const filteredFindings = findings.filter(f => 
      SEVERITY_PRIORITY[f.severity] >= SEVERITY_PRIORITY[this.options.minSeverity]
    );

    // Sort by severity (errors first)
    filteredFindings.sort((a, b) => 
      SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity]
    );

    // Count fixable issues
    const fixableCount = filteredFindings.filter(f => f.autofix).length;

    // Calculate summary
    const summary = {
      errors: filteredFindings.filter(f => f.severity === 'error').length,
      warnings: filteredFindings.filter(f => f.severity === 'warning').length,
      infos: filteredFindings.filter(f => f.severity === 'info').length,
    };

    // Determine pass/fail
    const failSeverityPriority = SEVERITY_PRIORITY[this.options.failOnSeverity];
    const passed = !filteredFindings.some(f => 
      SEVERITY_PRIORITY[f.severity] >= failSeverityPriority
    );

    return {
      passed,
      findings: filteredFindings,
      fixableCount,
      summary,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Analyze a specific behavior
   */
  analyzeBehavior(domain: Domain, behaviorName: string): LintResult {
    const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
    if (!behavior) {
      return {
        passed: true,
        findings: [],
        fixableCount: 0,
        summary: { errors: 0, warnings: 0, infos: 0 },
        duration: 0,
      };
    }

    const startTime = performance.now();
    const findings: Finding[] = [];

    for (const rule of this.rules) {
      if (this.shouldRunRule(rule)) {
        const ruleFindings = rule.check({ domain, behavior });
        findings.push(...ruleFindings);
      }
    }

    const filteredFindings = findings.filter(f => 
      SEVERITY_PRIORITY[f.severity] >= SEVERITY_PRIORITY[this.options.minSeverity]
    );

    filteredFindings.sort((a, b) => 
      SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity]
    );

    const fixableCount = filteredFindings.filter(f => f.autofix).length;

    const summary = {
      errors: filteredFindings.filter(f => f.severity === 'error').length,
      warnings: filteredFindings.filter(f => f.severity === 'warning').length,
      infos: filteredFindings.filter(f => f.severity === 'info').length,
    };

    const failSeverityPriority = SEVERITY_PRIORITY[this.options.failOnSeverity];
    const passed = !filteredFindings.some(f => 
      SEVERITY_PRIORITY[f.severity] >= failSeverityPriority
    );

    return {
      passed,
      findings: filteredFindings,
      fixableCount,
      summary,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Get auto-fix suggestions
   */
  getAutofixes(findings: Finding[]): Finding[] {
    return findings.filter(f => f.autofix);
  }

  /**
   * Generate fix report
   */
  generateFixReport(findings: Finding[]): string {
    const fixable = this.getAutofixes(findings);
    
    if (fixable.length === 0) {
      return 'No auto-fixable issues found.';
    }

    const lines: string[] = [
      '# Auto-Fix Suggestions',
      '',
      `Found ${fixable.length} fixable issue(s):`,
      '',
    ];

    for (const finding of fixable) {
      lines.push(`## ${finding.severity.toUpperCase()}: ${finding.title}`);
      lines.push('');
      lines.push(`**ID:** ${finding.id}`);
      lines.push(`**Location:** ${finding.location.file}:${finding.location.line}`);
      if (finding.behaviorName) {
        lines.push(`**Behavior:** ${finding.behaviorName}`);
      }
      lines.push('');
      lines.push(finding.message);
      lines.push('');
      
      if (finding.autofix) {
        lines.push('### Suggested Fix');
        lines.push('');
        lines.push(`**Operation:** ${finding.autofix.operation}`);
        lines.push(`**Description:** ${finding.autofix.description}`);
        lines.push('');
        if (finding.autofix.patch.text) {
          lines.push('```isl');
          lines.push(finding.autofix.patch.text.trim());
          lines.push('```');
        }
      }
      
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Add custom lint rule
   */
  addRule(rule: LintRule): void {
    this.options.customLintRules.push(rule);
  }

  /**
   * Get all available rules
   */
  getRules(): LintRule[] {
    return [...this.rules, ...this.options.customLintRules];
  }

  // Private methods
  private buildRuleSet(): LintRule[] {
    return allLintRules.filter(rule => 
      this.options.enabledPolicies.includes(rule.category)
    );
  }

  private shouldRunRule(rule: LintRule): boolean {
    if (!this.options.enabledPolicies.includes(rule.category)) {
      return false;
    }

    if (SEVERITY_PRIORITY[rule.severity] < SEVERITY_PRIORITY[this.options.minSeverity]) {
      return false;
    }

    return true;
  }
}

/**
 * Create a lint analyzer
 */
export function createLintAnalyzer(options?: Partial<SecurityPolicyOptions>): SecurityLintAnalyzer {
  return new SecurityLintAnalyzer(options);
}

/**
 * Quick lint function
 */
export function lint(domain: Domain, options?: Partial<SecurityPolicyOptions>): LintResult {
  return new SecurityLintAnalyzer(options).analyze(domain);
}
