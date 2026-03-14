import type {
  ContractViolation,
  ViolationStats,
  AssertionSeverity,
  AssertionType,
} from './types.js';

export class ViolationReporter {
  private buffer: ContractViolation[] = [];
  private stats: ViolationStats = {
    total: 0,
    bySeverity: { critical: 0, warning: 0 },
    byRoute: {},
    byType: { precondition: 0, postcondition: 0, invariant: 0 },
  };
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly reportEndpoint: string | undefined;
  private readonly logToConsole: boolean;

  constructor(options?: { reportEndpoint?: string; logViolations?: boolean; flushIntervalMs?: number }) {
    this.reportEndpoint = options?.reportEndpoint;
    this.logToConsole = options?.logViolations ?? true;

    if (options?.flushIntervalMs && options.flushIntervalMs > 0) {
      this.flushInterval = setInterval(() => {
        void this.flush();
      }, options.flushIntervalMs);
      if (this.flushInterval.unref) {
        this.flushInterval.unref();
      }
    }
  }

  addViolation(violation: ContractViolation): void {
    this.buffer.push(violation);
    this.stats.total++;
    this.stats.bySeverity[violation.severity]++;
    this.stats.byRoute[violation.route] = (this.stats.byRoute[violation.route] ?? 0) + 1;
    this.stats.byType[violation.assertionType]++;

    if (this.logToConsole) {
      const level = violation.severity === 'critical' ? 'error' : 'warn';
      console[level](
        `[runtime-monitor] ${violation.severity.toUpperCase()} violation on ${violation.method} ${violation.route}: ` +
        `${violation.assertionType} failed — ${violation.expression}`,
        { requestId: violation.requestId, actual: violation.actual, expected: violation.expected },
      );
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const violations = this.buffer.splice(0, this.buffer.length);

    if (this.reportEndpoint) {
      try {
        await fetch(this.reportEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ violations, stats: this.getStats() }),
        });
      } catch (err) {
        console.error('[runtime-monitor] Failed to report violations:', err);
        this.buffer.unshift(...violations);
      }
    }
  }

  getStats(): ViolationStats {
    return {
      total: this.stats.total,
      bySeverity: { ...this.stats.bySeverity },
      byRoute: { ...this.stats.byRoute },
      byType: { ...this.stats.byType },
    };
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  resetStats(): void {
    this.stats = {
      total: 0,
      bySeverity: { critical: 0, warning: 0 },
      byRoute: {},
      byType: { precondition: 0, postcondition: 0, invariant: 0 },
    };
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}
