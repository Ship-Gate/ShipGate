// ============================================================================
// Security Verifier
// ============================================================================

import type {
  Domain,
  SecurityVerifierOptions,
  SecurityVerificationResult,
  SecurityFinding,
  SecurityRule,
  SecurityCategory,
  Severity,
} from './types.js';
import { DEFAULT_OPTIONS, SEVERITY_PRIORITY } from './types.js';
import { authenticationRules } from './rules/authentication.js';
import { injectionRules } from './rules/injection.js';
import { dataExposureRules } from './rules/data-exposure.js';

/**
 * Security Verifier
 * 
 * Verifies ISL specifications against security best practices and vulnerabilities.
 * 
 * @example
 * ```typescript
 * const verifier = new SecurityVerifier({
 *   categories: ['authentication', 'injection'],
 *   failOnSeverity: 'high',
 * });
 * 
 * const result = verifier.verify(domain);
 * if (!result.passed) {
 *   console.log('Security issues found:', result.findings);
 * }
 * ```
 */
export class SecurityVerifier {
  private options: Required<SecurityVerifierOptions>;
  private rules: SecurityRule[];

  constructor(options: Partial<SecurityVerifierOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.rules = this.buildRuleSet();
  }

  /**
   * Verify a domain specification
   */
  verify(domain: Domain): SecurityVerificationResult {
    const startTime = performance.now();
    const findings: SecurityFinding[] = [];

    // Run all applicable rules
    for (const rule of this.rules) {
      if (this.shouldRunRule(rule)) {
        const ruleFindings = rule.check({ domain });
        findings.push(...ruleFindings);
      }
    }

    // Run custom rules
    for (const customRule of this.options.customRules) {
      if (this.shouldRunRule(customRule)) {
        const customFindings = customRule.check({ domain });
        findings.push(...customFindings);
      }
    }

    // Filter by severity
    const filteredFindings = findings.filter(f => 
      SEVERITY_PRIORITY[f.severity] >= SEVERITY_PRIORITY[this.options.minSeverity]
    );

    // Sort by severity
    filteredFindings.sort((a, b) => 
      SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity]
    );

    // Calculate summary
    const summary = {
      critical: filteredFindings.filter(f => f.severity === 'critical').length,
      high: filteredFindings.filter(f => f.severity === 'high').length,
      medium: filteredFindings.filter(f => f.severity === 'medium').length,
      low: filteredFindings.filter(f => f.severity === 'low').length,
      info: filteredFindings.filter(f => f.severity === 'info').length,
    };

    // Determine pass/fail
    const failSeverityPriority = SEVERITY_PRIORITY[this.options.failOnSeverity];
    const passed = !filteredFindings.some(f => 
      SEVERITY_PRIORITY[f.severity] >= failSeverityPriority
    );

    // Calculate score (0-100)
    const score = this.calculateScore(filteredFindings);

    return {
      passed,
      score,
      findings: filteredFindings,
      summary,
      checkedCategories: this.options.categories,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Verify multiple domains
   */
  verifyAll(domains: Domain[]): SecurityVerificationResult {
    const startTime = performance.now();
    const allFindings: SecurityFinding[] = [];

    for (const domain of domains) {
      const result = this.verify(domain);
      allFindings.push(...result.findings);
    }

    // Re-sort and calculate summary
    allFindings.sort((a, b) => 
      SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity]
    );

    const summary = {
      critical: allFindings.filter(f => f.severity === 'critical').length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length,
      info: allFindings.filter(f => f.severity === 'info').length,
    };

    const failSeverityPriority = SEVERITY_PRIORITY[this.options.failOnSeverity];
    const passed = !allFindings.some(f => 
      SEVERITY_PRIORITY[f.severity] >= failSeverityPriority
    );

    return {
      passed,
      score: this.calculateScore(allFindings),
      findings: allFindings,
      summary,
      checkedCategories: this.options.categories,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Add custom rules
   */
  addRule(rule: SecurityRule): void {
    this.options.customRules.push(rule);
  }

  /**
   * Get all available rules
   */
  getRules(): SecurityRule[] {
    return [...this.rules, ...this.options.customRules];
  }

  /**
   * Generate report
   */
  generateReport(result: SecurityVerificationResult): string {
    const lines: string[] = [
      '# Security Verification Report',
      '',
      `**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `**Score:** ${result.score}/100`,
      `**Duration:** ${result.duration.toFixed(2)}ms`,
      '',
      '## Summary',
      '',
      `- Critical: ${result.summary.critical}`,
      `- High: ${result.summary.high}`,
      `- Medium: ${result.summary.medium}`,
      `- Low: ${result.summary.low}`,
      `- Info: ${result.summary.info}`,
      '',
      '## Findings',
      '',
    ];

    if (result.findings.length === 0) {
      lines.push('No security issues found.');
    } else {
      for (const finding of result.findings) {
        lines.push(`### ${finding.severity.toUpperCase()}: ${finding.title}`);
        lines.push('');
        lines.push(`**ID:** ${finding.id}`);
        lines.push(`**Category:** ${finding.category}`);
        lines.push(`**Location:** ${finding.location.domain}${finding.location.behavior ? `.${finding.location.behavior}` : ''}`);
        lines.push('');
        lines.push(finding.description);
        lines.push('');
        lines.push(`**Recommendation:** ${finding.recommendation}`);
        if (finding.cweId) lines.push(`**CWE:** ${finding.cweId}`);
        if (finding.owaspId) lines.push(`**OWASP:** ${finding.owaspId}`);
        if (finding.evidence) lines.push(`**Evidence:** \`${finding.evidence}\``);
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // Private methods
  private buildRuleSet(): SecurityRule[] {
    const rules: SecurityRule[] = [];

    if (this.options.categories.includes('authentication')) {
      rules.push(...authenticationRules);
    }

    if (this.options.categories.includes('injection') || 
        this.options.categories.includes('input-validation')) {
      rules.push(...injectionRules);
    }

    if (this.options.categories.includes('data-exposure')) {
      rules.push(...dataExposureRules);
    }

    return rules;
  }

  private shouldRunRule(rule: SecurityRule): boolean {
    if (!this.options.categories.includes(rule.category)) {
      return false;
    }

    if (SEVERITY_PRIORITY[rule.severity] < SEVERITY_PRIORITY[this.options.minSeverity]) {
      return false;
    }

    return true;
  }

  private calculateScore(findings: SecurityFinding[]): number {
    if (findings.length === 0) return 100;

    // Weight by severity
    const weights = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      info: 1,
    };

    let penalty = 0;
    for (const finding of findings) {
      penalty += weights[finding.severity];
    }

    return Math.max(0, Math.min(100, 100 - penalty));
  }
}

/**
 * Create a security verifier
 */
export function createSecurityVerifier(options?: Partial<SecurityVerifierOptions>): SecurityVerifier {
  return new SecurityVerifier(options);
}

/**
 * Quick verify function
 */
export function verifySecurityAsync(
  domain: Domain,
  options?: Partial<SecurityVerifierOptions>
): Promise<SecurityVerificationResult> {
  return Promise.resolve(new SecurityVerifier(options).verify(domain));
}
