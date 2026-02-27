export type Verdict = 'SHIP' | 'WARN' | 'NO_SHIP';
export type RunStatus = 'success' | 'failure' | 'running' | 'pending';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type EnvStatus = 'protected' | 'gated' | 'open';

export interface WorkflowRun {
  id: string;
  name: string;
  event: string;
  branch: string;
  status: RunStatus;
  duration: string;
  time: string;
  pr: string;
  author: string;
  commit: string;
  commitMsg: string;
  jobs: Job[];
  verdict: Verdict | null;
  score: number | null;
  blockers?: string[];
}

export interface Job {
  name: string;
  status: RunStatus;
  duration: string;
}

export interface PullRequest {
  number: number;
  title: string;
  author: string;
  branch: string;
  verdict: Verdict | null;
  score: number | null;
  filesChanged: number;
  opened: string;
  checks: StatusCheck[];
}

export interface StatusCheck {
  name: string;
  status: 'pass' | 'fail' | 'running' | 'pending';
}

export interface Environment {
  name: string;
  url: string;
  status: EnvStatus;
  lastDeploy: {
    commit: string;
    verdict: Verdict;
    score: number;
    time: string;
    author: string;
  };
  rules: string[];
  history: number[];
}

export interface Finding {
  id: string;
  severity: Severity;
  engine: string;
  message: string;
  file: string;
  line: number;
  pr: string;
  fixable: boolean;
}

export interface TeamMember {
  name: string;
  role: string;
  scans: number;
  shipRate: number;
  topIssue: string;
  avatar: string;
  streak: number;
}

export interface TimelineEvent {
  id: string;
  time: string;
  type: 'ship' | 'noship' | 'deploy' | 'running' | 'fix' | 'alert';
  message: string;
  detail: string;
  author: string;
}

export interface Webhook {
  id: string;
  event: string;
  url: string;
  status: 'active' | 'paused';
  lastFired: string;
}

export interface SummaryCard {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: string;
}
