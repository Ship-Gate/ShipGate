/**
 * ISL Gateway
 * 
 * Main gateway class that orchestrates ISL-aware request handling.
 */

import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import { RouteHandler, type Route, type RouteMatch } from './router.js';
import { RequestValidator, type ValidationResult } from './validator.js';
import { ResponseTransformer, type TransformResult } from './transformer.js';
import { RateLimiter, type RateLimitConfig } from './rate-limiter.js';
import { CircuitBreaker, type CircuitBreakerConfig, type CircuitState } from './circuit-breaker.js';
import { PolicyEngine, type Policy, type PolicyDecision } from './policy.js';
import { Telemetry, type TelemetryConfig } from './telemetry.js';

export interface GatewayOptions {
  /** ISL specification sources */
  specs: Array<{ source: string; file?: string }>;
  /** Upstream services */
  upstreams: UpstreamConfig[];
  /** Rate limiting config */
  rateLimiting?: RateLimitConfig;
  /** Circuit breaker config */
  circuitBreaker?: CircuitBreakerConfig;
  /** Policies */
  policies?: Policy[];
  /** Telemetry config */
  telemetry?: TelemetryConfig;
  /** Enforcement mode */
  mode?: 'enforce' | 'monitor' | 'disabled';
  /** Request timeout */
  timeout?: number;
}

export interface UpstreamConfig {
  /** Upstream name */
  name: string;
  /** Base URL */
  url: string;
  /** Domain this upstream handles */
  domain: string;
  /** Health check endpoint */
  healthCheck?: string;
  /** Retry config */
  retries?: number;
  /** Connection timeout */
  timeout?: number;
}

export interface GatewayConfig {
  /** Listen port */
  port: number;
  /** Listen host */
  host: string;
  /** TLS config */
  tls?: TLSConfig;
  /** Access log */
  accessLog?: boolean;
}

export interface TLSConfig {
  cert: string;
  key: string;
  ca?: string;
}

export interface GatewayRequest {
  /** Request ID */
  id: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Query parameters */
  query: Record<string, string | string[]>;
  /** Headers */
  headers: Record<string, string>;
  /** Request body */
  body: unknown;
  /** Client IP */
  clientIp: string;
  /** Timestamp */
  timestamp: Date;
}

export interface GatewayResponse {
  /** Status code */
  status: number;
  /** Headers */
  headers: Record<string, string>;
  /** Response body */
  body: unknown;
  /** ISL validation result */
  validation?: ValidationResult;
  /** Processing time */
  processingTime: number;
}

/**
 * ISL Gateway
 */
export class ISLGateway {
  private options: GatewayOptions;
  private domains = new Map<string, DomainDeclaration>();
  private router: RouteHandler;
  private validator: RequestValidator;
  private transformer: ResponseTransformer;
  private rateLimiter?: RateLimiter;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private policyEngine: PolicyEngine;
  private telemetry: Telemetry;
  private running = false;

  constructor(options: GatewayOptions) {
    this.options = options;
    this.router = new RouteHandler();
    this.validator = new RequestValidator();
    this.transformer = new ResponseTransformer();
    this.policyEngine = new PolicyEngine(options.policies ?? []);
    this.telemetry = new Telemetry(options.telemetry);

    // Initialize rate limiter
    if (options.rateLimiting) {
      this.rateLimiter = new RateLimiter(options.rateLimiting);
    }

    // Initialize circuit breakers for each upstream
    for (const upstream of options.upstreams) {
      this.circuitBreakers.set(
        upstream.name,
        new CircuitBreaker(upstream.name, options.circuitBreaker)
      );
    }

    // Parse ISL specifications
    this.loadSpecs();
  }

  /**
   * Load ISL specifications
   */
  private loadSpecs(): void {
    for (const spec of this.options.specs) {
      const result = parseISL(spec.source, spec.file);

      if (result.errors.length > 0) {
        throw new Error(
          `Failed to parse ISL spec ${spec.file}: ${result.errors[0]?.message}`
        );
      }

      if (result.ast) {
        this.domains.set(result.ast.name.name, result.ast);
        this.router.registerDomain(result.ast);
        this.validator.registerDomain(result.ast);
      }
    }
  }

  /**
   * Handle an incoming request
   */
  async handleRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    const requestId = request.id;

    // Telemetry: start request
    this.telemetry.startRequest(requestId, request);

