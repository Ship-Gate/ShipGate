import type { TrafficSample, Anomaly, ViolationSeverity } from './types.js';

// ---------------------------------------------------------------------------
// Rolling window for numeric time-series
// ---------------------------------------------------------------------------

class RollingWindow {
  private readonly maxSize: number;
  private readonly values: number[] = [];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  get length(): number {
    return this.values.length;
  }

  mean(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  /** Population standard deviation */
  stddev(): number {
    if (this.values.length < 2) return 0;
    const avg = this.mean();
    const sumSqDiff = this.values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
    return Math.sqrt(sumSqDiff / this.values.length);
  }

  /** Z-score for a given value relative to this window. */
  zScore(value: number): number {
    const sd = this.stddev();
    if (sd === 0) return 0;
    return (value - this.mean()) / sd;
  }

  /** Return the sorted snapshot (non-destructive). */
  sorted(): number[] {
    return [...this.values].sort((a, b) => a - b);
  }

  percentile(p: number): number {
    if (this.values.length === 0) return 0;
    const s = this.sorted();
    const idx = Math.ceil((p / 100) * s.length) - 1;
    return s[Math.max(0, idx)];
  }

  last(): number | undefined {
    return this.values[this.values.length - 1];
  }

  toArray(): number[] {
    return [...this.values];
  }
}

// ---------------------------------------------------------------------------
// Bucketed rate tracker (counts events per time bucket)
// ---------------------------------------------------------------------------

class RateTracker {
  private readonly bucketMs: number;
  private readonly maxBuckets: number;
  private buckets: Array<{ start: number; total: number; hits: number }> = [];

  constructor(bucketMs = 60_000, maxBuckets = 60) {
    this.bucketMs = bucketMs;
    this.maxBuckets = maxBuckets;
  }

  record(timestamp: number, isHit: boolean): void {
    const bucketStart = Math.floor(timestamp / this.bucketMs) * this.bucketMs;
    let bucket = this.buckets[this.buckets.length - 1];

    if (!bucket || bucket.start !== bucketStart) {
      bucket = { start: bucketStart, total: 0, hits: 0 };
      this.buckets.push(bucket);
      if (this.buckets.length > this.maxBuckets) {
        this.buckets.shift();
      }
    }

    bucket.total++;
    if (isHit) bucket.hits++;
  }

  /** Rolling rate (hits / total) across all tracked buckets. */
  rate(): number {
    const totals = this.buckets.reduce((s, b) => s + b.total, 0);
    if (totals === 0) return 0;
    return this.buckets.reduce((s, b) => s + b.hits, 0) / totals;
  }

  /** Per-bucket rates as a numeric array for statistical analysis. */
  bucketRates(): number[] {
    return this.buckets
      .filter((b) => b.total > 0)
      .map((b) => b.hits / b.total);
  }

  recentRate(n = 5): number {
    const recent = this.buckets.slice(-n);
    const total = recent.reduce((s, b) => s + b.total, 0);
    if (total === 0) return 0;
    return recent.reduce((s, b) => s + b.hits, 0) / total;
  }

  historicalRate(n = 30): number {
    const history = this.buckets.slice(0, -5);
    if (history.length === 0) return this.rate();
    const total = history.reduce((s, b) => s + b.total, 0);
    if (total === 0) return 0;
    return history.slice(-n).reduce((s, b) => s + b.hits, 0) / total;
  }
}

// ---------------------------------------------------------------------------
// Shape fingerprinting (tracks response body key sets)
// ---------------------------------------------------------------------------

class ShapeTracker {
  private readonly shapeCounts = new Map<string, number>();
  private totalSamples = 0;

  record(body: unknown): void {
    if (!body || typeof body !== 'object') return;
    this.totalSamples++;
    const fingerprint = this.fingerprint(body as Record<string, unknown>);
    this.shapeCounts.set(fingerprint, (this.shapeCounts.get(fingerprint) ?? 0) + 1);
  }

