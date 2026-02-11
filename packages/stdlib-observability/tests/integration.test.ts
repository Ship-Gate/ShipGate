// ============================================================================
// Observability Standard Library - Integration Tests
// @isl-lang/stdlib-observability
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  LogLevel,
  InMemoryLogExporter,
} from '../implementations/typescript/logging';
import {
  MetricsRegistry,
  InMemoryMetricExporter,
  MetricType,
  MetricUnit,
} from '../implementations/typescript/metrics';
import {
  Tracer,
  InMemorySpanExporter,
  SpanKind,
  SpanStatus,
} from '../implementations/typescript/tracing';
import {
  getCorrelationContext,
  setCorrelationContext,
  withCorrelationContext,
  startNewTrace,
  extractCorrelationFromHeaders,
  injectCorrelationIntoHeaders,
} from '../implementations/typescript/correlation';
import {
  HealthCheckRegistry,
  HealthStatus,
  createCustomHealthCheck,
} from '../implementations/typescript/health';

describe('Observability Integration', () => {
  let logExporter: InMemoryLogExporter;
  let metricExporter: InMemoryMetricExporter;
  let spanExporter: InMemorySpanExporter;
  let logger: Logger;
  let metrics: MetricsRegistry;
  let tracer: Tracer;
  let health: HealthCheckRegistry;

  beforeEach(() => {
    logExporter = new InMemoryLogExporter();
    metricExporter = new InMemoryMetricExporter();
    spanExporter = new InMemorySpanExporter();

    logger = new Logger({
      minLevel: LogLevel.TRACE,
      service: 'test-service',
      environment: 'test',
      exporter: logExporter,
    });

    metrics = new MetricsRegistry({
      exporter: metricExporter,
    });

    tracer = new Tracer({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      exporter: spanExporter,
    });

    health = new HealthCheckRegistry();
  });

  afterEach(() => {
    logExporter.clear();
    metricExporter.clear();
    spanExporter.clear();
    health.clear();
  });

  describe('End-to-End Correlation', () => {
    it('should correlate logs, metrics, and traces', async () => {
      // Start a new trace with correlation context
      const context = startNewTrace();
      setCorrelationContext(context);

      // Start a span
      const { span } = await tracer.startSpan({
        name: 'operation',
        attributes: { operation: 'test' },
      });

      // Log within the span
      await logger.info('Operation started', {
        operation: 'test',
        step: 1,
      });

      // Record metrics
      const counter = metrics.registerCounter({
        name: 'operations_total',
        description: 'Total operations',
        unit: MetricUnit.COUNT,
      });

      await counter.increment({ operation: 'test' });

      const histogram = metrics.registerHistogram({
        name: 'operation_duration_seconds',
        description: 'Operation duration',
        unit: MetricUnit.SECONDS,
      });

      // End the span
      await tracer.endSpan({
        spanId: span.spanId,
        status: SpanStatus.OK,
      });

      // Collect metrics
      await metrics.collect();

      // Verify correlation
      const logs = logExporter.getLogs();
      const metricSamples = metricExporter.getSamples();
      const spans = spanExporter.getSpans();

      // All should have the same trace ID
      expect(logs[0].traceId).toBe(context.traceId);
      expect(logs[0].spanId).toBe(context.spanId);
      expect(spans[0].traceId).toBe(context.traceId);
      expect(spans[0].spanId).toBe(context.spanId);

      // Metrics should have the right labels
      const operationCounter = metricSamples.find(s => 
        s.name === 'operations_total' && s.labels?.operation === 'test'
      );
      expect(operationCounter).toBeDefined();
      expect(operationCounter?.value).toBe(1);
    });

    it('should propagate context through async operations', async () => {
      await withCorrelationContext(
        { traceId: 'propagation-test', userId: 'user123' },
        async () => {
          // Nested operation 1
          await withCorrelationContext(
            { spanId: 'span1' },
            async () => {
              await logger.info('Nested operation 1');
              
              const { span } = await tracer.startSpan({
                name: 'nested-1',
              });
              
              await tracer.endSpan({
                spanId: span.spanId,
              });
            }
          );

          // Nested operation 2
          await withCorrelationContext(
            { spanId: 'span2' },
            async () => {
              await logger.info('Nested operation 2');
              
              const { span } = await tracer.startSpan({
                name: 'nested-2',
              });
              
              await tracer.endSpan({
                spanId: span.spanId,
              });
            }
          );
        }
      );

      const logs = logExporter.getLogs();
      const spans = spanExporter.getSpans();

      // Both logs should have the same trace ID
      expect(logs[0].traceId).toBe('propagation-test');
      expect(logs[1].traceId).toBe('propagation-test');
      expect(logs[0].userId).toBe('user123');
      expect(logs[1].userId).toBe('user123');

      // But different span IDs
      expect(logs[0].spanId).toBe('span1');
      expect(logs[1].spanId).toBe('span2');

      // Spans should be properly nested
      expect(spans[0].traceId).toBe('propagation-test');
      expect(spans[1].traceId).toBe('propagation-test');
    });
  });

  describe('HTTP Request Flow Simulation', () => {
    it('should simulate complete request flow', async () => {
      // Simulate incoming request with headers
      const incomingHeaders = {
        'x-trace-id': 'abcdef1234567890abcdef1234567890',
        'x-span-id': '1234567890abcdef',
        'x-correlation-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-user-id': 'user123',
      };

      // Extract context from headers
      const context = extractCorrelationFromHeaders(incomingHeaders);
      setCorrelationContext(context);

      // Create server span
      const { span: serverSpan, context: serverContext } = await tracer.startSpan({
        name: 'http-request',
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': 'GET',
          'http.url': '/api/users',
          'http.user_agent': 'test-agent',
        },
      });

      // Update context with new span ID
      setCorrelationContext({ spanId: serverSpan.spanId });

      // Log request start
      await logger.info('Request started', {
        method: 'GET',
        path: '/api/users',
        userId: 'user123',
      });

      // Simulate database operation
      const { span: dbSpan } = await tracer.startSpan({
        name: 'db-query',
        parentContext: serverContext,
        attributes: {
          'db.system': 'postgresql',
          'db.statement': 'SELECT * FROM users',
        },
      });

      setCorrelationContext({ spanId: dbSpan.spanId });

      // Record DB metrics
      const dbTimer = metrics.registerHistogram({
        name: 'db_query_duration_seconds',
        description: 'Database query duration',
        unit: MetricUnit.SECONDS,
      });

      const dbStart = new Date();
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate DB work
      const dbEnd = new Date();

      await dbTimer.recordTiming(dbStart, dbEnd, { query: 'select_users' });

      await tracer.endSpan({ spanId: dbSpan.spanId, status: SpanStatus.OK });

      // Simulate business logic
      setCorrelationContext({ spanId: serverSpan.spanId });
      
      const businessCounter = metrics.registerCounter({
        name: 'business_operations_total',
        description: 'Business operations',
      });

      await businessCounter.increment({ operation: 'fetch_users' });

      // Log successful response
      await logger.info('Request completed', {
        status: 200,
        responseSize: 1024,
      });

      // End server span
      await tracer.endSpan({
        spanId: serverSpan.spanId,
        status: SpanStatus.OK,
      });

      // Collect all metrics
      await metrics.collect();

      // Verify complete flow
      const logs = logExporter.getLogs();
      const spans = spanExporter.getSpans();
      const samples = metricExporter.getSamples();

      // Should have 2 logs (request start and end)
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Request started');
      expect(logs[1].message).toBe('Request completed');

      // Should have 2 spans (server and database)
      expect(spans).toHaveLength(2);
      expect(spans.find(s => s.name === 'http-request')).toBeDefined();
      expect(spans.find(s => s.name === 'db-query')).toBeDefined();

      // Database span should be child of server span
      const dbSpanData = spans.find(s => s.name === 'db-query')!;
      const serverSpanData = spans.find(s => s.name === 'http-request')!;
      expect(dbSpanData.parentSpanId).toBe(serverSpanData.spanId);
      expect(dbSpanData.traceId).toBe(serverSpanData.traceId);

      // Should have metrics
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.some(s => s.name === 'db_query_duration_seconds_sum')).toBe(true);
      expect(samples.some(s => s.name === 'business_operations_total')).toBe(true);

      // Generate outbound headers
      const outboundHeaders = injectCorrelationIntoHeaders(getCorrelationContext());
      expect(outboundHeaders['x-trace-id']).toBe('abcdef1234567890abcdef1234567890');
      expect(outboundHeaders['x-user-id']).toBe('user123');
    });
  });

  describe('Health Check Integration', () => {
    it('should integrate health checks with other observability data', async () => {
      // Register health checks
      health.register('database', {
        type: 'CUSTOM' as any,
        checkFn: createCustomHealthCheck(async () => {
          // Simulate checking database while also logging
          await logger.info('Checking database health');
          
          // Record health check metric
          const healthCheckCounter = metrics.registerCounter({
            name: 'health_checks_total',
            description: 'Health check executions',
          });
          
          await healthCheckCounter.increment({ service: 'database' });
          
          return {
            status: HealthStatus.HEALTHY,
            message: 'Database responding',
            durationMs: 15,
          };
        }),
      });

      health.register('cache', {
        type: 'CUSTOM' as any,
        checkFn: createCustomHealthCheck(async () => {
          await logger.warn('Cache degraded');
          
          const healthCheckCounter = metrics.registerCounter({
            name: 'health_checks_total',
            description: 'Health check executions',
          });
          
          await healthCheckCounter.increment({ service: 'cache' });
          
          return {
            status: HealthStatus.DEGRADED,
            message: 'Cache high latency',
            durationMs: 150,
          };
        }),
      });

      // Run health checks
      const healthResult = await health.checkHealth();
      await metrics.collect();

      // Verify integration
      expect(healthResult.status).toBe(HealthStatus.DEGRADED);
      expect(healthResult.checks.database.status).toBe(HealthStatus.HEALTHY);
      expect(healthResult.checks.cache.status).toBe(HealthStatus.DEGRADED);

      // Check logs were written
      const logs = logExporter.getLogs();
      expect(logs.some(l => l.message.includes('Checking database'))).toBe(true);
      expect(logs.some(l => l.message.includes('Cache degraded'))).toBe(true);

      // Check metrics were recorded
      const samples = metricExporter.getSamples();
      const healthCheckSamples = samples.filter(s => s.name === 'health_checks_total');
      expect(healthCheckSamples).toHaveLength(2);
      expect(healthCheckSamples.some(s => s.labels?.service === 'database')).toBe(true);
      expect(healthCheckSamples.some(s => s.labels?.service === 'cache')).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle errors gracefully without breaking other components', async () => {
      // Set up correlation context
      setCorrelationContext({ traceId: 'error-test' });

      // Log an error
      await logger.error('Something went wrong', {
        error: new Error('Test error'),
      });

      // Record metrics even after error
      const counter = metrics.registerCounter({
        name: 'errors_total',
        description: 'Total errors',
      });

      await counter.increment({ type: 'test_error' });

      // Continue tracing after error
      const { span } = await tracer.startSpan({
        name: 'error-recovery',
      });

      await tracer.endSpan({
        spanId: span.spanId,
        status: SpanStatus.OK,
      });

      await metrics.collect();

      // Verify all components still work
      const logs = logExporter.getLogs();
      const spans = spanExporter.getSpans();
      const samples = metricExporter.getSamples();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].error?.message).toBe('Test error');

      expect(spans).toHaveLength(1);
      expect(spans[0].name).toBe('error-recovery');

      expect(samples.some(s => s.name === 'errors_total')).toBe(true);
    });
  });
});