    try {
      // 1. Rate limiting check
      if (this.rateLimiter) {
        const rateLimitResult = await this.rateLimiter.check(request.clientIp);
        
        if (!rateLimitResult.allowed) {
          this.telemetry.recordRateLimited(requestId);
          return {
            status: 429,
            headers: {
              'X-RateLimit-Remaining': String(rateLimitResult.remaining),
              'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            },
            body: { error: 'Rate limit exceeded' },
            processingTime: Date.now() - startTime,
          };
        }
      }

      // 2. Route matching
      const route = this.router.match(request.method, request.path);

      if (!route) {
        return {
          status: 404,
          headers: {},
          body: { error: 'Not found' },
          processingTime: Date.now() - startTime,
        };
      }

      // 3. Policy evaluation
      const policyDecision = await this.policyEngine.evaluate({
        request,
        route,
        context: {},
      });

      if (!policyDecision.allowed) {
        this.telemetry.recordPolicyDenied(requestId, policyDecision.reason);
        return {
          status: 403,
          headers: {},
          body: { error: policyDecision.reason ?? 'Access denied' },
          processingTime: Date.now() - startTime,
        };
      }

      // 4. Request validation (ISL preconditions)
      const validation = await this.validator.validate(
        route.domain,
        route.behavior,
        request.body
      );

      if (!validation.valid && this.options.mode === 'enforce') {
        this.telemetry.recordValidationFailed(requestId, validation);
        return {
          status: 400,
          headers: {},
          body: {
            error: 'Request validation failed',
            violations: validation.violations,
          },
          validation,
          processingTime: Date.now() - startTime,
        };
      }

      // 5. Circuit breaker check
      const upstream = this.findUpstream(route.domain);
      const circuitBreaker = this.circuitBreakers.get(upstream.name);

      if (circuitBreaker && !circuitBreaker.isAllowed()) {
        this.telemetry.recordCircuitOpen(requestId, upstream.name);
        return {
          status: 503,
          headers: {},
          body: { error: 'Service temporarily unavailable' },
          processingTime: Date.now() - startTime,
        };
      }

      // 6. Forward to upstream
      let upstreamResponse: unknown;
      try {
        upstreamResponse = await this.forwardRequest(upstream, route, request);
        circuitBreaker?.recordSuccess();
      } catch (error) {
        circuitBreaker?.recordFailure();
        throw error;
      }

      // 7. Response transformation
      const transformResult = await this.transformer.transform(
        route.domain,
        route.behavior,
        upstreamResponse
      );

      // 8. Response validation (ISL postconditions)
      const responseValidation = await this.validator.validateResponse(
        route.domain,
        route.behavior,
        transformResult.data
      );

      if (!responseValidation.valid && this.options.mode === 'enforce') {
        this.telemetry.recordPostconditionFailed(requestId, responseValidation);
        // Log but don't block - upstream already processed
      }

      // Telemetry: complete request
      this.telemetry.completeRequest(requestId, 200);

      return {
        status: 200,
        headers: transformResult.headers ?? {},
        body: transformResult.data,
        validation: responseValidation,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      this.telemetry.recordError(requestId, error);

      return {
        status: 500,
        headers: {},
        body: {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Find upstream for domain
   */
  private findUpstream(domain: string): UpstreamConfig {
    const upstream = this.options.upstreams.find((u) => u.domain === domain);

    if (!upstream) {
      throw new Error(`No upstream configured for domain: ${domain}`);
    }

    return upstream;
  }

  /**
   * Forward request to upstream
   */
  private async forwardRequest(
    upstream: UpstreamConfig,
    route: RouteMatch,
    request: GatewayRequest
  ): Promise<unknown> {
    const url = `${upstream.url}${request.path}`;
    const timeout = upstream.timeout ?? this.options.timeout ?? 30000;

    // In a real implementation, this would make an HTTP request
    // For now, we simulate the upstream call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate successful response
        resolve({
          status: 'success',
          data: request.body,
          behavior: route.behavior,
        });
      }, 10);
    });
  }

  /**
   * Start the gateway
   */
  async start(config: GatewayConfig): Promise<void> {
    if (this.running) {
      throw new Error('Gateway is already running');
    }

    // Start telemetry
    this.telemetry.start();

    // In a real implementation, start HTTP server here
    this.running = true;

    console.log(`ISL Gateway started on ${config.host}:${config.port}`);
  }

  /**
   * Stop the gateway
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.telemetry.stop();
    this.running = false;
  }

  /**
   * Get gateway health status
   */
  getHealth(): GatewayHealth {
    const upstreamStatus: Record<string, CircuitState> = {};

    for (const [name, breaker] of this.circuitBreakers) {
      upstreamStatus[name] = breaker.getState();
    }

    return {
      status: this.running ? 'healthy' : 'stopped',
      upstreams: upstreamStatus,
      domains: Array.from(this.domains.keys()),
      metrics: this.telemetry.getMetrics(),
    };
  }

  /**
   * Get loaded domains
   */
  getDomains(): string[] {
    return Array.from(this.domains.keys());
  }

  /**
   * Reload ISL specifications
   */
  async reload(): Promise<void> {
    this.domains.clear();
    this.loadSpecs();
  }
}

export interface GatewayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
  upstreams: Record<string, CircuitState>;
  domains: string[];
  metrics: Record<string, number>;
}

/**
 * Create a gateway instance
 */
export function createGateway(options: GatewayOptions): ISLGateway {
  return new ISLGateway(options);
}