  /**
   * Chi-squared goodness-of-fit test against a uniform distribution
   * of observed shapes. A high value indicates unexpected new shapes.
   *
   * Returns the chi-squared statistic divided by degrees of freedom
   * (reduced chi-squared) so the value is independent of sample size.
   */
  chiSquaredReduced(): number {
    if (this.shapeCounts.size < 2 || this.totalSamples < 10) return 0;

    const expected = this.totalSamples / this.shapeCounts.size;
    let chiSq = 0;
    for (const count of this.shapeCounts.values()) {
      chiSq += (count - expected) ** 2 / expected;
    }

    const dof = this.shapeCounts.size - 1;
    return dof > 0 ? chiSq / dof : 0;
  }

  /** Fraction of samples with the dominant shape. */
  dominantShapeFraction(): number {
    if (this.totalSamples === 0) return 1;
    let max = 0;
    for (const count of this.shapeCounts.values()) {
      if (count > max) max = count;
    }
    return max / this.totalSamples;
  }

  get uniqueShapes(): number {
    return this.shapeCounts.size;
  }

  private fingerprint(obj: Record<string, unknown>): string {
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const val = obj[key];
      let type = typeof val;
      if (val === null) type = 'null' as typeof type;
      else if (Array.isArray(val)) type = 'array' as typeof type;
      parts.push(`${key}:${type}`);
    }
    return parts.join('|');
  }
}

// ---------------------------------------------------------------------------
// Anomaly detector
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_SIZE = 1_000;
const Z_SCORE_THRESHOLD = 3.0;
const SCHEMA_DRIFT_DOMINANT_THRESHOLD = 0.7;
const ERROR_RATE_INCREASE_FACTOR = 2.0;
const MIN_SAMPLES_FOR_DETECTION = 30;
const TRAFFIC_RATE_Z_THRESHOLD = 2.5;

/**
 * Detects statistical anomalies in production traffic.
 *
 * Maintains rolling windows for latency, error rates, and response
 * shapes, using z-scores and chi-squared statistics to flag unusual
 * patterns.
 */
export class AnomalyDetector {
  private readonly latencyWindow: RollingWindow;
  private readonly errorTracker: RateTracker;
  private readonly shapeTrackers = new Map<string, ShapeTracker>();
  private readonly requestRateWindow: RollingWindow;
  private sampleCount = 0;
  private lastAnomalyCheck = 0;

