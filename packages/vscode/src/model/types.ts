/**
 * Shipgate Scan Model Types
 *
 * Normalized types for verdicts, findings, and run metadata.
 * Maps CLI output (isl verify --json) to extension consumption.
 */

export type Verdict = 'SHIP' | 'WARN' | 'NO_SHIP';

export type FileStatus = 'PASS' | 'WARN' | 'FAIL';

export type VerificationMode = 'isl' | 'specless' | 'mixed';

export interface FileFinding {
  /** Relative file path */
  file: string;
  /** PASS | WARN | FAIL */
  status: FileStatus;
  /** ISL verified | Specless | Fake feature | Skipped */
  mode: string;
  /** Score 0–1 */
  score: number;
  /** Spec file path if ISL mode */
  specFile?: string | null;
  /** Per-file blockers */
  blockers: string[];
  /** Per-file errors */
  errors: string[];
  /** Duration in ms */
  duration: number;
}

export interface ScanRunResult {
  /** SHIP | WARN | NO_SHIP */
  verdict: Verdict;
  /** Overall score 0–1 */
  score: number;
  /** ISL coverage */
  coverage: { specced: number; total: number };
  /** Verification mode */
  mode: VerificationMode;
  /** Per-file results */
  files: FileFinding[];
  /** Aggregated blockers */
  blockers: string[];
  /** Recommendations */
  recommendations: string[];
  /** Duration in ms */
  duration: number;
  /** Exit code */
  exitCode: number;
}

export interface ScanRunMetadata {
  /** ISO timestamp */
  timestamp: string;
  /** Workspace root used */
  workspaceRoot: string;
  /** CLI executable used */
  executable: string;
}

export interface ScanResult {
  result: ScanRunResult;
  metadata: ScanRunMetadata;
}

/** Empty/idle state before first run */
export function createEmptyScanResult(workspaceRoot: string): ScanResult {
  return {
    result: {
      verdict: 'NO_SHIP',
      score: 0,
      coverage: { specced: 0, total: 0 },
      mode: 'specless',
      files: [],
      blockers: [],
      recommendations: [],
      duration: 0,
      exitCode: 1,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      workspaceRoot,
      executable: '',
    },
  };
}

/** Map CLI verdict to extension verdict (normalize NO_SHIP vs NO-SHIP) */
export function normalizeVerdict(raw: string): Verdict {
  const u = (raw || '').toUpperCase().replace(/-/g, '_');
  if (u === 'SHIP') return 'SHIP';
  if (u === 'WARN') return 'WARN';
  if (u === 'NO_SHIP' || u === 'NOSHIP') return 'NO_SHIP';
  return 'NO_SHIP';
}
