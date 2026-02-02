import {
  Context,
  context,
  TextMapGetter,
  TextMapPropagator,
  TextMapSetter,
  createContextKey,
  Span,
} from '@opentelemetry/api';

/**
 * ISL Context data propagated across service boundaries
 */
export interface ISLContextData {
  domain: string;
  behavior?: string;
  verificationId?: string;
  actor?: string;
  idempotencyKey?: string;
  trustScore?: number;
  parentVerificationId?: string;
}

/**
 * ISL header names
 */
export const ISL_HEADERS = {
  DOMAIN: 'x-isl-domain',
  BEHAVIOR: 'x-isl-behavior',
  VERIFICATION_ID: 'x-isl-verification-id',
  ACTOR: 'x-isl-actor',
  IDEMPOTENCY_KEY: 'x-isl-idempotency-key',
  TRUST_SCORE: 'x-isl-trust-score',
  PARENT_VERIFICATION_ID: 'x-isl-parent-verification-id',
} as const;

/**
 * Context key for ISL data
 */
const ISL_CONTEXT_KEY = createContextKey('isl-context');

/**
 * Get ISL context from the current context
 */
export function getISLContext(ctx?: Context): ISLContextData | undefined {
  return (ctx ?? context.active()).getValue(ISL_CONTEXT_KEY) as
    | ISLContextData
    | undefined;
}

/**
 * Set ISL context in a context
 */
export function setISLContext(
  ctx: Context,
  islContext: ISLContextData
): Context {
  return ctx.setValue(ISL_CONTEXT_KEY, islContext);
}

/**
 * Create a new context with ISL data
 */
export function withISLContext(islContext: ISLContextData): Context {
  return setISLContext(context.active(), islContext);
}

/**
 * Run a function within an ISL context
 */
export function runWithISLContext<T>(
  islContext: ISLContextData,
  fn: () => T
): T {
  return context.with(withISLContext(islContext), fn);
}

/**
 * ISL Context Propagator
 * Propagates ISL-specific context across service boundaries
 */
export class ISLContextPropagator implements TextMapPropagator {
  /**
   * Inject ISL context into carrier (e.g., HTTP headers)
   */
  inject(
    ctx: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>
  ): void {
    const islContext = getISLContext(ctx);
    if (!islContext) return;

    // Inject ISL headers
    setter.set(carrier, ISL_HEADERS.DOMAIN, islContext.domain);

    if (islContext.behavior) {
      setter.set(carrier, ISL_HEADERS.BEHAVIOR, islContext.behavior);
    }

    if (islContext.verificationId) {
      setter.set(carrier, ISL_HEADERS.VERIFICATION_ID, islContext.verificationId);
    }

    if (islContext.actor) {
      setter.set(carrier, ISL_HEADERS.ACTOR, islContext.actor);
    }

    if (islContext.idempotencyKey) {
      setter.set(carrier, ISL_HEADERS.IDEMPOTENCY_KEY, islContext.idempotencyKey);
    }

    if (islContext.trustScore !== undefined) {
      setter.set(carrier, ISL_HEADERS.TRUST_SCORE, String(islContext.trustScore));
    }

    if (islContext.parentVerificationId) {
      setter.set(
        carrier,
        ISL_HEADERS.PARENT_VERIFICATION_ID,
        islContext.parentVerificationId
      );
    }
  }

  /**
   * Extract ISL context from carrier (e.g., HTTP headers)
   */
  extract(
    ctx: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>
  ): Context {
    const domain = getter.get(carrier, ISL_HEADERS.DOMAIN);
    if (!domain) return ctx;

    const islContext: ISLContextData = {
      domain: Array.isArray(domain) ? domain[0] ?? '' : domain,
    };

    const behavior = getter.get(carrier, ISL_HEADERS.BEHAVIOR);
    if (behavior) {
      islContext.behavior = Array.isArray(behavior) ? behavior[0] : behavior;
    }

    const verificationId = getter.get(carrier, ISL_HEADERS.VERIFICATION_ID);
    if (verificationId) {
      islContext.verificationId = Array.isArray(verificationId)
        ? verificationId[0]
        : verificationId;
    }

    const actor = getter.get(carrier, ISL_HEADERS.ACTOR);
    if (actor) {
      islContext.actor = Array.isArray(actor) ? actor[0] : actor;
    }

    const idempotencyKey = getter.get(carrier, ISL_HEADERS.IDEMPOTENCY_KEY);
    if (idempotencyKey) {
      islContext.idempotencyKey = Array.isArray(idempotencyKey)
        ? idempotencyKey[0]
        : idempotencyKey;
    }

    const trustScore = getter.get(carrier, ISL_HEADERS.TRUST_SCORE);
    if (trustScore) {
      const score = Array.isArray(trustScore) ? trustScore[0] : trustScore;
      islContext.trustScore = score ? parseFloat(score) : undefined;
    }

    const parentVerificationId = getter.get(
      carrier,
      ISL_HEADERS.PARENT_VERIFICATION_ID
    );
    if (parentVerificationId) {
      islContext.parentVerificationId = Array.isArray(parentVerificationId)
        ? parentVerificationId[0]
        : parentVerificationId;
    }

    return setISLContext(ctx, islContext);
  }

