export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export type TaintSourceCategory =
  | 'user-input'
  | 'external-api'
  | 'database'
  | 'environment'
  | 'file-system';

export interface TaintSource {
  category: TaintSourceCategory;
  location: SourceLocation;
  expression: string;
  description: string;
}

export type TaintSinkCategory =
  | 'sql-query'
  | 'shell-exec'
  | 'html-render'
  | 'eval'
  | 'file-write'
  | 'http-response'
  | 'log-output';

export interface TaintSink {
  category: TaintSinkCategory;
  location: SourceLocation;
  expression: string;
  description: string;
}

export type SanitizerMethod =
  | 'parameterization'
  | 'escaping'
  | 'validation'
  | 'encoding'
  | 'allowlist';

export interface Sanitizer {
  method: SanitizerMethod;
  location: SourceLocation;
  expression: string;
  sanitizes: TaintSinkCategory[];
}

export type TaintPathStepKind =
  | 'assignment'
  | 'parameter'
  | 'return'
  | 'concatenation'
  | 'property-access'
  | 'call'
  | 'template-literal'
  | 'spread';

export interface TaintPathStep {
  location: SourceLocation;
  expression: string;
  kind: TaintPathStepKind;
}

export interface TaintFlow {
  source: TaintSource;
  sink: TaintSink;
  path: TaintPathStep[];
  sanitizers: Sanitizer[];
}

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TaintFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  flow: TaintFlow;
  remediation: string;
  cwe?: string;
}
