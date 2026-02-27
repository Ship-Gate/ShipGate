import { ZipkinExporter, ExporterConfig } from '@opentelemetry/exporter-zipkin';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

/**
 * ISL Zipkin exporter configuration
 */
export interface ISLZipkinConfig extends ExporterConfig {
  /**
   * Service name for Zipkin
   */
  serviceName: string;

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
 * Create Zipkin exporter for ISL tracing
 */
export function createZipkinExporter(config: ISLZipkinConfig): ZipkinExporter {
  return new ZipkinExporter({
    url: config.url,
    serviceName: config.serviceName,
    headers: config.headers,
  });
}

/**
 * Create Zipkin span processor
 */
export function createZipkinProcessor(config: ISLZipkinConfig): SpanProcessor {
  const exporter = createZipkinExporter(config);

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
 * Configure tracer provider with Zipkin exporter
 */
export function configureZipkinProvider(
  provider: NodeTracerProvider,
  config: ISLZipkinConfig
): void {
  const processor = createZipkinProcessor(config);
  provider.addSpanProcessor(processor);
}

/**
 * Default Zipkin configuration for local development
 */
export const defaultZipkinConfig: Partial<ISLZipkinConfig> = {
  url: 'http://localhost:9411/api/v2/spans',
  useBatch: true,
  batchOptions: {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  },
};

/**
 * Create Zipkin configuration from environment variables
 */
export function zipkinConfigFromEnv(): ISLZipkinConfig {
  return {
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'isl-verification',
    url:
      process.env['ZIPKIN_ENDPOINT'] ??
      process.env['OTEL_EXPORTER_ZIPKIN_ENDPOINT'] ??
      'http://localhost:9411/api/v2/spans',
    useBatch: process.env['OTEL_BATCH_PROCESSOR'] !== 'false',
  };
}

/**
 * Zipkin URL builder utilities
 */
export const ZipkinURLs = {
  /**
   * Build Zipkin traces URL
   */
  traces: (baseUrl: string): string => `${baseUrl}/api/v2/spans`,

  /**
   * Build Zipkin services URL
   */
  services: (baseUrl: string): string => `${baseUrl}/api/v2/services`,

  /**
   * Build Zipkin spans URL for a service
   */
  spans: (baseUrl: string, serviceName: string): string =>
    `${baseUrl}/api/v2/spans?serviceName=${encodeURIComponent(serviceName)}`,

  /**
   * Build Zipkin trace URL
   */
  trace: (baseUrl: string, traceId: string): string =>
    `${baseUrl}/api/v2/trace/${traceId}`,

  /**
   * Build Zipkin UI URL for a trace
   */
  traceUI: (baseUrl: string, traceId: string): string =>
    `${baseUrl}/zipkin/traces/${traceId}`,
};