  /**
   * Return the fields that will be injected
   */
  fields(): string[] {
    return Object.values(ISL_HEADERS);
  }
}

/**
 * Composite propagator that combines ISL context with span context
 */
export class ISLCompositePropagator implements TextMapPropagator {
  private islPropagator = new ISLContextPropagator();
  private spanPropagators: TextMapPropagator[];

  constructor(spanPropagators: TextMapPropagator[] = []) {
    this.spanPropagators = spanPropagators;
  }

  inject(
    ctx: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>
  ): void {
    // Inject span context from all propagators
    for (const propagator of this.spanPropagators) {
      propagator.inject(ctx, carrier, setter);
    }

    // Inject ISL context
    this.islPropagator.inject(ctx, carrier, setter);
  }

  extract(
    ctx: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>
  ): Context {
    // Extract span context from all propagators
    let resultCtx = ctx;
    for (const propagator of this.spanPropagators) {
      resultCtx = propagator.extract(resultCtx, carrier, getter);
    }

    // Extract ISL context
    return this.islPropagator.extract(resultCtx, carrier, getter);
  }

  fields(): string[] {
    const allFields = [...this.islPropagator.fields()];
    for (const propagator of this.spanPropagators) {
      allFields.push(...propagator.fields());
    }
    return [...new Set(allFields)];
  }
}

/**
 * Create ISL context from current span
 */
export function createISLContextFromSpan(
  span: Span,
  domain: string,
  behavior?: string
): ISLContextData {
  const spanContext = span.spanContext();

  return {
    domain,
    behavior,
    verificationId: spanContext.traceId,
  };
}

/**
 * Utility to create headers object from ISL context
 */
export function createISLHeaders(islContext: ISLContextData): Record<string, string> {
  const headers: Record<string, string> = {
    [ISL_HEADERS.DOMAIN]: islContext.domain,
  };

  if (islContext.behavior) {
    headers[ISL_HEADERS.BEHAVIOR] = islContext.behavior;
  }

  if (islContext.verificationId) {
    headers[ISL_HEADERS.VERIFICATION_ID] = islContext.verificationId;
  }

  if (islContext.actor) {
    headers[ISL_HEADERS.ACTOR] = islContext.actor;
  }

  if (islContext.idempotencyKey) {
    headers[ISL_HEADERS.IDEMPOTENCY_KEY] = islContext.idempotencyKey;
  }

  if (islContext.trustScore !== undefined) {
    headers[ISL_HEADERS.TRUST_SCORE] = String(islContext.trustScore);
  }

  if (islContext.parentVerificationId) {
    headers[ISL_HEADERS.PARENT_VERIFICATION_ID] = islContext.parentVerificationId;
  }

  return headers;
}

/**
 * Parse ISL context from headers object
 */
export function parseISLHeaders(
  headers: Record<string, string | string[] | undefined>
): ISLContextData | undefined {
  const getValue = (key: string): string | undefined => {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const domain = getValue(ISL_HEADERS.DOMAIN);
  if (!domain) return undefined;

  return {
    domain,
    behavior: getValue(ISL_HEADERS.BEHAVIOR),
    verificationId: getValue(ISL_HEADERS.VERIFICATION_ID),
    actor: getValue(ISL_HEADERS.ACTOR),
    idempotencyKey: getValue(ISL_HEADERS.IDEMPOTENCY_KEY),
    trustScore: getValue(ISL_HEADERS.TRUST_SCORE)
      ? parseFloat(getValue(ISL_HEADERS.TRUST_SCORE)!)
      : undefined,
    parentVerificationId: getValue(ISL_HEADERS.PARENT_VERIFICATION_ID),
  };
}
