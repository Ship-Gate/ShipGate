// ============================================================================
// Main Security Scanner
// Orchestrates ISL spec and implementation scanning
// ============================================================================

import {
  Domain,
  Finding,
  ScanResult,
  ScanOptions,
  SecurityRule,
  RuleContext,
  Severity,
  SEVERITY_INFO,
  calculateSummary,
  createEmptyScanResult,
} from './severity';
import { ALL_RULES, RULE_REGISTRY } from './rules';
import { scanImplementation, SupportedLanguage } from './impl-scanner';
import { generateReport, OutputFormat, ReportOptions } from './reporters';

// ============================================================================
// Scanner Options
// ============================================================================

export interface ScannerOptions extends ScanOptions {
  /** Fail on critical/high findings */
  failOnSeverity?: Severity;
  /** Generate report in specific format */
  reportFormat?: OutputFormat;
  /** Enable verbose logging */
  verbose?: boolean;
}

const DEFAULT_OPTIONS: ScannerOptions = {
  scanImplementations: false,
  includeFixes: true,
  outputFormat: 'json',
  reportFormat: 'json',
  verbose: false,
};

// ============================================================================
// Main Scanner Class
// ============================================================================

export class SecurityScanner {
  private readonly options: ScannerOptions;
  private readonly rules: SecurityRule[];

  constructor(options: ScannerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.rules = this.buildRuleSet();
  }

  /**
   * Build the rule set based on options
   */
  private buildRuleSet(): SecurityRule[] {
    let rules = [...ALL_RULES];

    // Add custom rules
    if (this.options.customRules) {
      rules = [...rules, ...this.options.customRules];
    }

    // Filter by include rules
    if (this.options.includeRules && this.options.includeRules.length > 0) {
      const includeSet = new Set(this.options.includeRules);
      rules = rules.filter((r) => includeSet.has(r.id));
    }

    // Filter by exclude rules
    if (this.options.excludeRules && this.options.excludeRules.length > 0) {
      const excludeSet = new Set(this.options.excludeRules);
      rules = rules.filter((r) => !excludeSet.has(r.id));
    }

    return rules;
  }

  /**
   * Scan an ISL domain for security vulnerabilities
   */
  async scan(
    domain: Domain,
    implementation?: string
  ): Promise<ScanResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Create rule context
    const context: RuleContext = {
      domain,
      implementation,
      options: this.options,
    };

    // Run ISL spec rules
    for (const rule of this.rules) {
      try {
        const ruleFindings = rule.check(context);
        findings.push(...ruleFindings);

        if (this.options.verbose && ruleFindings.length > 0) {
          this.log(`Rule ${rule.id}: Found ${ruleFindings.length} issues`);
        }
      } catch (error) {
        if (this.options.verbose) {
          this.log(`Rule ${rule.id} failed: ${error}`);
        }
      }
    }

    // Scan implementation if provided
    if (this.options.scanImplementations && implementation) {
      const implResult = scanImplementation(implementation, {
        language: this.options.implementationLanguage,
        filePath: `implementation.${this.options.implementationLanguage === 'python' ? 'py' : 'ts'}`,
      });
      findings.push(...implResult.findings);

      if (this.options.verbose) {
        this.log(`Implementation scan: Found ${implResult.findings.length} issues`);
      }
    }

    // Filter by minimum severity
    let filteredFindings = findings;
    if (this.options.minSeverity) {
      const minScore = SEVERITY_INFO[this.options.minSeverity].score;
      filteredFindings = findings.filter(
        (f) => SEVERITY_INFO[f.severity].score >= minScore
      );
    }

    // Sort by severity
    filteredFindings.sort((a, b) => {
      return SEVERITY_INFO[b.severity].score - SEVERITY_INFO[a.severity].score;
    });

    const endTime = Date.now();

