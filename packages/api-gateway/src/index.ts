/**
 * ISL API Gateway
 * 
 * Runtime contract enforcement at the API layer.
 */

export {
  ISLGateway,
  createGateway,
  type GatewayOptions,
  type GatewayConfig,
} from './gateway.js';

export {
  RouteHandler,
  createRouteHandler,
  type Route,
  type RouteConfig,
  type RouteMatch,
} from './router.js';

export {
  RequestValidator,
  validateRequest,
  type ValidationResult,
  type ValidationError,
} from './validator.js';

export {
  ResponseTransformer,
  transformResponse,
  type TransformOptions,
  type TransformResult,
} from './transformer.js';

export {
  RateLimiter,
  createRateLimiter,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limiter.js';

export {
  CircuitBreaker,
  createCircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitState,
} from './circuit-breaker.js';

export {
  PolicyEngine,
  evaluatePolicy,
  type Policy,
  type PolicyDecision,
} from './policy.js';

export {
  Telemetry,
  type TelemetryConfig,
  type RequestMetrics,
} from './telemetry.js';
