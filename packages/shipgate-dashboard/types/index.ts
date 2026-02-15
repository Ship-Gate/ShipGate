export type Verdict = 'SHIP' | 'WARN' | 'NO_SHIP';

export interface Repo {
  id: string;
  name: string;
  verdict: Verdict;
  score: number;
  claims: number;
  issues: number;
  lastScan: string;
  trend: number[];  // 7 data points for sparkline
}

export interface Scan {
  id: string;
  repo: string;
  commit: string;
  verdict: Verdict;
  author: string;
  time: string;
  pr: string;
}

export interface ComplianceControl {
  id: string;        // e.g., "CC6.1"
  name: string;
  repos: number;
  satisfied: number;
  partial: number;
}

export interface ProvenanceData {
  tool: string;
  count: number;
  color: string;
}

export interface DashboardData {
  repos: Repo[];
  recentScans: Scan[];
  compliance: ComplianceControl[];
  provenance: ProvenanceData[];
  summary: {
    verifiedRepos: number;
    totalClaims: number;
    openIssues: number;
    soc2Coverage: number;
  };
}
