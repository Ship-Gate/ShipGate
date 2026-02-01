// ============================================================================
// SLA Threshold Extraction and Generation
// ============================================================================

import type {
  Behavior,
  TemporalSpec,
  SecuritySpec,
  DurationLiteral,
  BehaviorSLA,
  SLAThreshold,
  RateLimit,
  InputFieldSpec,
  Field,
} from './ast-types';

/**
 * Extract SLA information from a behavior
 */
export function extractBehaviorSLA(behavior: Behavior): BehaviorSLA {
  return {
    name: behavior.name.name,
    thresholds: extractThresholds(behavior.temporal),
    rateLimits: extractRateLimits(behavior.security),
    inputFields: extractInputFields(behavior.input.fields),
    successCodes: [200, 201],
    maxErrorRate: 1, // Default 1%
  };
}

/**
 * Extract response time thresholds from temporal specs
 */
export function extractThresholds(temporalSpecs: TemporalSpec[]): SLAThreshold[] {
  const thresholds: SLAThreshold[] = [];

  for (const spec of temporalSpecs) {
    if (spec.operator === 'within' && spec.duration) {
      const durationMs = durationToMs(spec.duration);
      const percentile = spec.percentile || 50;

      thresholds.push({
        percentile,
        durationMs,
      });
    }
  }

  // Sort by percentile
  thresholds.sort((a, b) => a.percentile - b.percentile);

  // If no thresholds found, add defaults
  if (thresholds.length === 0) {
    thresholds.push(
      { percentile: 50, durationMs: 200 },
      { percentile: 95, durationMs: 500 },
      { percentile: 99, durationMs: 1000 }
    );
  }

  return thresholds;
}

/**
 * Extract rate limits from security specs
 */
export function extractRateLimits(securitySpecs: SecuritySpec[]): RateLimit[] {
  const rateLimits: RateLimit[] = [];

  for (const spec of securitySpecs) {
    if (spec.type === 'rate_limit') {
      // Parse rate limit expression like "100/minute per user"
      const rateLimit = parseRateLimit(spec.details);
      if (rateLimit) {
        rateLimits.push(rateLimit);
      }
    }
  }

  // If no rate limits found, add a default
  if (rateLimits.length === 0) {
    rateLimits.push({
      count: 100,
      periodSeconds: 60,
      scope: 'user',
    });
  }

  return rateLimits;
}

/**
 * Parse rate limit expression
 */
function parseRateLimit(expr: unknown): RateLimit | null {
  // Handle various expression formats
  if (!expr || typeof expr !== 'object') {
    return {
      count: 100,
      periodSeconds: 60,
      scope: 'user',
    };
  }

  const e = expr as { kind?: string; value?: unknown; name?: string };
  
  // Try to extract from identifier or expression
  if (e.kind === 'Identifier' && typeof e.name === 'string') {
    // Parse patterns like "100_per_minute"
    const match = e.name.match(/(\d+)_per_(second|minute|hour)/);
    if (match) {
      const count = parseInt(match[1], 10);
      const period = match[2];
      return {
        count,
        periodSeconds: periodToSeconds(period),
        scope: 'user',
      };
    }
  }

  return {
    count: 100,
    periodSeconds: 60,
    scope: 'user',
  };
}

/**
 * Extract input field specifications for test data generation
 */
export function extractInputFields(fields: Field[]): InputFieldSpec[] {
  return fields.map(field => ({
    name: field.name.name,
    type: getFieldType(field.type),
    optional: field.optional,
    generator: inferGenerator(field),
  }));
}

/**
 * Get string representation of field type
 */
function getFieldType(typeDef: unknown): string {
  if (!typeDef || typeof typeDef !== 'object') return 'string';
  const t = typeDef as { kind?: string; name?: string };
  
  if (t.kind === 'PrimitiveType') {
    return t.name || 'string';
  }
  if (t.kind === 'ReferenceType') {
    return 'reference';
  }
  return 'string';
}

/**
 * Infer the appropriate test data generator for a field
 */
function inferGenerator(field: Field): InputFieldSpec['generator'] {
  const name = field.name.name.toLowerCase();
  const type = getFieldType(field.type);

  // Check field name patterns
  if (name.includes('email')) return 'email';
  if (name.includes('uuid') || name === 'id') return 'uuid';
  if (name.includes('date') || name.includes('time') || name.includes('timestamp')) return 'timestamp';

  // Check type
  if (type === 'UUID') return 'uuid';
  if (type === 'Timestamp') return 'timestamp';
  if (type === 'Int' || type === 'Decimal') return 'number';
  if (type === 'Boolean') return 'boolean';

  return 'string';
}

/**
 * Convert duration literal to milliseconds
 */
export function durationToMs(duration: DurationLiteral): number {
  switch (duration.unit) {
    case 'ms':
      return duration.value;
    case 'seconds':
      return duration.value * 1000;
    case 'minutes':
      return duration.value * 60 * 1000;
    case 'hours':
      return duration.value * 60 * 60 * 1000;
    case 'days':
      return duration.value * 24 * 60 * 60 * 1000;
    default:
      return duration.value;
  }
}

/**
 * Convert period name to seconds
 */
function periodToSeconds(period: string): number {
  switch (period) {
    case 'second':
      return 1;
    case 'minute':
      return 60;
    case 'hour':
      return 3600;
    default:
      return 60;
  }
}

/**
 * Calculate sleep time between requests based on rate limit
 */
export function calculateSleepTime(rateLimit: RateLimit): number {
  // Convert to requests per second
  const requestsPerSecond = rateLimit.count / rateLimit.periodSeconds;
  // Return sleep time in seconds (with some buffer)
  return Math.max(0.1, 1 / requestsPerSecond * 0.9);
}

/**
 * Format threshold for k6 options
 */
export function formatK6Threshold(threshold: SLAThreshold): string {
  return `p(${threshold.percentile})<${threshold.durationMs}`;
}

/**
 * Format threshold for Artillery config
 */
export function formatArtilleryThreshold(threshold: SLAThreshold): { key: string; value: number } {
  return {
    key: `p${threshold.percentile}`,
    value: threshold.durationMs,
  };
}
