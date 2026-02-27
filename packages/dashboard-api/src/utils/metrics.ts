/**
 * Metrics collection utility
 * Simple in-memory metrics for now, can be replaced with prom-client
 */

interface MetricValue {
  value: number;
  timestamp: number;
}

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, MetricValue[]> = new Map();

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Set a gauge metric
   */
  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push({ value, timestamp: Date.now() });
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(name, values);
  }

  /**
   * Get all metrics as a JSON object
   */
  getMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; min: number; max: number; avg: number }>;
  } {
    const counters: Record<string, number> = {};
    for (const [name, value] of this.counters) {
      counters[name] = value;
    }

    const gauges: Record<string, number> = {};
    for (const [name, value] of this.gauges) {
      gauges[name] = value;
    }

    const histograms: Record<string, { count: number; min: number; max: number; avg: number }> =
      {};
    for (const [name, values] of this.histograms) {
      if (values.length === 0) {
        histograms[name] = { count: 0, min: 0, max: 0, avg: 0 };
        continue;
      }
      const nums = values.map((v) => v.value);
      histograms[name] = {
        count: values.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        avg: nums.reduce((a, b) => a + b, 0) / nums.length,
      };
    }

    return { counters, gauges, histograms };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Singleton instance
let metricsInstance: MetricsCollector | null = null;

export function getMetrics(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}
