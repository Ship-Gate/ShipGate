import type * as AST from '@isl-lang/parser';
import type {
  ParsedSpec,
  TrafficSample,
  SpecViolation,
  ViolationSeverity,
} from './types.js';

// ---------------------------------------------------------------------------
// Internal route-level spec index
// ---------------------------------------------------------------------------

interface RouteSpec {
  route: string;
  method: string;
  /** Expected successful status codes (derived from behavior output) */
  expectedStatuses: number[];
  /** Entity field names expected in the response body */
  expectedFields: string[];
  /** Whether the spec declares security requirements (auth required) */
  requiresAuth: boolean;
  /** Latency SLA in ms (from temporal specs) */
  maxLatencyMs: number | null;
}

/**
 * Validates live traffic samples against parsed ISL specifications.
 *
 * Builds an internal index of route-level expectations from the AST,
 * then checks each sample for status-code, response-shape, auth,
 * and latency conformance.
 */
export class TrafficValidator {
  private readonly routeIndex = new Map<string, RouteSpec>();

  constructor(specs: ParsedSpec[]) {
    this.buildIndex(specs);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  validate(sample: TrafficSample): SpecViolation[] {
    const violations: SpecViolation[] = [];
    const key = routeKey(sample.method, sample.route);
    const spec = this.routeIndex.get(key) ?? this.findByWildcard(sample);

    if (!spec) return violations;

    this.checkStatusCode(sample, spec, violations);
    this.checkResponseShape(sample, spec, violations);
    this.checkAuth(sample, spec, violations);
    this.checkLatency(sample, spec, violations);

    return violations;
  }

  /** All routes that have been indexed. */
  get indexedRoutes(): string[] {
    return [...this.routeIndex.keys()];
  }

  // -----------------------------------------------------------------------
  // Index builder — maps ISL behaviors to route expectations
  // -----------------------------------------------------------------------

  private buildIndex(specs: ParsedSpec[]): void {
    for (const spec of specs) {
      if (!spec.success || !spec.domain) continue;
      const domain = spec.domain;

      for (const behavior of domain.behaviors) {
        const route = this.inferRoute(behavior, domain);
        const method = this.inferMethod(behavior);

        const routeSpec: RouteSpec = {
          route,
          method,
          expectedStatuses: this.inferStatuses(behavior),
          expectedFields: this.inferFields(behavior, domain),
          requiresAuth: behavior.security.length > 0,
          maxLatencyMs: this.inferLatency(behavior),
        };

        this.routeIndex.set(routeKey(method, route), routeSpec);
      }
    }
  }

  /**
   * Derive the route path from the behavior name.
   * Follows the convention: `CreateUser` → `/users`, `GetOrder` → `/orders`,
   * falling back to a kebab-cased version of the behavior name.
   */
  private inferRoute(behavior: AST.Behavior, domain: AST.Domain): string {
    const name = behavior.name.name;

    for (const api of domain.apis ?? []) {
      for (const endpoint of api.endpoints ?? []) {
        if (endpoint.behavior?.name === name) {
          return endpoint.path?.value ?? `/${toKebab(name)}`;
        }
      }
    }

    const prefixes = ['Create', 'Get', 'Update', 'Delete', 'List', 'Remove', 'Add', 'Set'];
    for (const prefix of prefixes) {
      if (name.startsWith(prefix)) {
        const resource = name.slice(prefix.length);
        return `/${toKebab(resource)}s`;
      }
    }
    return `/${toKebab(name)}`;
  }

  private inferMethod(behavior: AST.Behavior): string {
    const name = behavior.name.name.toLowerCase();
    if (name.startsWith('create') || name.startsWith('add')) return 'POST';
    if (name.startsWith('update') || name.startsWith('set')) return 'PUT';
    if (name.startsWith('delete') || name.startsWith('remove')) return 'DELETE';
    if (name.startsWith('list') || name.startsWith('get') || name.startsWith('fetch'))
      return 'GET';
    return 'POST';
  }

  private inferStatuses(behavior: AST.Behavior): number[] {
    const statuses: number[] = [];
    const name = behavior.name.name.toLowerCase();

    if (name.startsWith('create')) {
      statuses.push(201);
    } else if (name.startsWith('delete') || name.startsWith('remove')) {
      statuses.push(200, 204);
    } else {
      statuses.push(200);
    }

    // Behaviors with error specs imply possible 4xx/5xx, but successful
    // traffic should match the happy-path codes above.
    return statuses;
  }

  /**
   * Collect expected response field names from the behavior output
   * and any referenced entity definitions.
   */
  private inferFields(behavior: AST.Behavior, domain: AST.Domain): string[] {
    const fields: string[] = [];

    if (behavior.output?.fields) {
      for (const field of behavior.output.fields) {
        fields.push(field.name.name);

        if (field.type.kind === 'ReferenceType') {
          const refName =
            typeof field.type.name === 'string'
              ? field.type.name
              : field.type.name.parts.map((p: AST.Identifier) => p.name).join('.');
          const entity = domain.entities.find((e) => e.name.name === refName);
          if (entity) {
            for (const ef of entity.fields) {
              fields.push(ef.name.name);
            }
          }
        }
      }
    }

    return fields;
  }

  private inferLatency(behavior: AST.Behavior): number | null {
    if (!behavior.temporal || behavior.temporal.length === 0) return null;

    for (const t of behavior.temporal) {
      // Look for a duration literal in the temporal spec
      const kind = (t as unknown as Record<string, unknown>).kind;
      if (kind === 'TemporalSpec') {
        const raw = t as unknown as { duration?: { value: number; unit: string } };
        if (raw.duration) {
          return durationToMs(raw.duration.value, raw.duration.unit);
        }
      }
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Individual checks
  // -----------------------------------------------------------------------

  private checkStatusCode(
    sample: TrafficSample,
    spec: RouteSpec,
    violations: SpecViolation[],
  ): void {
    if (sample.statusCode >= 400) return; // error responses checked elsewhere

    if (spec.expectedStatuses.length > 0 && !spec.expectedStatuses.includes(sample.statusCode)) {
      violations.push({
        sampleId: sample.requestId,
        route: sample.route,
        type: 'status-code',
        expected: spec.expectedStatuses.join(' | '),
        actual: String(sample.statusCode),
        severity: 'medium',
      });
    }
  }

  private checkResponseShape(
    sample: TrafficSample,
    spec: RouteSpec,
    violations: SpecViolation[],
  ): void {
    if (!sample.responseBody || spec.expectedFields.length === 0) return;
    if (sample.statusCode >= 400) return;

    const body =
      typeof sample.responseBody === 'object' ? sample.responseBody : null;
    if (!body) return;

    const bodyKeys = collectKeys(body as Record<string, unknown>);

    const missing = spec.expectedFields.filter((f) => !bodyKeys.has(f));
    if (missing.length > 0) {
      violations.push({
        sampleId: sample.requestId,
        route: sample.route,
        type: 'response-shape',
        expected: `fields: ${spec.expectedFields.join(', ')}`,
        actual: `missing: ${missing.join(', ')}`,
        severity: severityForMissingRatio(missing.length, spec.expectedFields.length),
      });
    }
  }

  private checkAuth(
    sample: TrafficSample,
    spec: RouteSpec,
    violations: SpecViolation[],
  ): void {
    if (!spec.requiresAuth) return;

    const hasAuth =
      !!sample.headers['authorization'] ||
      !!sample.headers['x-api-key'] ||
      !!sample.headers['cookie'];

    if (!hasAuth && sample.statusCode < 400) {
      violations.push({
        sampleId: sample.requestId,
        route: sample.route,
        type: 'auth',
        expected: 'authorization header required',
        actual: 'no auth header present on successful response',
        severity: 'critical',
      });
    }
  }

  private checkLatency(
    sample: TrafficSample,
    spec: RouteSpec,
    violations: SpecViolation[],
  ): void {
    if (spec.maxLatencyMs === null) return;

    if (sample.latencyMs > spec.maxLatencyMs) {
      violations.push({
        sampleId: sample.requestId,
        route: sample.route,
        type: 'latency',
        expected: `<= ${spec.maxLatencyMs}ms`,
        actual: `${Math.round(sample.latencyMs)}ms`,
        severity: sample.latencyMs > spec.maxLatencyMs * 2 ? 'high' : 'medium',
      });
    }
  }

  // -----------------------------------------------------------------------
  // Wildcard route matching (for parameterised paths)
  // -----------------------------------------------------------------------

  private findByWildcard(sample: TrafficSample): RouteSpec | undefined {
    const segments = sample.route.split('/').filter(Boolean);

    for (const [, spec] of this.routeIndex) {
      if (spec.method !== sample.method) continue;
      const specSegments = spec.route.split('/').filter(Boolean);
      if (specSegments.length !== segments.length) continue;

      const match = specSegments.every((seg, i) => seg.startsWith(':') || seg === segments[i]);
      if (match) return spec;
    }
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function routeKey(method: string, route: string): string {
  return `${method.toUpperCase()} ${route}`;
}

function toKebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function durationToMs(value: number, unit: string): number {
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1_000;
    case 'm':
      return value * 60_000;
    default:
      return value;
  }
}

function collectKeys(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    keys.add(key);
    keys.add(full);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of collectKeys(value as Record<string, unknown>, full)) {
        keys.add(nested);
      }
    }
  }
  return keys;
}

function severityForMissingRatio(
  missing: number,
  total: number,
): ViolationSeverity {
  const ratio = missing / total;
  if (ratio > 0.5) return 'high';
  if (ratio > 0.25) return 'medium';
  return 'low';
}
