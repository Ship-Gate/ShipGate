import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

/**
 * ISL Jaeger exporter configuration
 */
export interface ISLJaegerConfig {
  /**
   * Service name for Jaeger
   */
  serviceName: string;

  /**
   * Jaeger collector endpoint URL (HTTP)
   */
  endpoint?: string;

  /**
   * Jaeger agent host (UDP)
   */
  host?: string;

  /**
   * Jaeger agent port (UDP)
   */
  port?: number;

  /**
   * Maximum UDP packet size
   */
  maxPacketSize?: number;

  /**
   * Use batch processor (recommended for production)
   */
  useBatch?: boolean;

  /**
   * Batch processor options
   */
  batchOptions?: {
    maxQueueSize?: number;
    maxExportBatchSize?: number;
    scheduledDelayMillis?: number;
    exportTimeoutMillis?: number;
  };
}

/**
 * Create Jaeger exporter for ISL tracing
 */
export function createJaegerExporter(config: ISLJaegerConfig): JaegerExporter {
  return new JaegerExporter({
    endpoint: config.endpoint,
    host: config.host,
    port: config.port,
    maxPacketSize: config.maxPacketSize,
  });
}

/**
 * Create Jaeger span processor
 */
export function createJaegerProcessor(config: ISLJaegerConfig): SpanProcessor {
  const exporter = createJaegerExporter(config);

  if (config.useBatch !== false) {
    return new BatchSpanProcessor(exporter, {
      maxQueueSize: config.batchOptions?.maxQueueSize ?? 2048,
      maxExportBatchSize: config.batchOptions?.maxExportBatchSize ?? 512,
      scheduledDelayMillis: config.batchOptions?.scheduledDelayMillis ?? 5000,
      exportTimeoutMillis: config.batchOptions?.exportTimeoutMillis ?? 30000,
    });
  }

  return new SimpleSpanProcessor(exporter);
}

/**
 * Configure tracer provider with Jaeger exporter
 */
export function configureJaegerProvider(
  provider: NodeTracerProvider,
  config: ISLJaegerConfig
): void {
  const processor = createJaegerProcessor(config);
  provider.addSpanProcessor(processor);
}

/**
 * Default Jaeger configuration for local development
 */
export const defaultJaegerConfig: Partial<ISLJaegerConfig> = {
  endpoint: 'http://localhost:14268/api/traces',
  useBatch: true,
  batchOptions: {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  },
};

/**
 * Create Jaeger configuration from environment variables
 */
export function jaegerConfigFromEnv(): ISLJaegerConfig {
  return {
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'isl-verification',
    endpoint:
      process.env['JAEGER_ENDPOINT'] ??
      process.env['OTEL_EXPORTER_JAEGER_ENDPOINT'] ??
      'http://localhost:14268/api/traces',
    host: process.env['JAEGER_AGENT_HOST'],
    port: process.env['JAEGER_AGENT_PORT']
      ? parseInt(process.env['JAEGER_AGENT_PORT'], 10)
      : undefined,
    useBatch: process.env['OTEL_BATCH_PROCESSOR'] !== 'false',
  };
}
