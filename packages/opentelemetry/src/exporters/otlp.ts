import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  SpanProcessor,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

/**
 * OTLP protocol type
 */
export type OTLPProtocol = 'http' | 'grpc';

/**
 * ISL OTLP exporter configuration
 */
export interface ISLOTLPConfig {
  /**
   * Service name
   */
  serviceName: string;

  /**
   * OTLP endpoint URL
   */
  endpoint?: string;

  /**
   * Traces endpoint (overrides endpoint for traces)
   */
  tracesEndpoint?: string;

  /**
   * Metrics endpoint (overrides endpoint for metrics)
   */
  metricsEndpoint?: string;

  /**
   * Protocol to use (http or grpc)
   */
  protocol?: OTLPProtocol;

  /**
   * Additional headers
   */
  headers?: Record<string, string>;

  /**
   * Use batch processor
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

  /**
   * Metric export interval in milliseconds
   */
  metricExportIntervalMs?: number;

  /**
   * Compression algorithm
   */
  compression?: 'gzip' | 'none';

  /**
   * Timeout in milliseconds
   */
  timeoutMs?: number;
}

/**
 * Create OTLP trace exporter
 */
export function createOTLPTraceExporter(config: ISLOTLPConfig): SpanExporter {
  const endpoint =
    config.tracesEndpoint ?? config.endpoint ?? 'http://localhost:4318/v1/traces';

  if (config.protocol === 'grpc') {
    return new OTLPGrpcTraceExporter({
      url: endpoint.replace('/v1/traces', ''),
      headers: config.headers,
      compression: config.compression === 'gzip' ? 1 : 0, // CompressionAlgorithm
      timeoutMillis: config.timeoutMs,
    });
  }

  return new OTLPHttpTraceExporter({
    url: endpoint,
    headers: config.headers,
    compression: config.compression === 'gzip' ? 1 : 0,
    timeoutMillis: config.timeoutMs,
  });
}

/**
 * Create OTLP span processor
 */
export function createOTLPProcessor(config: ISLOTLPConfig): SpanProcessor {
  const exporter = createOTLPTraceExporter(config);

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
 * Create OTLP metric exporter
 */
export function createOTLPMetricExporter(config: ISLOTLPConfig): OTLPMetricExporter {
  const endpoint =
    config.metricsEndpoint ?? config.endpoint ?? 'http://localhost:4318/v1/metrics';

  return new OTLPMetricExporter({
    url: endpoint,
    headers: config.headers,
    compression: config.compression === 'gzip' ? 1 : 0,
    timeoutMillis: config.timeoutMs,
  });
}

/**
 * Create OTLP metric reader
 */
export function createOTLPMetricReader(
  config: ISLOTLPConfig
): PeriodicExportingMetricReader {
  const exporter = createOTLPMetricExporter(config);

  return new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: config.metricExportIntervalMs ?? 60000,
    exportTimeoutMillis: config.batchOptions?.exportTimeoutMillis ?? 30000,
  });
}

/**
 * Configure tracer provider with OTLP exporter
 */
export function configureOTLPProvider(
  provider: NodeTracerProvider,
  config: ISLOTLPConfig
): void {
  const processor = createOTLPProcessor(config);
  provider.addSpanProcessor(processor);
}

/**
 * Configure meter provider with OTLP exporter
 */
export function configureOTLPMeterProvider(
  provider: MeterProvider,
  config: ISLOTLPConfig
): void {
  const reader = createOTLPMetricReader(config);
  // Note: MeterProvider needs to be created with readers
  // This function is for reference - actual configuration should be done at creation
}

/**
 * Default OTLP configuration for local development
 */
export const defaultOTLPConfig: Partial<ISLOTLPConfig> = {
  endpoint: 'http://localhost:4318',
  protocol: 'http',
  useBatch: true,
  batchOptions: {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  },
  metricExportIntervalMs: 60000,
};

/**
 * Create OTLP configuration from environment variables
 */
export function otlpConfigFromEnv(): ISLOTLPConfig {
  return {
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'isl-verification',
    endpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
    tracesEndpoint: process.env['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'],
    metricsEndpoint: process.env['OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'],
    protocol: (process.env['OTEL_EXPORTER_OTLP_PROTOCOL'] as OTLPProtocol) ?? 'http',
    headers: process.env['OTEL_EXPORTER_OTLP_HEADERS']
      ? parseHeaders(process.env['OTEL_EXPORTER_OTLP_HEADERS'])
      : undefined,
    compression:
      (process.env['OTEL_EXPORTER_OTLP_COMPRESSION'] as 'gzip' | 'none') ?? 'none',
    timeoutMs: process.env['OTEL_EXPORTER_OTLP_TIMEOUT']
      ? parseInt(process.env['OTEL_EXPORTER_OTLP_TIMEOUT'], 10)
      : undefined,
    useBatch: process.env['OTEL_BATCH_PROCESSOR'] !== 'false',
  };
}

/**
 * Parse headers from environment variable format
 */
function parseHeaders(headersStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const pairs = headersStr.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  }

  return headers;
}

/**
 * Common OTLP backend configurations
 */
export const OTLPBackends = {
  /**
   * Local OTLP collector
   */
  local: (): Partial<ISLOTLPConfig> => ({
    endpoint: 'http://localhost:4318',
    protocol: 'http',
  }),

  /**
   * Grafana Cloud OTLP
   */
  grafanaCloud: (instanceId: string, apiKey: string): Partial<ISLOTLPConfig> => ({
    endpoint: `https://otlp-gateway-${instanceId}.grafana.net/otlp`,
    protocol: 'http',
    headers: {
      Authorization: `Basic ${Buffer.from(`${instanceId}:${apiKey}`).toString('base64')}`,
    },
  }),

  /**
   * Honeycomb OTLP
   */
  honeycomb: (apiKey: string, dataset: string): Partial<ISLOTLPConfig> => ({
    endpoint: 'https://api.honeycomb.io',
    protocol: 'http',
    headers: {
      'x-honeycomb-team': apiKey,
      'x-honeycomb-dataset': dataset,
    },
  }),

  /**
   * Datadog OTLP
   */
  datadog: (apiKey: string, site: string = 'datadoghq.com'): Partial<ISLOTLPConfig> => ({
    endpoint: `https://otlp.ingest.${site}`,
    protocol: 'http',
    headers: {
      'DD-API-KEY': apiKey,
    },
  }),

  /**
   * New Relic OTLP
   */
  newRelic: (apiKey: string, region: 'us' | 'eu' = 'us'): Partial<ISLOTLPConfig> => ({
    endpoint:
      region === 'us'
        ? 'https://otlp.nr-data.net'
        : 'https://otlp.eu01.nr-data.net',
    protocol: 'http',
    headers: {
      'api-key': apiKey,
    },
  }),
};
