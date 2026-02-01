/**
 * @isl-lang/opentelemetry
 * OpenTelemetry integration for ISL verification tracing
 */

// Re-export OpenTelemetry API types for convenience
export {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  Span,
  Tracer,
  Context,
  Attributes,
} from '@opentelemetry/api';

// Semantic attributes
export {
  ISLSemanticAttributes,
  ISLSemanticAttributeKey,
  ISLSemanticAttributeValue,
  VerificationVerdict,
  CheckType,
  ChaosInjectionType,
  VerificationType,
} from './semantic-attributes';

// Tracer
export {
  ISLTracer,
  ISLTracerConfig,
  VerificationResult,
  CheckResult as TracerCheckResult,
  CoverageResult as TracerCoverageResult,
  createISLTracer,
} from './tracer';

// Spans
export {
  // Behavior
  BehaviorSpan,
  BehaviorSpanConfig,
  BehaviorResult,
  BehaviorSpanBuilder,
  withBehaviorSpan,
  createBehaviorSpan,
  TraceBehavior,
  // Verification
  VerificationSpan,
  VerificationSpanConfig,
  CheckResult as SpanCheckResult,
  CoverageMetrics,
  VerificationResult as SpanVerificationResult,
  VerificationSpanBuilder,
  withVerificationSpan,
  createVerificationSpan,
  TraceVerification,
  // Chaos
  ChaosSpan,
  ChaosSpanConfig,
  ChaosResult,
  ChaosSpanBuilder,
  withChaosSpan,
  createChaosSpan,
  ChaosUtils,
} from './spans';

// Metrics
export {
  VerificationMetrics,
  VerificationBatchResult,
  createVerificationMetrics,
  CoverageMetrics as CoverageMetricsCollector,
  CoverageData,
  CoverageReport,
  DomainCoverageReport,
  createCoverageMetrics,
  SLOMetrics,
  SLODefinition,
  SLOMeasurement,
  SLOStatus,
  SLOTemplates,
  createSLOMetrics,
} from './metrics';

// Propagation
export {
  ISLContextData,
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
} from './propagation/isl-context';

// Exporters
export {
  // Jaeger
  ISLJaegerConfig,
  createJaegerExporter,
  createJaegerProcessor,
  configureJaegerProvider,
  defaultJaegerConfig,
  jaegerConfigFromEnv,
  // Zipkin
  ISLZipkinConfig,
  createZipkinExporter,
  createZipkinProcessor,
  configureZipkinProvider,
  defaultZipkinConfig,
  zipkinConfigFromEnv,
  ZipkinURLs,
  // OTLP
  ISLOTLPConfig,
  OTLPProtocol,
  createOTLPTraceExporter,
  createOTLPProcessor,
  createOTLPMetricExporter,
  createOTLPMetricReader,
  configureOTLPProvider,
  configureOTLPMeterProvider,
  defaultOTLPConfig,
  otlpConfigFromEnv,
  OTLPBackends,
} from './exporters';

// Instrumentation
export {
  // Express
  ExpressInstrumentationOptions,
  islExpressMiddleware,
  islExpressErrorHandler,
  traceBehavior as expressTraceBehavior,
  traceVerification as expressTraceVerification,
  createISLRequestHeaders,
  // Fastify
  FastifyInstrumentationOptions,
  islFastifyPlugin,
  registerISLPlugin,
  createBehaviorHook,
  createVerificationHook,
  completeBehaviorOnSend,
  completeVerificationOnSend,
  getISLContextFromRequest,
  runInRequestContext,
  // gRPC
  GrpcInstrumentationOptions,
  GrpcCall,
  extractISLContextFromMetadata,
  injectISLContextToMetadata,
  traceUnaryCall,
  traceClientStreamingCall,
  traceServerStreamingCall,
  traceBidiStreamingCall,
  traceService,
} from './instrumentation';

// ═══════════════════════════════════════════════════════════════════════════
// Convenience Factory Functions
// ═══════════════════════════════════════════════════════════════════════════

import { ISLTracer, ISLTracerConfig } from './tracer';
import { VerificationMetrics } from './metrics/verification';
import { CoverageMetrics } from './metrics/coverage';
import { SLOMetrics, SLOTemplates } from './metrics/slo';
import { configureJaegerProvider, jaegerConfigFromEnv } from './exporters/jaeger';
import { configureZipkinProvider, zipkinConfigFromEnv } from './exporters/zipkin';
import { configureOTLPProvider, otlpConfigFromEnv } from './exporters/otlp';

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
      sloMetrics.registerSLO(SLOTemplates.verificationPassRate(config.domainName));
      sloMetrics.registerSLO(SLOTemplates.verificationLatency(config.domainName));
      sloMetrics.registerSLO(SLOTemplates.errorRate(config.domainName));
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
  createISLTracer,
  createVerificationMetrics,
  createCoverageMetrics,
  createSLOMetrics,
  ISLSemanticAttributes,
  SLOTemplates,
};
