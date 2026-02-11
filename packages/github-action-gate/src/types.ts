/**
 * GitHub Action Gate - Type Definitions
 */

export interface ActionInputs {
  /** Gate mode: check (PR comment only) or enforce (block merge) */
  mode: 'check' | 'enforce';
  /** Minimum score to pass (0-100) */
  threshold: number;
  /** Path to .islstudio/config.json */
  configPath: string;
  /** Fail on: any, blocker, none */
  failOn: 'any' | 'blocker' | 'none';
  /** GitHub token */
  token: string;
  /** Repository path */
  repositoryPath: string;
  /** Only check changed files (PR only) */
  changedOnly: boolean;
  /** Enable PR comments */
  enableComment: boolean;
  /** Enable check run annotations */
  enableCheckRun: boolean;
}

export interface ActionOutputs {
  /** SHIP or NO_SHIP */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Score out of 100 */
  score: number;
  /** Number of violations found */
  violations: number;
  /** Path to evidence directory */
  evidencePath: string;
  /** Detailed report */
  report?: GateReport;
}

export interface GateReport {
  /** Verdict from the gate */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Overall score 0-100 */
  score: number;
  /** Total findings */
  totalFindings: number;
  /** Findings by severity */
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Individual findings */
  findings: Finding[];
  /** Evidence fingerprint */
  fingerprint?: string;
  /** Execution duration */
  durationMs: number;
}

export interface Finding {
  /** Unique ID */
  id: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Rule ID */
  ruleId: string;
  /** Message */
  message: string;
  /** File path */
  filePath?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Whether this finding blocks SHIP */
  blocking: boolean;
  /** Source of the finding */
  source: string;
}

export interface GitHubContext {
  /** Event name */
  eventName: string;
  /** SHA */
  sha: string;
  /** Ref */
  ref: string;
  /** Repository */
  repository: {
    owner: string;
    repo: string;
  };
  /** Pull request number (if applicable) */
  pullRequest?: {
    number: number;
    baseSha: string;
    headSha: string;
  };
  /** Actor */
  actor: string;
  /** Run ID */
  runId: number;
  /** Server URL */
  serverUrl: string;
  /** API URL */
  apiUrl: string;
}

export interface CheckRunAnnotation {
  /** Path to file */
  path: string;
  /** Start line */
  start_line: number;
  /** End line */
  end_line: number;
  /** Annotation level */
  annotation_level: 'notice' | 'warning' | 'failure';
  /** Message */
  message: string;
  /** Title */
  title?: string;
  /** Start column */
  start_column?: number;
  /** End column */
  end_column?: number;
}

export interface CommentOptions {
  /** Find existing comment and update it */
  upsert: boolean;
  /** Comment marker to identify existing comments */
  marker: string;
}
