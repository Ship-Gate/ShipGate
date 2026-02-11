import { z } from 'zod';

// ── Verdict enums ──────────────────────────────────────────────────────

export const VerdictSchema = z.enum(['SHIP', 'WARN', 'NO_SHIP']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const FileVerdictSchema = z.enum(['pass', 'warn', 'fail']);
export type FileVerdict = z.infer<typeof FileVerdictSchema>;

export const MethodSchema = z.enum(['isl', 'specless']);
export type Method = z.infer<typeof MethodSchema>;

export const TriggerSchema = z.enum(['ci', 'cli', 'vscode']);
export type Trigger = z.infer<typeof TriggerSchema>;

// ── File result ────────────────────────────────────────────────────────

export const FileResultSchema = z.object({
  path: z.string().min(1),
  verdict: FileVerdictSchema,
  method: MethodSchema,
  score: z.number().min(0).max(100),
  violations: z.array(z.string()),
});

export type FileResult = z.infer<typeof FileResultSchema>;

// ── Coverage ───────────────────────────────────────────────────────────

export const CoverageSchema = z.object({
  specced: z.number().int().min(0),
  total: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

export type Coverage = z.infer<typeof CoverageSchema>;

// ── Verification report ────────────────────────────────────────────────

export const CreateReportSchema = z.object({
  repo: z.string().min(1),
  branch: z.string().min(1),
  commit: z.string().min(1),
  pr: z.number().int().positive().optional(),
  verdict: VerdictSchema,
  score: z.number().min(0).max(100),
  coverage: CoverageSchema,
  files: z.array(FileResultSchema).min(1),
  duration: z.number().int().min(0),
  triggeredBy: TriggerSchema,
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export interface VerificationReport extends CreateReportInput {
  id: string;
  timestamp: string; // ISO 8601
}

// ── Query params ───────────────────────────────────────────────────────

export const ListReportsQuerySchema = z.object({
  repo: z.string().optional(),
  branch: z.string().optional(),
  verdict: VerdictSchema.optional(),
  triggeredBy: TriggerSchema.optional(),
  q: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListReportsQuery = z.infer<typeof ListReportsQuerySchema>;

export const TrendsQuerySchema = z.object({
  repo: z.string().min(1),
  branch: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type TrendsQuery = z.infer<typeof TrendsQuerySchema>;

export const DriftQuerySchema = z.object({
  repo: z.string().min(1),
  threshold: z.coerce.number().min(0).max(100).default(5),
});

export type DriftQuery = z.infer<typeof DriftQuerySchema>;

// ── API response wrappers ──────────────────────────────────────────────

export interface ApiResponse<T> {
  ok: true;
  data: T;
}

export interface PaginatedResponse<T> {
  ok: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

// ── Trend / drift shapes ──────────────────────────────────────────────

export interface TrendPoint {
  date: string;
  avgScore: number;
  reportCount: number;
  coveragePercentage: number;
}

export interface DriftAlert {
  repo: string;
  branch: string;
  currentScore: number;
  previousScore: number;
  delta: number;
  direction: 'improving' | 'degrading';
  commit: string;
  timestamp: string;
}

export interface CoverageSummary {
  repo: string;
  totalFiles: number;
  speccedFiles: number;
  coveragePercentage: number;
  byMethod: {
    isl: number;
    specless: number;
  };
  lastUpdated: string;
}

export interface ReportDiff {
  current: VerificationReport;
  previous: VerificationReport | null;
  newFailures: FileResult[];
  resolved: FileResult[];
}
