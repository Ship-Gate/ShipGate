export interface SemgrepPosition {
  line: number;
  col: number;
  offset?: number;
}

export interface SemgrepFinding {
  check_id: string;
  path: string;
  start: SemgrepPosition;
  end: SemgrepPosition;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  metadata: Record<string, unknown>;
  extra: {
    lines: string;
    message: string;
    severity?: string;
    metadata?: Record<string, unknown>;
    fingerprint?: string;
  };
}

export interface SemgrepResult {
  findings: SemgrepFinding[];
  errors: string[];
  version: string;
}

export interface SemgrepConfig {
  rulesDir?: string;
  configPreset?: string;
  timeout?: number;
  maxFindings?: number;
}

/**
 * Raw JSON structure returned by `semgrep --json`.
 * Only the fields we consume are typed; the rest falls through as unknown.
 */
export interface SemgrepRawOutput {
  results: SemgrepRawResult[];
  errors: SemgrepRawError[];
  version?: string;
}

export interface SemgrepRawResult {
  check_id: string;
  path: string;
  start: SemgrepPosition;
  end: SemgrepPosition;
  extra: {
    message: string;
    severity?: string;
    lines?: string;
    metadata?: Record<string, unknown>;
    fingerprint?: string;
  };
}

export interface SemgrepRawError {
  message?: string;
  type?: string;
  rule_id?: string;
  path?: string;
  long_msg?: string;
  short_msg?: string;
}