    return {
      summary: calculateSummary(filteredFindings),
      findings: filteredFindings,
      scannedAt: new Date(startTime),
      duration: endTime - startTime,
      filesScanned: implementation ? 2 : 1, // ISL + implementation
      rulesApplied: this.rules.length,
    };
  }

  /**
   * Scan and generate report
   */
  async scanAndReport(
    domain: Domain,
    implementation?: string,
    reportOptions?: ReportOptions
  ): Promise<{ result: ScanResult; report: string }> {
    const result = await this.scan(domain, implementation);
    const report = generateReport(result, {
      format: this.options.reportFormat,
      ...reportOptions,
    });

    return { result, report };
  }

  /**
   * Check if scan passes based on severity threshold
   */
  checkPassed(result: ScanResult): boolean {
    const failSeverity = this.options.failOnSeverity || 'high';
    const failScore = SEVERITY_INFO[failSeverity].score;

    return !result.findings.some(
      (f) => SEVERITY_INFO[f.severity].score >= failScore
    );
  }

  /**
   * Get available rules
   */
  getRules(): SecurityRule[] {
    return this.rules;
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): SecurityRule | undefined {
    return RULE_REGISTRY.get(id);
  }

  private log(message: string): void {
    if (this.options.verbose) {
      process.stderr.write(`[SecurityScanner] ${message}\n`);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick scan function
 */
export async function scan(
  domain: Domain,
  implementation?: string,
  options?: ScanOptions
): Promise<ScanResult> {
  const scanner = new SecurityScanner(options);
  return scanner.scan(domain, implementation);
}

/**
 * Scan with specific rules only
 */
export async function scanWithRules(
  domain: Domain,
  ruleIds: string[],
  implementation?: string
): Promise<ScanResult> {
  const scanner = new SecurityScanner({ includeRules: ruleIds });
  return scanner.scan(domain, implementation);
}

/**
 * Quick scan for critical/high issues only
 */
export async function quickScan(
  domain: Domain,
  implementation?: string
): Promise<ScanResult> {
  const scanner = new SecurityScanner({ minSeverity: 'high' });
  return scanner.scan(domain, implementation);
}

/**
 * Full scan with implementation
 */
export async function fullScan(
  domain: Domain,
  implementation: string,
  language: SupportedLanguage = 'typescript'
): Promise<ScanResult> {
  const scanner = new SecurityScanner({
    scanImplementations: true,
    implementationLanguage: language,
  });
  return scanner.scan(domain, implementation);
}

/**
 * Scan implementation source code only
 */
export function scanSource(
  source: string,
  language: SupportedLanguage = 'typescript'
): Finding[] {
  const result = scanImplementation(source, { language });
  return result.findings;
}

// ============================================================================
// CI/CD Integration
// ============================================================================

export interface CIResult {
  passed: boolean;
  exitCode: number;
  summary: string;
  result: ScanResult;
}

/**
 * Run scan for CI/CD pipeline
 */
export async function runCI(
  domain: Domain,
  implementation?: string,
  options?: ScannerOptions
): Promise<CIResult> {
  const scanner = new SecurityScanner({
    failOnSeverity: 'high',
    ...options,
  });

  const result = await scanner.scan(domain, implementation);
  const passed = scanner.checkPassed(result);

  const summary = [
    `Security Scan ${passed ? 'PASSED' : 'FAILED'}`,
    `Critical: ${result.summary.critical}`,
    `High: ${result.summary.high}`,
    `Medium: ${result.summary.medium}`,
    `Low: ${result.summary.low}`,
    `Total: ${result.summary.total}`,
  ].join(' | ');

  return {
    passed,
    exitCode: passed ? 0 : 1,
    summary,
    result,
  };
}

/**
 * Assert no critical or high findings (throws if found)
 */
export async function assertSecure(
  domain: Domain,
  implementation?: string
): Promise<void> {
  const result = await scan(domain, implementation, { minSeverity: 'high' });

  if (result.findings.length > 0) {
    const message = result.findings
      .map((f) => `[${f.severity.toUpperCase()}] ${f.id}: ${f.title} at ${f.location.file}:${f.location.startLine}`)
      .join('\n');

    throw new Error(`Security scan failed:\n${message}`);
  }
}