  constructor(windowSize = DEFAULT_WINDOW_SIZE) {
    this.latencyWindow = new RollingWindow(windowSize);
    this.errorTracker = new RateTracker();
    this.requestRateWindow = new RollingWindow(windowSize);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  addSample(sample: TrafficSample): void {
    this.sampleCount++;
    this.latencyWindow.push(sample.latencyMs);
    this.errorTracker.record(sample.timestamp, sample.statusCode >= 500);
    this.requestRateWindow.push(sample.timestamp);

    const routeTracker = this.getShapeTracker(sample.route);
    routeTracker.record(sample.responseBody);
  }

  detectAnomalies(): Anomaly[] {
    const now = Date.now();
    this.lastAnomalyCheck = now;

    if (this.sampleCount < MIN_SAMPLES_FOR_DETECTION) return [];

    const anomalies: Anomaly[] = [];

    this.detectLatencySpike(anomalies, now);
    this.detectErrorRateIncrease(anomalies, now);
    this.detectSchemaDrift(anomalies, now);
    this.detectTrafficPatternChange(anomalies, now);

    return anomalies;
  }

  /** Expose current latency stats for reporting. */
  get latencyStats(): { mean: number; p50: number; p95: number; p99: number; stddev: number } {
    return {
      mean: this.latencyWindow.mean(),
      p50: this.latencyWindow.percentile(50),
      p95: this.latencyWindow.percentile(95),
      p99: this.latencyWindow.percentile(99),
      stddev: this.latencyWindow.stddev(),
    };
  }

  get errorRate(): number {
    return this.errorTracker.rate();
  }

  get totalSamples(): number {
    return this.sampleCount;
  }

  // -----------------------------------------------------------------------
  // Detection methods
  // -----------------------------------------------------------------------

  /**
   * Latency spike: the most recent latency value has a z-score
   * exceeding the threshold relative to the rolling window.
   */
  private detectLatencySpike(anomalies: Anomaly[], now: number): void {
    const latest = this.latencyWindow.last();
    if (latest === undefined) return;

    const z = this.latencyWindow.zScore(latest);
    if (Math.abs(z) < Z_SCORE_THRESHOLD) return;

    const mean = this.latencyWindow.mean();
    const severity = this.zScoreToSeverity(z);

    anomalies.push({
      type: 'latency-spike',
      severity,
      details:
        `Latency ${Math.round(latest)}ms is ${z.toFixed(1)} standard deviations ` +
        `from the rolling mean of ${Math.round(mean)}ms`,
      detectedAt: now,
    });
  }

  /**
   * Error rate increase: compare the recent error rate (last 5 buckets)
   * to the historical rate. Flag if it has increased by more than 2x.
   */
  private detectErrorRateIncrease(anomalies: Anomaly[], now: number): void {
    const recent = this.errorTracker.recentRate();
    const historical = this.errorTracker.historicalRate();

    if (historical === 0 && recent === 0) return;

    const increase = historical > 0 ? recent / historical : recent > 0 ? Infinity : 0;

    if (increase < ERROR_RATE_INCREASE_FACTOR) return;

    const severity: ViolationSeverity =
      recent > 0.1 ? 'critical' : recent > 0.05 ? 'high' : 'medium';

    anomalies.push({
      type: 'error-rate-increase',
      severity,
      details:
        `Error rate increased to ${(recent * 100).toFixed(1)}% ` +
        `(historical: ${(historical * 100).toFixed(1)}%), ` +
        `a ${increase === Infinity ? '∞' : increase.toFixed(1)}x increase`,
      detectedAt: now,
    });
  }

  /**
   * Schema drift: if the dominant response shape for any route drops
   * below the threshold, it means new response shapes are appearing.
   */
  private detectSchemaDrift(anomalies: Anomaly[], now: number): void {
    for (const [route, tracker] of this.shapeTrackers) {
      if (tracker.uniqueShapes < 2) continue;

      const dominant = tracker.dominantShapeFraction();
      if (dominant >= SCHEMA_DRIFT_DOMINANT_THRESHOLD) continue;

      anomalies.push({
        type: 'schema-drift',
        severity: dominant < 0.5 ? 'high' : 'medium',
        details:
          `Route ${route}: dominant response shape is only ${(dominant * 100).toFixed(0)}% ` +
          `of traffic (${tracker.uniqueShapes} distinct shapes observed)`,
        detectedAt: now,
      });
    }
  }

  /**
   * Traffic pattern change: detect unusual gaps or bursts in request
   * timestamps using z-score on inter-arrival times.
   */
  private detectTrafficPatternChange(anomalies: Anomaly[], now: number): void {
    const timestamps = this.requestRateWindow.toArray();
    if (timestamps.length < MIN_SAMPLES_FOR_DETECTION) return;

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    if (intervals.length < 10) return;

    const intervalWindow = new RollingWindow(intervals.length);
    for (const iv of intervals) intervalWindow.push(iv);

    const latest = intervals[intervals.length - 1];
    const z = intervalWindow.zScore(latest);

    if (Math.abs(z) < TRAFFIC_RATE_Z_THRESHOLD) return;

    anomalies.push({
      type: 'traffic-pattern-change',
      severity: this.zScoreToSeverity(z),
      details:
        `Inter-arrival time ${Math.round(latest)}ms has z-score ${z.toFixed(1)} ` +
        `(mean: ${Math.round(intervalWindow.mean())}ms, ` +
        `stddev: ${Math.round(intervalWindow.stddev())}ms)`,
      detectedAt: now,
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private getShapeTracker(route: string): ShapeTracker {
    let tracker = this.shapeTrackers.get(route);
    if (!tracker) {
      tracker = new ShapeTracker();
      this.shapeTrackers.set(route, tracker);
    }
    return tracker;
  }

  private zScoreToSeverity(z: number): ViolationSeverity {
    const abs = Math.abs(z);
    if (abs >= 5) return 'critical';
    if (abs >= 4) return 'high';
    if (abs >= 3) return 'medium';
    return 'low';
  }
}
