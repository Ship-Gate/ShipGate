/**
 * Performance Comparison
 * 
 * Compare performance metrics across multiple implementations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Performance metrics for a single implementation */
export interface PerformanceMetrics {
  /** 50th percentile latency in ms */
  latencyP50: number;
  /** 95th percentile latency in ms */
  latencyP95: number;
  /** 99th percentile latency in ms */
  latencyP99: number;
  /** Minimum latency in ms */
  latencyMin: number;
  /** Maximum latency in ms */
  latencyMax: number;
  /** Mean latency in ms */
  latencyMean: number;
  /** Standard deviation of latency */
  latencyStdDev: number;
  /** Memory usage in MB */
  memoryMB: number;
  /** Peak memory usage in MB */
  memoryPeakMB: number;
  /** Requests per second */
  throughputRPS: number;
  /** Total invocations measured */
  invocations: number;
  /** Total errors during benchmark */
  errors: number;
  /** Error rate percentage */
  errorRate: number;
}

/** Result of performance comparison */
export interface PerformanceResult {
  /** Metrics by implementation name */
  byImplementation: Map<string, PerformanceMetrics>;
  /** Name of the best performing implementation */
  winner: string;
  /** Winning margin percentage */
  margin: number;
  /** Detailed rankings by different criteria */
  rankings: PerformanceRankings;
  /** Comparison summary */
  summary: PerformanceSummary;
}

/** Rankings by different performance criteria */
export interface PerformanceRankings {
  /** Ranked by p50 latency (lowest first) */
  byLatencyP50: string[];
  /** Ranked by p99 latency (lowest first) */
  byLatencyP99: string[];
  /** Ranked by throughput (highest first) */
  byThroughput: string[];
  /** Ranked by memory usage (lowest first) */
  byMemory: string[];
  /** Overall ranking (weighted) */
  overall: string[];
}

/** Performance comparison summary */
export interface PerformanceSummary {
  /** Fastest implementation for p50 */
  fastestP50: { name: string; value: number };
  /** Fastest implementation for p99 */
  fastestP99: { name: string; value: number };
  /** Highest throughput */
  highestThroughput: { name: string; value: number };
  /** Lowest memory */
  lowestMemory: { name: string; value: number };
  /** Spread in performance (max/min ratio) */
  performanceSpread: number;
}

/** Options for performance benchmarking */
export interface PerformanceOptions {
  /** Number of warmup iterations */
  warmupIterations?: number;
  /** Number of benchmark iterations */
  benchmarkIterations?: number;
  /** Timeout per invocation in ms */
  timeout?: number;
  /** Whether to measure memory */
  measureMemory?: boolean;
  /** Weights for overall ranking */
  rankingWeights?: RankingWeights;
}

/** Weights for calculating overall ranking */
export interface RankingWeights {
  latencyP50?: number;
  latencyP99?: number;
  throughput?: number;
  memory?: number;
}

