export type RaceType =
  | 'shared-mutable-state'
  | 'toctou'
  | 'unguarded-async'
  | 'database-race'
  | 'event-loop-starvation';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface RaceFinding {
  type: RaceType;
  severity: Severity;
  file: string;
  line: number;
  description: string;
  pattern: string;
  remediation: string;
}

export interface RaceDetectorConfig {
  projectRoot: string;
  files?: string[];
  checkDatabase?: boolean;
  checkSharedState?: boolean;
}

export interface AnalyzerResult {
  findings: RaceFinding[];
}

export interface Analyzer {
  name: string;
  analyze(sourceFile: import('typescript').SourceFile, filePath: string): RaceFinding[];
}
