// ============================================================================
// ISL Security Scanner
// @isl-lang/security-scanner
// 
// Scan ISL specs and implementations for security vulnerabilities
// ============================================================================

// Core types and severity
export {
  SEVERITY_INFO,
  compareSeverity,
  getSeverityFromScore,
  CATEGORY_INFO,
  calculateSummary,
  createEmptyScanResult,
} from './severity';

export type {
  Severity,
  SeverityInfo,
  SecurityCategory,
  SourceLocation,
  Finding,
  ScanSummary,
  ScanResult,
  ScanOptions,
  SecurityRule,
  RuleChecker,
  RuleContext,
  // Domain types for ISL AST
  Domain,
  Entity,
  Behavior,
  Field,
  TypeDeclaration,
} from './severity';

// Scanner
export {
  SecurityScanner,
  scan,
  scanWithRules,
  quickScan,
  fullScan,
  scanSource,
  runCI,
  assertSecure,
} from './scanner';

export type {
  ScannerOptions,
  CIResult,
} from './scanner';

// Rules
export {
  ALL_RULES,
  RULE_REGISTRY,
  getRule,
  getRulesByCategory,
  getRulesBySeverity,
  getRuleMetadata,
  getRuleSummary,
  // Individual rule sets
  authRules,
  injectionRules,
  cryptoRules,
  dataRules,
  configRules,
  // Individual rules
  SEC001_MissingAuthentication,
  SEC002_MissingRateLimiting,
  SEC003_SensitiveDataInLogs,
  SEC004_MissingEncryption,
  SEC005_WeakConstraints,
  SEC006_MissingIdempotency,
  SEC007_UnboundedQueries,
  SEC008_SQLInjection,
  SEC009_HardcodedSecrets,
  SEC010_InsecureRandomness,
} from './rules';

export type {
  RuleMetadata,
  RuleSummary,
} from './rules';

// Implementation scanners
export {
  scanImplementation,
  scanTypeScript,
  scanPython,
  detectLanguage,
  getTotalPatternCount,
  getPatternCountByLanguage,
} from './impl-scanner';

export type {
  SupportedLanguage,
  ImplementationScanOptions,
  ImplementationScanResult,
  TypeScriptScanOptions,
  TypeScriptScanResult,
  PythonScanOptions,
  PythonScanResult,
} from './impl-scanner';

// Reporters
export {
  generateReport,
  getFormatExtension,
  getFormatMimeType,
  // SARIF
  generateSarif,
  generateSarifString,
  generateFullSarif,
  // JSON
  generateJsonReport,
  generateJsonString,
  generateMinimalJson,
  // Markdown
  generateMarkdownReport,
  generateMarkdownSummary,
  generateGitHubMarkdown,
} from './reporters';

export type {
  OutputFormat,
  ReportOptions,
  SarifOptions,
  JsonReport,
  JsonReportOptions,
  MarkdownOptions,
} from './reporters';

// Verification pipeline security scanner
export {
  VerificationSecurityScanner,
  runVerificationSecurityScan,
} from './verification/index.js';
export type {
  VerificationSecurityScanOptions,
  VerificationSecurityScanResult,
  SecurityCheckResult,
  SecurityFinding,
  SecuritySeverity,
} from './verification/index.js';

// ============================================================================
// Default Export
// ============================================================================

import { scan } from './scanner';
export default scan;

// ============================================================================
// Quick Usage Examples
// ============================================================================

/**
 * @example Basic usage
 * ```typescript
 * import { scan } from '@isl-lang/security-scanner';
 * 
 * const domain = parseISL(islSource);
 * const result = await scan(domain);
 * 
 * console.log(`Found ${result.summary.total} issues`);
 * ```
 * 
 * @example With implementation
 * ```typescript
 * import { fullScan } from '@isl-lang/security-scanner';
 * 
 * const result = await fullScan(domain, tsImplementation, 'typescript');
 * ```
 * 
 * @example CI/CD integration
 * ```typescript
 * import { runCI } from '@isl-lang/security-scanner';
 * 
 * const { passed, exitCode, summary } = await runCI(domain, implementation);
 * console.log(summary);
 * process.exit(exitCode);
 * ```
 * 
 * @example Generate SARIF report
 * ```typescript
 * import { scan, generateSarifString } from '@isl-lang/security-scanner';
 * 
 * const result = await scan(domain);
 * const sarif = generateSarifString(result);
 * fs.writeFileSync('security-report.sarif.json', sarif);
 * ```
 * 
 * @example Custom rules
 * ```typescript
 * import { SecurityScanner, SecurityRule } from '@isl-lang/security-scanner';
 * 
 * const customRule: SecurityRule = {
 *   id: 'CUSTOM001',
 *   title: 'My Custom Rule',
 *   severity: 'high',
 *   category: 'authentication',
 *   description: 'Custom security check',
 *   check: (context) => {
 *     // Return findings
 *     return [];
 *   }
 * };
 * 
 * const scanner = new SecurityScanner({ customRules: [customRule] });
 * const result = await scanner.scan(domain);
 * ```
 */
