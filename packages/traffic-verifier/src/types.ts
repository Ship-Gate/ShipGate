import type { ParseResult } from '@isl-lang/parser';

// ---------------------------------------------------------------------------
// Core traffic capture
// ---------------------------------------------------------------------------

export interface TrafficSample {
  requestId: string;
  timestamp: number;
  route: string;
  method: string;
  statusCode: number;
  requestBody?: unknown;
  responseBody?: unknown;
  latencyMs: number;
  headers: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Spec violation output
// ---------------------------------------------------------------------------

export type ViolationType =
  | 'schema'
  | 'auth'
  | 'status-code'
  | 'response-shape'
  | 'latency';

export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SpecViolation {
  sampleId: string;
  route: string;
  type: ViolationType;
  expected: string;
  actual: string;
  severity: ViolationSeverity;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AlertThresholds {
  violationRatePercent: number;
  latencyP99Ms: number;
  errorRatePercent: number;
}

export interface VerifierConfig {
  /** Fraction of requests to sample (0–1) */
  sampleRate: number;
  /** Directory containing .isl spec files */
  specDir: string;
  /** Maximum buffered samples before forced flush */
  maxBufferSize: number;
  /** Milliseconds between automatic flushes */
  flushIntervalMs: number;
  /** Optional HTTP endpoint to POST reports to */
  reportEndpoint?: string;
  /** Thresholds that trigger alerts */
  alertThresholds: AlertThresholds;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface TopViolation {
  route: string;
  type: ViolationType;
  count: number;
}

export interface TrafficStats {
  totalSampled: number;
  violations: number;
  violationRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  topViolations: TopViolation[];
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

export type AnomalyType =
  | 'latency-spike'
  | 'error-rate-increase'
  | 'schema-drift'
  | 'traffic-pattern-change';

export interface Anomaly {
  type: AnomalyType;
  severity: ViolationSeverity;
  details: string;
  detectedAt: number;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface TrafficReport {
  summary: string;
  violations: SpecViolation[];
  anomalies: Anomaly[];
  recommendations: string[];
  generatedAt: number;
}

// ---------------------------------------------------------------------------
// Parsed spec wrapper (re-export for convenience)
// ---------------------------------------------------------------------------

export type ParsedSpec = ParseResult;

// ---------------------------------------------------------------------------
// Express-compatible middleware types (no direct Express dependency)
// ---------------------------------------------------------------------------

export interface Request {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface Response {
  statusCode: number;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

export type NextFunction = (err?: unknown) => void;
export type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
