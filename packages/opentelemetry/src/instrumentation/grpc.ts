import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  Attributes,
  Context,
  Span,
} from '@opentelemetry/api';
import type {
  ServerUnaryCall,
  ServerReadableStream,
  ServerWritableStream,
  ServerDuplexStream,
  Metadata,
  UntypedServiceImplementation,
  handleUnaryCall,
  handleClientStreamingCall,
  handleServerStreamingCall,
  handleBidiStreamingCall,
  sendUnaryData,
} from '@grpc/grpc-js';
import { ISLSemanticAttributes } from '../semantic-attributes';
import {
  ISL_HEADERS,
  ISLContextData,
  setISLContext,
} from '../propagation/isl-context';

/**
 * gRPC instrumentation options
 */
export interface GrpcInstrumentationOptions {
  /**
   * Default domain
   */
  defaultDomain?: string;

  /**
   * Extract domain from method name
   */
  domainExtractor?: (methodName: string) => string;

  /**
   * Extract behavior from method name
   */
  behaviorExtractor?: (methodName: string) => string;

  /**
   * Additional attributes
   */
  additionalAttributes?: (call: GrpcCall, methodName: string) => Attributes;

  /**
   * Filter methods to skip
   */
  ignoreFilter?: (methodName: string) => boolean;
}

/**
 * Union type for all gRPC call types
 */
export type GrpcCall =
  | ServerUnaryCall<unknown, unknown>
  | ServerReadableStream<unknown, unknown>
  | ServerWritableStream<unknown, unknown>
  | ServerDuplexStream<unknown, unknown>;

/**
 * Extract ISL context from gRPC metadata
 */
export function extractISLContextFromMetadata(
  metadata: Metadata
): ISLContextData | undefined {
  const domain = metadata.get(ISL_HEADERS.DOMAIN)?.[0]?.toString();
  if (!domain) return undefined;

  return {
    domain,
    behavior: metadata.get(ISL_HEADERS.BEHAVIOR)?.[0]?.toString(),
    verificationId: metadata.get(ISL_HEADERS.VERIFICATION_ID)?.[0]?.toString(),
    actor: metadata.get(ISL_HEADERS.ACTOR)?.[0]?.toString(),
    idempotencyKey: metadata.get(ISL_HEADERS.IDEMPOTENCY_KEY)?.[0]?.toString(),
    trustScore: metadata.get(ISL_HEADERS.TRUST_SCORE)?.[0]
      ? parseFloat(metadata.get(ISL_HEADERS.TRUST_SCORE)?.[0]?.toString() ?? '0')
      : undefined,
  };
}

/**
 * Inject ISL context into gRPC metadata
 */
export function injectISLContextToMetadata(
  metadata: Metadata,
  islContext: ISLContextData
): Metadata {
  metadata.set(ISL_HEADERS.DOMAIN, islContext.domain);

  if (islContext.behavior) {
    metadata.set(ISL_HEADERS.BEHAVIOR, islContext.behavior);
  }
  if (islContext.verificationId) {
    metadata.set(ISL_HEADERS.VERIFICATION_ID, islContext.verificationId);
  }
  if (islContext.actor) {
    metadata.set(ISL_HEADERS.ACTOR, islContext.actor);
  }
  if (islContext.idempotencyKey) {
    metadata.set(ISL_HEADERS.IDEMPOTENCY_KEY, islContext.idempotencyKey);
  }
  if (islContext.trustScore !== undefined) {
    metadata.set(ISL_HEADERS.TRUST_SCORE, String(islContext.trustScore));
  }

  return metadata;
}

/**
 * Create gRPC span attributes
 */
