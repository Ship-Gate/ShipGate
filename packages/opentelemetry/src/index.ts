/**
 * @isl-lang/opentelemetry
 * OpenTelemetry integration for ISL verification tracing
 */

// Re-export OpenTelemetry API types for convenience
export { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
export type { Span, Tracer, Context, Attributes } from '@opentelemetry/api';

// Semantic attributes
export { ISLSemanticAttributes } from './semantic-attributes.js';
export type {
  ISLSemanticAttributeKey,
  ISLSemanticAttributeValue,
  VerificationVerdict,
  CheckType,
  ChaosInjectionType,
  VerificationType,
} from './semantic-attributes.js';

// Tracer
export { ISLTracer, createISLTracer } from './tracer.js';
export type {
  ISLTracerConfig,
  VerificationResult,
  CheckResult as TracerCheckResult,
  CoverageResult as TracerCoverageResult,
} from './tracer.js';

// Spans
export {
  // Behavior
  BehaviorSpan,
  BehaviorSpanBuilder,
  withBehaviorSpan,
  createBehaviorSpan,
  TraceBehavior,
  // Verification
  VerificationSpan,
  VerificationSpanBuilder,
  withVerificationSpan,
  createVerificationSpan,
  TraceVerification,
  // Chaos
  ChaosSpan,
  ChaosSpanBuilder,
  withChaosSpan,
  createChaosSpan,
  ChaosUtils,
} from './spans/index.js';
export type {
  BehaviorSpanConfig,
  BehaviorResult,
  VerificationSpanConfig,
  CheckResult as SpanCheckResult,
  CoverageMetrics,
  VerificationResult as SpanVerificationResult,
  ChaosSpanConfig,
  ChaosResult,
} from './spans/index.js';

// Metrics
export {
  VerificationMetrics,
  createVerificationMetrics,
  CoverageMetrics as CoverageMetricsCollector,
  createCoverageMetrics,
  SLOMetrics,
  SLOTemplates,
  createSLOMetrics,
} from './metrics/index.js';
export type {
  VerificationBatchResult,
  CoverageData,
  CoverageReport,
  DomainCoverageReport,
  SLODefinition,
  SLOMeasurement,
  SLOStatus,
} from './metrics/index.js';

// Propagation
export {
  ISL_HEADERS,
  ISLContextPropagator,
  ISLCompositePropagator,
  getISLContext,
  setISLContext,
  withISLContext,
  runWithISLContext,
  createISLContextFromSpan,
  createISLHeaders,
  parseISLHeaders,
} from './propagation/isl-context.js';
export type { ISLContextData } from './propagation/isl-context.js';

// Exporters
export {
  // Jaeger
  createJaegerExporter,
  createJaegerProcessor,
  configureJaegerProvider,
  defaultJaegerConfig,
  jaegerConfigFromEnv,
  // Zipkin
  createZipkinExporter,
  createZipkinProcessor,
  configureZipkinProvider,
  defaultZipkinConfig,
  zipkinConfigFromEnv,
  ZipkinURLs,
  // OTLP
  createOTLPTraceExporter,
  createOTLPProcessor,
  createOTLPMetricExporter,
  createOTLPMetricReader,
  configureOTLPProvider,
  configureOTLPMeterProvider,
  defaultOTLPConfig,
  otlpConfigFromEnv,
  OTLPBackends,
} from './exporters/index.js';
export type {
  ISLJaegerConfig,
  ISLZipkinConfig,
  ISLOTLPConfig,
  OTLPProtocol,
} from './exporters/index.js';

// Instrumentation
export {
  // Express
  islExpressMiddleware,
  islExpressErrorHandler,
  traceBehavior as expressTraceBehavior,
  traceVerification as expressTraceVerification,
  createISLRequestHeaders,
  // Fastify
  islFastifyPlugin,
  registerISLPlugin,
  createBehaviorHook,
  createVerificationHook,
  completeBehaviorOnSend,
  completeVerificationOnSend,
  getISLContextFromRequest,
  runInRequestContext,
  // gRPC
  extractISLContextFromMetadata,
  injectISLContextToMetadata,
  traceUnaryCall,
  traceClientStreamingCall,
  traceServerStreamingCall,
  traceBidiStreamingCall,
  traceService,
} from './instrumentation/index.js';
export type {
  ExpressInstrumentationOptions,
  FastifyInstrumentationOptions,
  GrpcInstrumentationOptions,
  GrpcCall,
} from './instrumentation/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Convenience Factory Functions
// ═══════════════════════════════════════════════════════════════════════════

import { ISLTracer, createISLTracer as _createISLTracer } from './tracer.js';
import type { ISLTracerConfig } from './tracer.js';
import {
  VerificationMetrics,
  createVerificationMetrics as _createVerificationMetrics,
} from './metrics/verification.js';
import {
  CoverageMetrics,
  createCoverageMetrics as _createCoverageMetrics,
} from './metrics/coverage.js';
import {
  SLOMetrics,
  SLOTemplates as _SLOTemplates,
  createSLOMetrics as _createSLOMetrics,
} from './metrics/slo.js';
import {
  configureJaegerProvider,
  jaegerConfigFromEnv,
} from './exporters/jaeger.js';
import {
  configureZipkinProvider,
  zipkinConfigFromEnv,
} from './exporters/zipkin.js';
import { configureOTLPProvider, otlpConfigFromEnv } from './exporters/otlp.js';
import { ISLSemanticAttributes as _ISLSemanticAttributes } from './semantic-attributes.js';

/**
 * Full ISL observability configuration
 */
export interface ISLObservabilityConfig extends ISLTracerConfig {
  /**
   * Exporter type
   */
  exporter?: 'jaeger' | 'zipkin' | 'otlp' | 'none';

  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;

  /**
   * Enable SLO tracking
   */
  enableSLO?: boolean;

  /**
   * Auto-register SLO templates for the domain
   */
  autoRegisterSLOs?: boolean;
}

/**
 * ISL Observability instance
 */
export interface ISLObservability {
  tracer: ISLTracer;
  verificationMetrics?: VerificationMetrics;
  coverageMetrics?: CoverageMetrics;
  sloMetrics?: SLOMetrics;
  shutdown: () => Promise<void>;
}

/**
 * Create a fully configured ISL observability instance
 */
export function createISLObservability(
  config: ISLObservabilityConfig
): ISLObservability {
  // Create tracer
  const tracer = new ISLTracer(config);

  // Configure exporter
  if (config.exporter && config.exporter !== 'none') {
    const provider = tracer.getProvider();

    switch (config.exporter) {
      case 'jaeger':
        configureJaegerProvider(provider, {
          ...jaegerConfigFromEnv(),
          serviceName: config.serviceName,
        });
        break;
      case 'zipkin':
        configureZipkinProvider(provider, {
          ...zipkinConfigFromEnv(),
          serviceName: config.serviceName,
        });
        break;
      case 'otlp':
        configureOTLPProvider(provider, {
          ...otlpConfigFromEnv(),
          serviceName: config.serviceName,
        });
        break;
    }
  }

  // Register provider
  tracer.register();

  // Create metrics
  let verificationMetrics: VerificationMetrics | undefined;
  let coverageMetrics: CoverageMetrics | undefined;
  let sloMetrics: SLOMetrics | undefined;

  if (config.enableMetrics !== false) {
    verificationMetrics = new VerificationMetrics();
    coverageMetrics = new CoverageMetrics();
  }

  if (config.enableSLO !== false) {
    sloMetrics = new SLOMetrics();

    // Auto-register SLOs
    if (config.autoRegisterSLOs && config.domainName) {
      sloMetrics.registerSLO(_SLOTemplates.verificationPassRate(config.domainName));
      sloMetrics.registerSLO(_SLOTemplates.verificationLatency(config.domainName));
      sloMetrics.registerSLO(_SLOTemplates.errorRate(config.domainName));
    }
  }

  return {
    tracer,
    verificationMetrics,
    coverageMetrics,
    sloMetrics,
    shutdown: () => tracer.shutdown(),
  };
}

/**
 * Default export for quick setup
 */
export default {
  createISLObservability,
  createISLTracer: _createISLTracer,
  createVerificationMetrics: _createVerificationMetrics,
  createCoverageMetrics: _createCoverageMetrics,
  createSLOMetrics: _createSLOMetrics,
  ISLSemanticAttributes: _ISLSemanticAttributes,
  SLOTemplates: _SLOTemplates,
};
