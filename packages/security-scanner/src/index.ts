// ============================================================================
// ISL Security Scanner
// @intentos/security-scanner
// 
// Scan ISL specs and implementations for security vulnerabilities
// ============================================================================

// Core types and severity
export {
  Severity,
  SeverityInfo,
  SEVERITY_INFO,
  compareSeverity,
  getSeverityFromScore,
  SecurityCategory,
  CATEGORY_INFO,
  SourceLocation,
  Finding,
  ScanSummary,
  ScanResult,
  ScanOptions,
  SecurityRule,
  RuleChecker,
  RuleContext,
  calculateSummary,
  createEmptyScanResult,
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
  ScannerOptions,
  scan,
  scanWithRules,
  quickScan,
  fullScan,
  scanSource,
  runCI,
  assertSecure,
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
  RuleMetadata,
  RuleSummary,
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

// Implementation scanners
export {
  scanImplementation,
  scanTypeScript,
  scanPython,
  detectLanguage,
  SupportedLanguage,
  ImplementationScanOptions,
  ImplementationScanResult,
  TypeScriptScanOptions,
  TypeScriptScanResult,
  PythonScanOptions,
  PythonScanResult,
  getTotalPatternCount,
  getPatternCountByLanguage,
} from './impl-scanner';

// Reporters
export {
  generateReport,
  OutputFormat,
  ReportOptions,
  getFormatExtension,
  getFormatMimeType,
  // SARIF
  generateSarif,
  generateSarifString,
  generateFullSarif,
  SarifOptions,
  // JSON
  generateJsonReport,
  generateJsonString,
  generateMinimalJson,
  JsonReport,
  JsonReportOptions,
  // Markdown
  generateMarkdownReport,
  generateMarkdownSummary,
  generateGitHubMarkdown,
  MarkdownOptions,
} from './reporters';

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
 * import { scan } from '@intentos/security-scanner';
 * 
 * const domain = parseISL(islSource);
 * const result = await scan(domain);
 * 
 * console.log(`Found ${result.summary.total} issues`);
 * ```
 * 
 * @example With implementation
 * ```typescript
 * import { fullScan } from '@intentos/security-scanner';
 * 
 * const result = await fullScan(domain, tsImplementation, 'typescript');
 * ```
 * 
 * @example CI/CD integration
 * ```typescript
 * import { runCI } from '@intentos/security-scanner';
 * 
 * const { passed, exitCode, summary } = await runCI(domain, implementation);
 * console.log(summary);
 * process.exit(exitCode);
 * ```
 * 
 * @example Generate SARIF report
 * ```typescript
 * import { scan, generateSarifString } from '@intentos/security-scanner';
 * 
 * const result = await scan(domain);
 * const sarif = generateSarifString(result);
 * fs.writeFileSync('security-report.sarif.json', sarif);
 * ```
 * 
 * @example Custom rules
 * ```typescript
 * import { SecurityScanner, SecurityRule } from '@intentos/security-scanner';
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