function createGrpcAttributes(
  methodName: string,
  islContext: ISLContextData | undefined,
  options: GrpcInstrumentationOptions
): Attributes {
  const domain =
    islContext?.domain ??
    options.domainExtractor?.(methodName) ??
    options.defaultDomain ??
    'unknown';

  const behavior =
    islContext?.behavior ??
    options.behaviorExtractor?.(methodName) ??
    methodName;

  return {
    [ISLSemanticAttributes.ISL_DOMAIN_NAME]: domain,
    [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: behavior,
    'rpc.system': 'grpc',
    'rpc.service': methodName.split('/')[1] ?? methodName,
    'rpc.method': methodName.split('/')[2] ?? methodName,
    ...(islContext?.actor && {
      [ISLSemanticAttributes.ISL_BEHAVIOR_ACTOR]: islContext.actor,
    }),
    ...(islContext?.verificationId && {
      [ISLSemanticAttributes.ISL_VERIFICATION_ID]: islContext.verificationId,
    }),
  };
}

/**
 * Wrap unary call handler with tracing
 */
export function traceUnaryCall<TRequest, TResponse>(
  methodName: string,
  handler: handleUnaryCall<TRequest, TResponse>,
  options: GrpcInstrumentationOptions = {}
): handleUnaryCall<TRequest, TResponse> {
  const tracer = trace.getTracer('isl-grpc', '1.0.0');

  return (
    call: ServerUnaryCall<TRequest, TResponse>,
    callback: sendUnaryData<TResponse>
  ): void => {
    if (options.ignoreFilter?.(methodName)) {
      handler(call, callback);
      return;
    }

    const islContext = extractISLContextFromMetadata(call.metadata);
    const attributes = createGrpcAttributes(methodName, islContext, options);

    tracer.startActiveSpan(
      `isl.grpc.${methodName}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          ...attributes,
          ...options.additionalAttributes?.(call, methodName),
        },
      },
      (span) => {
        const newISLContext: ISLContextData = {
          domain:
            islContext?.domain ??
            options.domainExtractor?.(methodName) ??
            options.defaultDomain ??
            'unknown',
          behavior:
            islContext?.behavior ??
            options.behaviorExtractor?.(methodName) ??
            methodName,
          verificationId: islContext?.verificationId ?? span.spanContext().traceId,
          actor: islContext?.actor,
        };

        const ctx = setISLContext(context.active(), newISLContext);

        context.with(ctx, () => {
          const wrappedCallback: sendUnaryData<TResponse> = (
            error,
            value,
            trailer?,
            flags?
          ) => {
            if (error) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
              });
              span.recordException(error);
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }
            span.end();
            callback(error, value, trailer, flags);
          };

          handler(call, wrappedCallback);
        });
      }
    );
  };
}

/**
 * Wrap client streaming call handler with tracing
 */
export function traceClientStreamingCall<TRequest, TResponse>(
  methodName: string,
  handler: handleClientStreamingCall<TRequest, TResponse>,
  options: GrpcInstrumentationOptions = {}
): handleClientStreamingCall<TRequest, TResponse> {
  const tracer = trace.getTracer('isl-grpc', '1.0.0');

  return (
    call: ServerReadableStream<TRequest, TResponse>,
    callback: sendUnaryData<TResponse>
  ): void => {
    if (options.ignoreFilter?.(methodName)) {
      handler(call, callback);
      return;
    }

    const islContext = extractISLContextFromMetadata(call.metadata);
    const attributes = createGrpcAttributes(methodName, islContext, options);

    tracer.startActiveSpan(
      `isl.grpc.${methodName}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          ...attributes,
          'rpc.grpc.streaming': 'client',
          ...options.additionalAttributes?.(call, methodName),
        },
      },
      (span) => {
        let messageCount = 0;

        call.on('data', () => {
          messageCount++;
          span.addEvent('grpc.message.received', {
            'message.id': messageCount,
          });
        });

        const wrappedCallback: sendUnaryData<TResponse> = (
          error,
          value,
          trailer?,
          flags?
        ) => {
          span.setAttribute('rpc.grpc.message_count', messageCount);

          if (error) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.recordException(error);
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }
          span.end();
          callback(error, value, trailer, flags);
        };

        handler(call, wrappedCallback);
      }
    );
  };
}

/**
 * Wrap server streaming call handler with tracing
 */
