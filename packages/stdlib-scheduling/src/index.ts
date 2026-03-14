/**
 * @isl-lang/stdlib-scheduling
 *
 * ISL standard library for scheduling and cron job contracts.
 * Defines types and constraints for scheduled tasks, recurring jobs,
 * execution guarantees, and deadline monitoring.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ScheduledJob {
  id: string;
  name: string;
  schedule: CronExpression | IntervalSchedule;
  handler: string;
  /** Maximum execution time before the job is killed */
  timeoutMs: number;
  /** Retry policy on failure */
  retryPolicy?: RetryPolicy;
  /** Concurrency control */
  concurrency?: ConcurrencyPolicy;
  /** Deadline: latest acceptable completion time after trigger */
  deadlineMs?: number;
  /** Job priority (higher = more important) */
  priority?: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export type CronExpression = string;

export interface IntervalSchedule {
  every: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';
  /** Jitter: random offset to prevent thundering herd (milliseconds) */
  jitterMs?: number;
}

export interface RetryPolicy {
  maxRetries: number;
  /** Backoff strategy */
  backoff: 'fixed' | 'exponential' | 'linear';
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay between retries */
  maxDelayMs?: number;
  /** Only retry on these error types */
  retryableErrors?: string[];
}

export interface ConcurrencyPolicy {
  /** Maximum concurrent executions of this job */
  maxConcurrent: number;
  /** What to do when max is reached */
  overflow: 'queue' | 'drop' | 'error';
  /** Lock timeout (for distributed locks) */
  lockTimeoutMs?: number;
}

// ============================================================================
// Execution tracking
// ============================================================================

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed-out'
  | 'cancelled'
  | 'skipped';

export interface JobExecution {
  id: string;
  jobId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  attempt: number;
  error?: string;
  result?: unknown;
  /** Which node/worker executed this */
  workerId?: string;
}

export interface JobHealthMetrics {
  jobId: string;
  /** Success rate over the last N executions */
  successRate: number;
  /** Average duration in milliseconds */
  avgDurationMs: number;
  /** p95 duration */
  p95DurationMs: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Last successful execution */
  lastSuccessAt?: string;
  /** Last failure */
  lastFailureAt?: string;
  /** Is the job overdue (missed its schedule) */
  isOverdue: boolean;
}

// ============================================================================
// Scheduler contract (for ISL specs)
// ============================================================================

export interface SchedulerContract {
  /** All registered jobs */
  jobs: ScheduledJob[];
  /** Global execution constraints */
  constraints?: SchedulerConstraints;
  /** Monitoring requirements */
  monitoring?: MonitoringPolicy;
}

export interface SchedulerConstraints {
  /** Maximum total concurrent jobs across all job types */
  maxTotalConcurrent?: number;
  /** Minimum interval between any two job starts (thundering herd prevention) */
  minIntervalMs?: number;
  /** Timezone for cron expressions */
  timezone?: string;
  /** Maintenance windows: periods where no jobs run */
  maintenanceWindows?: Array<{ start: string; end: string; days?: number[] }>;
}

export interface MonitoringPolicy {
  /** Alert when a job has been failing for this many consecutive runs */
  alertAfterConsecutiveFailures?: number;
  /** Alert when a job's duration exceeds this multiple of its average */
  alertOnSlowExecution?: number;
  /** Alert when a job is overdue by this many milliseconds */
  alertOnOverdueMs?: number;
  /** Channels to send alerts to */
  alertChannels?: string[];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a cron expression for basic correctness.
 * Supports standard 5-field (minute hour dom month dow) format.
 */
export function validateCron(expr: CronExpression): { valid: boolean; error?: string } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return { valid: false, error: `Expected 5-6 fields, got ${parts.length}` };
  }

  const ranges = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day of month', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12 },
    { name: 'day of week', min: 0, max: 7 },
  ];

  for (let i = 0; i < Math.min(parts.length, 5); i++) {
    const part = parts[i]!;
    const range = ranges[i]!;

    if (part === '*') continue;

    const numMatch = part.match(/^(\d+)$/);
    if (numMatch) {
      const val = parseInt(numMatch[1]!, 10);
      if (val < range.min || val > range.max) {
        return { valid: false, error: `${range.name}: ${val} out of range [${range.min}-${range.max}]` };
      }
    }
  }

  return { valid: true };
}

/**
 * Calculate the next N execution times for a given interval schedule.
 */
export function nextExecutions(
  schedule: IntervalSchedule,
  count: number,
  from: Date = new Date(),
): Date[] {
  const unitMs: Record<string, number> = {
    seconds: 1000,
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
    weeks: 604_800_000,
  };

  const intervalMs = schedule.every * (unitMs[schedule.unit] ?? 60_000);
  const results: Date[] = [];
  let current = from.getTime();

  for (let i = 0; i < count; i++) {
    current += intervalMs;
    const jitter = schedule.jitterMs
      ? Math.floor(Math.random() * schedule.jitterMs)
      : 0;
    results.push(new Date(current + jitter));
  }

  return results;
}

/**
 * Check if a job's health metrics indicate a problem.
 */
export function isJobHealthy(metrics: JobHealthMetrics, policy?: MonitoringPolicy): {
  healthy: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (metrics.isOverdue) {
    issues.push('Job is overdue');
  }

  if (policy?.alertAfterConsecutiveFailures && metrics.consecutiveFailures >= policy.alertAfterConsecutiveFailures) {
    issues.push(`${metrics.consecutiveFailures} consecutive failures`);
  }

  if (metrics.successRate < 0.9) {
    issues.push(`Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
  }

  return { healthy: issues.length === 0, issues };
}
