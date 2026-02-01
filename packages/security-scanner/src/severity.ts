// ============================================================================
// Security Severity Classification
// ============================================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SeverityInfo {
  level: Severity;
  score: number; // CVSS-like score 0-10
  sarifLevel: 'error' | 'warning' | 'note';
  color: string;
  emoji: string;
}

export const SEVERITY_INFO: Record<Severity, SeverityInfo> = {
  critical: {
    level: 'critical',
    score: 9.0,
    sarifLevel: 'error',
    color: '#dc3545',
    emoji: '🔴',
  },
  high: {
    level: 'high',
    score: 7.0,
    sarifLevel: 'error',
    color: '#fd7e14',
    emoji: '🟠',
  },
  medium: {
    level: 'medium',
    score: 5.0,
    sarifLevel: 'warning',
    color: '#ffc107',
    emoji: '🟡',
  },
  low: {
    level: 'low',
    score: 3.0,
    sarifLevel: 'note',
    color: '#28a745',
    emoji: '🟢',
  },
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_INFO[b].score - SEVERITY_INFO[a].score;
}

export function getSeverityFromScore(score: number): Severity {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

// ============================================================================
// Security Categories
// ============================================================================

export type SecurityCategory =
  | 'authentication'
  | 'authorization'
  | 'injection'
  | 'cryptography'
  | 'data-exposure'
  | 'configuration'
  | 'input-validation'
  | 'rate-limiting'
  | 'logging'
  | 'secrets';

export const CATEGORY_INFO: Record<SecurityCategory, { name: string; description: string }> = {
  authentication: {
    name: 'Authentication',
    description: 'Issues related to user identity verification',
  },
  authorization: {
    name: 'Authorization',
    description: 'Issues related to access control and permissions',
  },
  injection: {
    name: 'Injection',
    description: 'SQL, NoSQL, Command, and other injection vulnerabilities',
  },
  cryptography: {
    name: 'Cryptography',
    description: 'Weak or missing encryption, insecure algorithms',
  },
  'data-exposure': {
    name: 'Data Exposure',
    description: 'Sensitive data leakage or improper handling',
  },
  configuration: {
    name: 'Configuration',
    description: 'Insecure default configurations or settings',
  },
  'input-validation': {
    name: 'Input Validation',
    description: 'Missing or insufficient input validation',
  },
  'rate-limiting': {
    name: 'Rate Limiting',
    description: 'Missing or inadequate rate limiting',
  },
  logging: {
    name: 'Logging',
    description: 'Sensitive data in logs or insufficient logging',
  },
  secrets: {
    name: 'Secrets Management',
    description: 'Hardcoded credentials or insecure secret handling',
  },
};

// ============================================================================
// Source Location
// ============================================================================

export interface SourceLocation {
  file: string;
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

// ============================================================================
// Finding Interface
// ============================================================================

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: SecurityCategory;
  location: SourceLocation;
  description: string;
  recommendation: string;
  cwe?: string;
  owasp?: string;
  fix?: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// Scan Result Interface
// ============================================================================

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface ScanResult {
  summary: ScanSummary;
  findings: Finding[];
  scannedAt: Date;
  duration: number;
  filesScanned: number;
  rulesApplied: number;
}

export function createEmptyScanResult(): ScanResult {
  return {
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
    },
    findings: [],
    scannedAt: new Date(),
    duration: 0,
    filesScanned: 0,
    rulesApplied: 0,
  };
}

export function calculateSummary(findings: Finding[]): ScanSummary {
  const summary: ScanSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: findings.length,
  };

  for (const finding of findings) {
    summary[finding.severity]++;
  }

  return summary;
}

// ============================================================================
// Scan Options
// ============================================================================

export interface ScanOptions {
  /** Rules to include (default: all) */
  includeRules?: string[];
  /** Rules to exclude */
  excludeRules?: string[];
  /** Minimum severity to report */
  minSeverity?: Severity;
  /** Scan implementations (TS/Python) */
  scanImplementations?: boolean;
  /** Implementation source code */
  implementationSource?: string;
  /** Implementation language */
  implementationLanguage?: 'typescript' | 'python';
  /** Output format */
  outputFormat?: 'json' | 'sarif' | 'markdown';
  /** Include fix suggestions */
  includeFixes?: boolean;
  /** Custom rules */
  customRules?: SecurityRule[];
}