export function traceServerStreamingCall<TRequest, TResponse>(
  methodName: string,
  handler: handleServerStreamingCall<TRequest, TResponse>,
  options: GrpcInstrumentationOptions = {}
): handleServerStreamingCall<TRequest, TResponse> {
  const tracer = trace.getTracer('isl-grpc', '1.0.0');

  return (call: ServerWritableStream<TRequest, TResponse>): void => {
    if (options.ignoreFilter?.(methodName)) {
      handler(call);
      return;
    }

    const islContext = extractISLContextFromMetadata(call.metadata);
    const attributes = createGrpcAttributes(methodName, islContext, options);

    tracer.startActiveSpan(
      `isl.grpc.${methodName}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          ...attributes,
          'rpc.grpc.streaming': 'server',
          ...options.additionalAttributes?.(call, methodName),
        },
      },
      (span) => {
        let messageCount = 0;
        const originalWrite = call.write.bind(call);

        call.write = ((
          chunk: TResponse,
          encoding?: BufferEncoding | ((error?: Error | null) => void),
          callback?: (error?: Error | null) => void
        ) => {
          messageCount++;
          span.addEvent('grpc.message.sent', {
            'message.id': messageCount,
          });

          if (typeof encoding === 'function') {
            return originalWrite(chunk, encoding);
          }
          return originalWrite(chunk, encoding, callback);
        }) as typeof call.write;

        call.on('finish', () => {
          span.setAttribute('rpc.grpc.message_count', messageCount);
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        });

        call.on('error', (error) => {
          span.setAttribute('rpc.grpc.message_count', messageCount);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.recordException(error);
          span.end();
        });

        handler(call);
      }
    );
  };
}

/**
 * Wrap bidirectional streaming call handler with tracing
 */
export function traceBidiStreamingCall<TRequest, TResponse>(
  methodName: string,
  handler: handleBidiStreamingCall<TRequest, TResponse>,
  options: GrpcInstrumentationOptions = {}
): handleBidiStreamingCall<TRequest, TResponse> {
  const tracer = trace.getTracer('isl-grpc', '1.0.0');

  return (call: ServerDuplexStream<TRequest, TResponse>): void => {
    if (options.ignoreFilter?.(methodName)) {
      handler(call);
      return;
    }

    const islContext = extractISLContextFromMetadata(call.metadata);
    const attributes = createGrpcAttributes(methodName, islContext, options);

    tracer.startActiveSpan(
      `isl.grpc.${methodName}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          ...attributes,
          'rpc.grpc.streaming': 'bidirectional',
          ...options.additionalAttributes?.(call, methodName),
        },
      },
      (span) => {
        let receivedCount = 0;
        let sentCount = 0;

        call.on('data', () => {
          receivedCount++;
          span.addEvent('grpc.message.received', {
            'message.id': receivedCount,
          });
        });

        const originalWrite = call.write.bind(call);
        call.write = ((
          chunk: TResponse,
          encoding?: BufferEncoding | ((error?: Error | null) => void),
          callback?: (error?: Error | null) => void
        ) => {
          sentCount++;
          span.addEvent('grpc.message.sent', {
            'message.id': sentCount,
          });

          if (typeof encoding === 'function') {
            return originalWrite(chunk, encoding);
          }
          return originalWrite(chunk, encoding, callback);
        }) as typeof call.write;

        call.on('finish', () => {
          span.setAttribute('rpc.grpc.received_count', receivedCount);
          span.setAttribute('rpc.grpc.sent_count', sentCount);
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        });

        call.on('error', (error) => {
          span.setAttribute('rpc.grpc.received_count', receivedCount);
          span.setAttribute('rpc.grpc.sent_count', sentCount);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.recordException(error);
          span.end();
        });

        handler(call);
      }
    );
  };
}

/**
 * Wrap entire service implementation with tracing
 */
export function traceService<T extends UntypedServiceImplementation>(
  service: T,
  options: GrpcInstrumentationOptions = {}
): T {
  const tracedService = {} as T;

  for (const [methodName, handler] of Object.entries(service)) {
    // Determine handler type and wrap accordingly
    // This is a simplified version - actual implementation would need to
    // inspect the handler signature to determine the type
    (tracedService as UntypedServiceImplementation)[methodName] = traceUnaryCall(
      methodName,
      handler as handleUnaryCall<unknown, unknown>,
      options
    );
  }

  return tracedService;
}
