/**
 * ISL Verify CLI — Shared types
 */

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  checker: string;
  ruleId: string;
  severity: FindingSeverity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  blocking: boolean;
  recommendation?: string;
  snippet?: string;
  context?: Record<string, unknown>;
}

export interface ScanReport {
  projectRoot: string;
  framework: string;
  orm: string;
  fileCount: number;
  trustScore: number;
  verdict: 'SHIP' | 'REVIEW' | 'NO_SHIP';
  findings: Finding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  durationMs: number;
  timestamp: string;
}

export interface IslVerifyConfig {
  projectRoot?: string;
  sourceDirs?: string[];
  exclude?: string[];
  truthpackPath?: string;
  threshold?: number;
  verbose?: boolean;
}
