/**
 * OpenTelemetry tracing utility
 * Basic implementation - can be enhanced with @opentelemetry/sdk-node
 */

export interface SpanContext {
  traceId?: string;
  spanId?: string;
}

class Telemetry {
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, context?: SpanContext): Span {
    if (!this.enabled) {
      return new NoOpSpan();
    }
    return new BasicSpan(name);
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  end(): void;
}

class BasicSpan implements Span {
  private name: string;
  private startTime: number;
  private attributes: Record<string, string | number | boolean> = {};

  constructor(name: string) {
    this.name = name;
    this.startTime = Date.now();
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  end(): void {
    const duration = Date.now() - this.startTime;
    // In a real implementation, this would send to OpenTelemetry collector
    // For now, just log (can be replaced with actual OTel SDK)
    if (process.env['LOG_LEVEL'] === 'debug') {
      console.debug(`[Span] ${this.name}`, {
        duration: `${duration}ms`,
        ...this.attributes,
      });
    }
  }
}

class NoOpSpan implements Span {
  setAttribute(): void {
    // No-op
  }
  end(): void {
    // No-op
  }
}

// Singleton instance
let telemetryInstance: Telemetry | null = null;

export function getTelemetry(enabled?: boolean): Telemetry {
  if (!telemetryInstance) {
    telemetryInstance = new Telemetry(enabled);
  }
  if (enabled !== undefined) {
    telemetryInstance.setEnabled(enabled);
  }
  return telemetryInstance;
}
