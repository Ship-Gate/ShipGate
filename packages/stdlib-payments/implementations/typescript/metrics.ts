// ============================================================================
// Payment Metrics - Observability
// ============================================================================

import { PaymentStatus, PaymentErrorCode, Currency, WebhookProvider } from './types';

// ==========================================================================
// METRICS INTERFACE
// ==========================================================================

export interface PaymentMetrics {
  recordPaymentCreated(status: PaymentStatus, currency: Currency): void;
  recordPaymentLatency(latencyMs: number): void;
  recordPaymentError(errorCode: PaymentErrorCode): void;
  recordCapture(currency: Currency, amount: number): void;
  recordRefund(currency: Currency, amount: number): void;
  recordFraudRejection(currency: Currency): void;
  recordWebhookReceived(provider: WebhookProvider, eventType: string): void;
  recordWebhookProcessed(provider: WebhookProvider, eventType: string, success: boolean): void;
}

// ==========================================================================
// METRICS COLLECTOR
// ==========================================================================

export interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  labelNames: string[];
}

export class MetricsCollector implements PaymentMetrics {
  private readonly counters = new Map<string, Map<string, number>>();
  private readonly histograms = new Map<string, number[]>();
  private readonly gauges = new Map<string, Map<string, number>>();
  
  private readonly definitions: MetricDefinition[] = [
    {
      name: 'payments_created_total',
      type: 'counter',
      description: 'Total number of payments created',
      labelNames: ['status', 'currency'],
    },
    {
      name: 'payment_latency_ms',
      type: 'histogram',
      description: 'Payment creation latency in milliseconds',
      labelNames: [],
    },
    {
      name: 'payment_errors_total',
      type: 'counter',
      description: 'Total number of payment errors',
      labelNames: ['error_code'],
    },
    {
      name: 'captures_total',
      type: 'counter',
      description: 'Total number of captures',
      labelNames: ['currency'],
    },
    {
      name: 'capture_amount_total',
      type: 'counter',
      description: 'Total amount captured',
      labelNames: ['currency'],
    },
    {
      name: 'refunds_total',
      type: 'counter',
      description: 'Total number of refunds',
      labelNames: ['currency'],
    },
    {
      name: 'refund_amount_total',
      type: 'counter',
      description: 'Total amount refunded',
      labelNames: ['currency'],
    },
    {
      name: 'fraud_rejections_total',
      type: 'counter',
      description: 'Total number of fraud rejections',
      labelNames: ['currency'],
    },
    {
      name: 'webhooks_received_total',
      type: 'counter',
      description: 'Total number of webhooks received',
      labelNames: ['provider', 'event_type'],
    },
    {
      name: 'webhooks_processed_total',
      type: 'counter',
      description: 'Total number of webhooks processed',
      labelNames: ['provider', 'event_type', 'success'],
    },
  ];
  
  recordPaymentCreated(status: PaymentStatus, currency: Currency): void {
    this.incrementCounter('payments_created_total', {
      status,
      currency,
    });
  }
  
  recordPaymentLatency(latencyMs: number): void {
    this.recordHistogram('payment_latency_ms', latencyMs);
  }
  
  recordPaymentError(errorCode: PaymentErrorCode): void {
    this.incrementCounter('payment_errors_total', {
      error_code: errorCode,
    });
  }
  
  recordCapture(currency: Currency, amount: number): void {
    this.incrementCounter('captures_total', { currency });
    this.incrementCounter('capture_amount_total', { currency }, amount);
  }
  
  recordRefund(currency: Currency, amount: number): void {
    this.incrementCounter('refunds_total', { currency });
    this.incrementCounter('refund_amount_total', { currency }, amount);
  }
  
  recordFraudRejection(currency: Currency): void {
    this.incrementCounter('fraud_rejections_total', { currency });
  }
  
  recordWebhookReceived(provider: WebhookProvider, eventType: string): void {
    this.incrementCounter('webhooks_received_total', {
      provider,
      event_type: eventType,
    });
  }
  
  recordWebhookProcessed(
    provider: WebhookProvider,
    eventType: string,
    success: boolean
  ): void {
    this.incrementCounter('webhooks_processed_total', {
      provider,
      event_type: eventType,
      success: String(success),
    });
  }
  
  // ========================================================================
  // INTERNAL METHODS
  // ========================================================================
  
  private incrementCounter(
    name: string,
    labels: Record<string, string>,
    value = 1
  ): void {
    const labelKey = this.labelKey(labels);
    
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    
    const counter = this.counters.get(name)!;
    const current = counter.get(labelKey) ?? 0;
    counter.set(labelKey, current + value);
  }
  
  private recordHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    this.histograms.get(name)!.push(value);
  }
  
  private setGauge(
    name: string,
    labels: Record<string, string>,
    value: number
  ): void {
    const labelKey = this.labelKey(labels);
    
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    
    this.gauges.get(name)!.set(labelKey, value);
  }
  
  private labelKey(labels: Record<string, string>): string {
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([k, v]) => `${k}="${v}"`).join(',');
  }
  
  // ========================================================================
  // EXPORT METHODS
  // ========================================================================
  
  getCounterValue(name: string, labels: Record<string, string>): number {
    const counter = this.counters.get(name);
    if (!counter) return 0;
    return counter.get(this.labelKey(labels)) ?? 0;
  }
  
  getHistogramStats(name: string): HistogramStats | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      mean: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }
  
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    
    for (const def of this.definitions) {
      lines.push(`# HELP ${def.name} ${def.description}`);
      lines.push(`# TYPE ${def.name} ${def.type}`);
      
      if (def.type === 'counter') {
        const counter = this.counters.get(def.name);
        if (counter) {
          for (const [labels, value] of counter) {
            const labelStr = labels ? `{${labels}}` : '';
            lines.push(`${def.name}${labelStr} ${value}`);
          }
        }
      } else if (def.type === 'histogram') {
        const stats = this.getHistogramStats(def.name);
        if (stats) {
          lines.push(`${def.name}_count ${stats.count}`);
          lines.push(`${def.name}_sum ${stats.sum}`);
          lines.push(`${def.name}{quantile="0.5"} ${stats.p50}`);
          lines.push(`${def.name}{quantile="0.95"} ${stats.p95}`);
          lines.push(`${def.name}{quantile="0.99"} ${stats.p99}`);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export interface HistogramStats {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

// ==========================================================================
// NO-OP METRICS (for testing)
// ==========================================================================

export class NoOpMetrics implements PaymentMetrics {
  recordPaymentCreated(): void {}
  recordPaymentLatency(): void {}
  recordPaymentError(): void {}
  recordCapture(): void {}
  recordRefund(): void {}
  recordFraudRejection(): void {}
  recordWebhookReceived(): void {}
  recordWebhookProcessed(): void {}
}

// ==========================================================================
// FACTORY
// ==========================================================================

export function createMetrics(enabled = true): PaymentMetrics {
  return enabled ? new MetricsCollector() : new NoOpMetrics();
}
