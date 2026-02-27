// ============================================================================
// Security Policy Checker
// ============================================================================

import type {
  Domain,
  Finding,
  PolicyRule,
  PolicyCheckResult,
  SecurityCheckResult,
  SecurityPolicyOptions,
} from './types.js';
import { DEFAULT_SECURITY_OPTIONS, SEVERITY_PRIORITY } from './types.js';
import { allPolicyRules } from './policies/index.js';
import { SecurityLintAnalyzer } from './lint/analyzer.js';

/**
 * Security Policy Checker
 * 
 * Checks ISL specifications against security policy rules
 * and lint rules. Provides comprehensive security analysis.
 */
export class SecurityPolicyChecker {
  private options: Required<SecurityPolicyOptions>;
  private policyRules: PolicyRule[];
  private lintAnalyzer: SecurityLintAnalyzer;

  constructor(options: Partial<SecurityPolicyOptions> = {}) {
    this.options = { ...DEFAULT_SECURITY_OPTIONS, ...options };
    this.policyRules = this.buildPolicyRuleSet();
    this.lintAnalyzer = new SecurityLintAnalyzer(options);
  }

  /**
   * Check a domain against all security policies
   */
  checkPolicies(domain: Domain): PolicyCheckResult {
    const startTime = performance.now();
    const findings: Finding[] = [];

    // Run all policy rules
    for (const rule of this.policyRules) {
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

    // Determine pass/fail
    const failSeverityPriority = SEVERITY_PRIORITY[this.options.failOnSeverity];
    const passed = !filteredFindings.some(f => 
      SEVERITY_PRIORITY[f.severity] >= failSeverityPriority
    );

    // Calculate score
    const score = this.calculateScore(filteredFindings);

    return {
      passed,
      findings: filteredFindings,
      score,
      checkedPolicies: this.policyRules.map(r => r.id),
      duration: performance.now() - startTime,
    };
  }

  /**
   * Run full security check (policies + lint)
   */
  check(domain: Domain): SecurityCheckResult {
    const startTime = performance.now();

    // Run policy checks
    const policyResult = this.checkPolicies(domain);

    // Run lint checks
    const lintResult = this.lintAnalyzer.analyze(domain);

    // Combine all findings
    const allFindings = [...policyResult.findings, ...lintResult.findings];
    
    // Sort combined findings by severity
    allFindings.sort((a, b) => 
      SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity]
    );

    // Count total fixable
    const totalFixable = allFindings.filter(f => f.autofix).length;

    // Overall pass/fail
    const passed = policyResult.passed && lintResult.passed;

    return {
      passed,
      policyResult,
      lintResult,
      allFindings,
      totalFixable,
      duration: performance.now() - startTime,
    };
  }

  /**
   * Generate comprehensive security report
   */
  generateReport(result: SecurityCheckResult): string {
    const lines: string[] = [
      '# Security Analysis Report',
      '',
      `**Overall Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `**Duration:** ${result.duration.toFixed(2)}ms`,
      `**Fixable Issues:** ${result.totalFixable}`,
      '',
      '## Summary',
      '',
      '### Policy Checks',
      `- Score: ${result.policyResult.score}/100`,
      `- Findings: ${result.policyResult.findings.length}`,
      '',
      '### Lint Checks',
      `- Errors: ${result.lintResult.summary.errors}`,
      `- Warnings: ${result.lintResult.summary.warnings}`,
      `- Info: ${result.lintResult.summary.infos}`,
      '',
      '## All Findings',
      '',
    ];

    if (result.allFindings.length === 0) {
      lines.push('No security issues found. ✨');
    } else {
      // Group by severity
      const errors = result.allFindings.filter(f => f.severity === 'error');
      const warnings = result.allFindings.filter(f => f.severity === 'warning');
      const infos = result.allFindings.filter(f => f.severity === 'info');

      if (errors.length > 0) {
        lines.push('### Errors');
        lines.push('');
        for (const finding of errors) {
          lines.push(this.formatFinding(finding));
        }
      }

      if (warnings.length > 0) {
        lines.push('### Warnings');
        lines.push('');
        for (const finding of warnings) {
          lines.push(this.formatFinding(finding));
        }
      }

      if (infos.length > 0) {
        lines.push('### Info');
        lines.push('');
        for (const finding of infos) {
          lines.push(this.formatFinding(finding));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Get enabled policies
   */
  getEnabledPolicies(): string[] {
    return this.options.enabledPolicies;
  }

  /**
   * Add custom policy rule
   */
  addPolicyRule(rule: PolicyRule): void {
    this.options.customRules.push(rule);
  }

  // Private methods
  private buildPolicyRuleSet(): PolicyRule[] {
    return allPolicyRules.filter(rule => 
      this.options.enabledPolicies.includes(rule.category)
    );
  }

  private shouldRunRule(rule: PolicyRule): boolean {
    if (!this.options.enabledPolicies.includes(rule.category)) {
      return false;
    }

    if (SEVERITY_PRIORITY[rule.severity] < SEVERITY_PRIORITY[this.options.minSeverity]) {
      return false;
    }

    return true;
  }

  private calculateScore(findings: Finding[]): number {
    if (findings.length === 0) return 100;

    const weights = {
      error: 20,
      warning: 8,
      info: 2,
    };

    let penalty = 0;
    for (const finding of findings) {
      penalty += weights[finding.severity];
    }

    return Math.max(0, Math.min(100, 100 - penalty));
  }

  private formatFinding(finding: Finding): string {
    const lines: string[] = [];
    
    const icon = finding.severity === 'error' ? '🔴' : 
                 finding.severity === 'warning' ? '🟡' : '🔵';
    
    lines.push(`${icon} **${finding.title}** (${finding.id})`);
    lines.push('');
    lines.push(`> ${finding.message}`);
    lines.push('');
    lines.push(`- **Location:** ${finding.location.file}:${finding.location.line}`);
    if (finding.behaviorName) {
      lines.push(`- **Behavior:** ${finding.behaviorName}`);
    }
    if (finding.suggestion) {
      lines.push(`- **Suggestion:** ${finding.suggestion}`);
    }
    if (finding.autofix) {
      lines.push(`- **Auto-fix available:** Yes`);
    }
    lines.push('');

    return lines.join('\n');
  }
}

/**
 * Create a security policy checker
 */
export function createSecurityChecker(options?: Partial<SecurityPolicyOptions>): SecurityPolicyChecker {
  return new SecurityPolicyChecker(options);
}

/**
 * Quick check function
 */
export function checkSecurity(domain: Domain, options?: Partial<SecurityPolicyOptions>): SecurityCheckResult {
  return new SecurityPolicyChecker(options).check(domain);
}

/**
 * Quick policy check function
 */
export function checkPolicies(domain: Domain, options?: Partial<SecurityPolicyOptions>): PolicyCheckResult {
  return new SecurityPolicyChecker(options).checkPolicies(domain);
}