/** Raw timing data from a single invocation */
export interface TimingData {
  duration: number;
  memoryBefore?: number;
  memoryAfter?: number;
  error?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * Calculate mean of values
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance Measurement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate metrics from raw timing data
 */
export function calculateMetrics(timings: TimingData[]): PerformanceMetrics {
  const durations = timings.filter(t => !t.error).map(t => t.duration);
  const sortedDurations = [...durations].sort((a, b) => a - b);
  
  const errors = timings.filter(t => t.error).length;
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  // Memory calculations
  const memoryUsages = timings
    .filter(t => t.memoryAfter !== undefined && t.memoryBefore !== undefined)
    .map(t => (t.memoryAfter! - t.memoryBefore!) / 1024 / 1024); // Convert to MB
  
  const memoryPeaks = timings
    .filter(t => t.memoryAfter !== undefined)
    .map(t => t.memoryAfter! / 1024 / 1024);

  return {
    latencyP50: percentile(sortedDurations, 50),
    latencyP95: percentile(sortedDurations, 95),
    latencyP99: percentile(sortedDurations, 99),
    latencyMin: sortedDurations[0] ?? 0,
    latencyMax: sortedDurations[sortedDurations.length - 1] ?? 0,
    latencyMean: mean(durations),
    latencyStdDev: stdDev(durations),
    memoryMB: mean(memoryUsages) || 0,
    memoryPeakMB: Math.max(...memoryPeaks, 0),
    throughputRPS: totalDuration > 0 ? (durations.length / totalDuration) * 1000 : 0,
    invocations: timings.length,
    errors,
    errorRate: timings.length > 0 ? (errors / timings.length) * 100 : 0,
  };
}

/**
 * Benchmark a single function
 */
export async function benchmark(
  fn: () => Promise<unknown> | unknown,
  options: PerformanceOptions = {}
): Promise<TimingData[]> {
  const warmup = options.warmupIterations ?? 10;
  const iterations = options.benchmarkIterations ?? 100;
  const timeout = options.timeout ?? 5000;
  const measureMemory = options.measureMemory ?? false;

  // Warmup
  for (let i = 0; i < warmup; i++) {
    try {
      await Promise.race([
        Promise.resolve(fn()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
      ]);
    } catch {
      // Ignore warmup errors
    }
  }

  // Force GC if available
  if (global.gc) {
    global.gc();
  }

  // Benchmark
  const timings: TimingData[] = [];

  for (let i = 0; i < iterations; i++) {
    const memoryBefore = measureMemory ? process.memoryUsage().heapUsed : undefined;
    const start = performance.now();
    let error = false;

    try {
      await Promise.race([
        Promise.resolve(fn()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
      ]);
    } catch {
      error = true;
    }

    const duration = performance.now() - start;
    const memoryAfter = measureMemory ? process.memoryUsage().heapUsed : undefined;

    timings.push({ duration, memoryBefore, memoryAfter, error });
  }

  return timings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare performance across multiple implementations
 */
export function comparePerformance(
  metricsMap: Map<string, PerformanceMetrics>,
  options: PerformanceOptions = {}
): PerformanceResult {
  const weights: RankingWeights = {
    latencyP50: 0.3,
    latencyP99: 0.3,
    throughput: 0.25,
    memory: 0.15,
    ...options.rankingWeights,
  };

  const implNames = Array.from(metricsMap.keys());

  // Calculate rankings for each criteria
  const byLatencyP50 = [...implNames].sort((a, b) => 
    (metricsMap.get(a)?.latencyP50 ?? Infinity) - (metricsMap.get(b)?.latencyP50 ?? Infinity)
  );

  const byLatencyP99 = [...implNames].sort((a, b) =>
    (metricsMap.get(a)?.latencyP99 ?? Infinity) - (metricsMap.get(b)?.latencyP99 ?? Infinity)
  );

  const byThroughput = [...implNames].sort((a, b) =>
    (metricsMap.get(b)?.throughputRPS ?? 0) - (metricsMap.get(a)?.throughputRPS ?? 0)
  );

  const byMemory = [...implNames].sort((a, b) =>
    (metricsMap.get(a)?.memoryMB ?? Infinity) - (metricsMap.get(b)?.memoryMB ?? Infinity)
  );

  // Calculate overall scores
  const scores = new Map<string, number>();
  for (const name of implNames) {
    const p50Rank = byLatencyP50.indexOf(name);
    const p99Rank = byLatencyP99.indexOf(name);
    const throughputRank = byThroughput.indexOf(name);
    const memoryRank = byMemory.indexOf(name);

    // Lower rank is better, convert to score (higher is better)
    const maxRank = implNames.length - 1;
    const score = 
      (weights.latencyP50 ?? 0) * (maxRank - p50Rank) +
      (weights.latencyP99 ?? 0) * (maxRank - p99Rank) +
      (weights.throughput ?? 0) * (maxRank - throughputRank) +
      (weights.memory ?? 0) * (maxRank - memoryRank);

    scores.set(name, score);
  }

  const overall = [...implNames].sort((a, b) => 
    (scores.get(b) ?? 0) - (scores.get(a) ?? 0)
  );

  const winner = overall[0];
  const winnerScore = scores.get(winner) ?? 0;
  const runnerUpScore = scores.get(overall[1]) ?? 0;
  const margin = runnerUpScore > 0 
    ? ((winnerScore - runnerUpScore) / runnerUpScore) * 100 
    : 100;

  // Calculate summary
  const allP50 = implNames.map(n => metricsMap.get(n)?.latencyP50 ?? 0);
  const performanceSpread = Math.max(...allP50) / Math.min(...allP50.filter(v => v > 0));

  const fastestP50Name = byLatencyP50[0];
  const fastestP99Name = byLatencyP99[0];
  const highestThroughputName = byThroughput[0];
  const lowestMemoryName = byMemory[0];

  return {
    byImplementation: metricsMap,
    winner,
    margin,
    rankings: {
      byLatencyP50,
      byLatencyP99,
      byThroughput,
      byMemory,
      overall,
    },
    summary: {
      fastestP50: { 
        name: fastestP50Name, 
        value: metricsMap.get(fastestP50Name)?.latencyP50 ?? 0 
      },
      fastestP99: { 
        name: fastestP99Name, 
        value: metricsMap.get(fastestP99Name)?.latencyP99 ?? 0 
      },
      highestThroughput: { 
        name: highestThroughputName, 
        value: metricsMap.get(highestThroughputName)?.throughputRPS ?? 0 
      },
      lowestMemory: { 
        name: lowestMemoryName, 
        value: metricsMap.get(lowestMemoryName)?.memoryMB ?? 0 
      },
      performanceSpread,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format performance metrics for display
 */
export function formatMetrics(metrics: PerformanceMetrics): string {
  const lines: string[] = [
    `Latency:`,
    `  P50: ${metrics.latencyP50.toFixed(2)}ms`,
    `  P95: ${metrics.latencyP95.toFixed(2)}ms`,
    `  P99: ${metrics.latencyP99.toFixed(2)}ms`,
    `  Mean: ${metrics.latencyMean.toFixed(2)}ms (±${metrics.latencyStdDev.toFixed(2)}ms)`,
    `  Range: ${metrics.latencyMin.toFixed(2)}ms - ${metrics.latencyMax.toFixed(2)}ms`,
    ``,
    `Throughput: ${metrics.throughputRPS.toFixed(1)} req/s`,
    `Memory: ${metrics.memoryMB.toFixed(2)}MB (peak: ${metrics.memoryPeakMB.toFixed(2)}MB)`,
    ``,
    `Invocations: ${metrics.invocations} (${metrics.errors} errors, ${metrics.errorRate.toFixed(1)}%)`,
  ];
  return lines.join('\n');
}

/**
 * Format performance comparison as a table
 */
export function formatComparisonTable(result: PerformanceResult): string {
  const lines: string[] = [];
  const implNames = Array.from(result.byImplementation.keys());

  // Header
  lines.push('Implementation'.padEnd(20) + 'P50'.padStart(10) + 'P99'.padStart(10) + 
    'RPS'.padStart(12) + 'Memory'.padStart(10) + 'Rank'.padStart(6));
  lines.push('-'.repeat(68));

  // Rows
  for (const name of implNames) {
    const metrics = result.byImplementation.get(name)!;
    const rank = result.rankings.overall.indexOf(name) + 1;
    const isWinner = name === result.winner;
    
    const row = [
      (isWinner ? '★ ' : '  ') + name.slice(0, 16).padEnd(18),
      `${metrics.latencyP50.toFixed(1)}ms`.padStart(10),
      `${metrics.latencyP99.toFixed(1)}ms`.padStart(10),
      `${metrics.throughputRPS.toFixed(0)}/s`.padStart(12),
      `${metrics.memoryMB.toFixed(1)}MB`.padStart(10),
      `#${rank}`.padStart(6),
    ].join('');
    
    lines.push(row);
  }

  // Footer
  lines.push('-'.repeat(68));
  lines.push(`Winner: ${result.winner} (${result.margin.toFixed(1)}% margin)`);

  return lines.join('\n');
}