// ============================================================================
// Security Rule Interface
// ============================================================================

export interface SecurityRule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: SecurityCategory;
  cwe?: string;
  owasp?: string;
  check: RuleChecker;
}

export type RuleChecker = (context: RuleContext) => Finding[];

export interface RuleContext {
  domain: Domain;
  implementation?: string;
  options: ScanOptions;
}

// Domain type from ISL AST (simplified for this package)
export interface Domain {
  kind: 'Domain';
  name: { name: string };
  version: { value: string };
  location: SourceLocation;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
  invariants: InvariantBlock[];
  policies: Policy[];
  views: View[];
  scenarios: ScenarioBlock[];
}

export interface TypeDeclaration {
  kind: 'TypeDeclaration';
  name: { name: string };
  definition: TypeDefinition;
  annotations: Annotation[];
  location: SourceLocation;
}

export interface TypeDefinition {
  kind: string;
  [key: string]: unknown;
}

export interface Annotation {
  kind: 'Annotation';
  name: { name: string };
  value?: unknown;
  location: SourceLocation;
}

export interface Entity {
  kind: 'Entity';
  name: { name: string };
  fields: Field[];
  invariants: unknown[];
  lifecycle?: unknown;
  location: SourceLocation;
}

export interface Field {
  kind: 'Field';
  name: { name: string };
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
  location: SourceLocation;
}

export interface Behavior {
  kind: 'Behavior';
  name: { name: string };
  description?: { value: string };
  actors?: ActorSpec[];
  input: InputSpec;
  output: OutputSpec;
  preconditions: unknown[];
  postconditions: PostconditionBlock[];
  invariants: unknown[];
  temporal: TemporalSpec[];
  security: SecuritySpec[];
  compliance: unknown[];
  observability?: ObservabilitySpec;
  location: SourceLocation;
}

export interface ActorSpec {
  kind: 'ActorSpec';
  name: { name: string };
  constraints: unknown[];
  location: SourceLocation;
}

export interface InputSpec {
  kind: 'InputSpec';
  fields: Field[];
  location: SourceLocation;
}

export interface OutputSpec {
  kind: 'OutputSpec';
  success: TypeDefinition;
  errors: ErrorSpec[];
  location: SourceLocation;
}

export interface ErrorSpec {
  kind: 'ErrorSpec';
  name: { name: string };
  when?: { value: string };
  retriable: boolean;
  location: SourceLocation;
}

export interface PostconditionBlock {
  kind: 'PostconditionBlock';
  condition: unknown;
  predicates: unknown[];
  location: SourceLocation;
}

export interface TemporalSpec {
  kind: 'TemporalSpec';
  operator: string;
  predicate: unknown;
  duration?: unknown;
  location: SourceLocation;
}

export interface SecuritySpec {
  kind: 'SecuritySpec';
  type: 'requires' | 'rate_limit' | 'fraud_check';
  details: unknown;
  location: SourceLocation;
}

export interface ObservabilitySpec {
  kind: 'ObservabilitySpec';
  metrics: unknown[];
  traces: unknown[];
  logs: LogSpec[];
  location: SourceLocation;
}

export interface LogSpec {
  kind: 'LogSpec';
  condition: 'success' | 'error' | 'always';
  level: 'debug' | 'info' | 'warn' | 'error';
  include: { name: string }[];
  exclude: { name: string }[];
  location: SourceLocation;
}

export interface InvariantBlock {
  kind: 'InvariantBlock';
  name: { name: string };
  description?: { value: string };
  scope: 'global' | 'transaction';
  predicates: unknown[];
  location: SourceLocation;
}

export interface Policy {
  kind: 'Policy';
  name: { name: string };
  appliesTo: unknown;
  rules: unknown[];
  location: SourceLocation;
}

export interface View {
  kind: 'View';
  name: { name: string };
  forEntity: unknown;
  fields: unknown[];
  consistency: unknown;
  cache?: unknown;
  location: SourceLocation;
}

export interface ScenarioBlock {
  kind: 'ScenarioBlock';
  behaviorName: { name: string };
  scenarios: unknown[];
  location: SourceLocation;
}
