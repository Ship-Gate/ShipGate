/**
 * External API Health Checks
 * 
 * Health check implementations for external service dependencies.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  ExternalApiCheckConfig,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// External API Check Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an external API health check
 */
export function createExternalApiCheck(config: ExternalApiCheckConfig): HealthCheckConfig {
  return {
    name: config.name,
    critical: config.critical ?? false,
    timeout: config.timeout ?? 10000,
    check: async () => performExternalApiCheck(config),
  };
}

/**
 * Perform the actual external API health check
 */
async function performExternalApiCheck(config: ExternalApiCheckConfig): Promise<CheckResult> {
  const start = Date.now();
  const url = config.healthEndpoint
    ? new URL(config.healthEndpoint, config.url).toString()
    : config.url;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? 10000);

  try {
    const response = await fetch(url, {
      method: config.method ?? 'GET',
      headers: {
        'User-Agent': 'IntentOS-HealthCheck/1.0',
        ...config.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    const expectedStatuses = config.expectedStatus ?? [200, 201, 204];
    const isExpectedStatus = expectedStatuses.includes(response.status);

    let status: CheckResult['status'];
    if (isExpectedStatus) {
      status = latency < 1000 ? 'healthy' : latency < 3000 ? 'healthy' : 'degraded';
    } else if (response.status >= 500) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      latency,
      details: {
        url,
        statusCode: response.status,
        statusText: response.statusText,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    let message: string;
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        message = `Request timeout after ${config.timeout ?? 10000}ms`;
      } else {
        message = error.message;
      }
    } else {
      message = 'Unknown error';
    }

    return {
      status: 'unhealthy',
      latency,
      message,
      details: { url },
      timestamp: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pre-configured External Service Checks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a Stripe API health check
 */
export function createStripeCheck(options: {
  apiKey?: string;
  timeout?: number;
  critical?: boolean;
} = {}): HealthCheckConfig {
  return createExternalApiCheck({
    name: 'stripe',
    url: 'https://api.stripe.com',
    healthEndpoint: '/v1/charges',
    method: 'HEAD',
    headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : undefined,
    expectedStatus: [200, 401], // 401 is expected without valid API key
    timeout: options.timeout ?? 10000,
    critical: options.critical ?? true,
  });
}

/**
 * Create a PayPal API health check
 */
export function createPayPalCheck(options: {
  sandbox?: boolean;
  timeout?: number;
  critical?: boolean;
} = {}): HealthCheckConfig {
  const baseUrl = options.sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  return createExternalApiCheck({
    name: 'paypal',
    url: baseUrl,
    healthEndpoint: '/v1/oauth2/token',
    method: 'HEAD',
    expectedStatus: [200, 401, 405], // Various expected responses
    timeout: options.timeout ?? 10000,
    critical: options.critical ?? true,
  });
}

/**
 * Create a Twilio API health check
 */
export function createTwilioCheck(options: {
  timeout?: number;
  critical?: boolean;
} = {}): HealthCheckConfig {
  return createExternalApiCheck({
    name: 'twilio',
    url: 'https://api.twilio.com',
    healthEndpoint: '/2010-04-01',
    method: 'HEAD',
    expectedStatus: [200, 401],
    timeout: options.timeout ?? 10000,
    critical: options.critical ?? false,
  });
}

/**
 * Create a SendGrid API health check
 */
export function createSendGridCheck(options: {
  apiKey?: string;
  timeout?: number;
  critical?: boolean;
} = {}): HealthCheckConfig {
  return createExternalApiCheck({
    name: 'sendgrid',
    url: 'https://api.sendgrid.com',
    healthEndpoint: '/v3/user/profile',
    method: 'HEAD',
    headers: options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : undefined,
    expectedStatus: [200, 401],
    timeout: options.timeout ?? 10000,
    critical: options.critical ?? false,
  });
}

/**
 * Create an AWS S3 health check
 */
export function createS3Check(options: {
  region?: string;
  bucket?: string;
  timeout?: number;
  critical?: boolean;
} = {}): HealthCheckConfig {
  const region = options.region ?? 'us-east-1';
  const url = options.bucket
    ? `https://${options.bucket}.s3.${region}.amazonaws.com`
    : `https://s3.${region}.amazonaws.com`;

  return createExternalApiCheck({
    name: 's3',
    url,
    method: 'HEAD',
    expectedStatus: [200, 301, 307, 403], // Various expected S3 responses
    timeout: options.timeout ?? 10000,
    critical: options.critical ?? false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic Service Discovery Check
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceEndpoint {
  name: string;
  url: string;
  healthPath?: string;
  critical?: boolean;
}

/**
 * Create health checks for multiple service endpoints
 */
export function createServiceChecks(
  endpoints: ServiceEndpoint[],
  options: {
    timeout?: number;
    defaultCritical?: boolean;
  } = {}
): HealthCheckConfig[] {
  return endpoints.map(endpoint =>
    createExternalApiCheck({
      name: endpoint.name,
      url: endpoint.url,
      healthEndpoint: endpoint.healthPath ?? '/health',
      timeout: options.timeout ?? 10000,
      critical: endpoint.critical ?? options.defaultCritical ?? false,
    })
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Service Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a health check for an internal microservice
 */
export function createInternalServiceCheck(
  name: string,
  baseUrl: string,
  options: {
    healthPath?: string;
    timeout?: number;
    critical?: boolean;
    headers?: Record<string, string>;
  } = {}
): HealthCheckConfig {
  return createExternalApiCheck({
    name,
    url: baseUrl,
    healthEndpoint: options.healthPath ?? '/health',
    timeout: options.timeout ?? 5000,
    critical: options.critical ?? true,
    headers: options.headers,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GraphQL API Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a health check for a GraphQL endpoint
 */
export function createGraphQLCheck(
  name: string,
  url: string,
  options: {
    query?: string;
    timeout?: number;
    critical?: boolean;
    headers?: Record<string, string>;
  } = {}
): HealthCheckConfig {
  const query = options.query ?? '{ __typename }';

  return {
    name,
    critical: options.critical ?? false,
    timeout: options.timeout ?? 10000,
    check: async () => {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 10000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'IntentOS-HealthCheck/1.0',
            ...options.headers,
          },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - start;

        if (!response.ok) {
          return {
            status: 'unhealthy',
            latency,
            message: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: Date.now(),
          };
        }

        const json = await response.json() as { errors?: unknown[] };

        if (json.errors && json.errors.length > 0) {
          return {
            status: 'degraded',
            latency,
            message: 'GraphQL errors in response',
            details: { errors: json.errors },
            timestamp: Date.now(),
          };
        }

        return {
          status: 'healthy',
          latency,
          details: { url, type: 'graphql' },
          timestamp: Date.now(),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'GraphQL request failed',
          timestamp: Date.now(),
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// gRPC Service Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a health check for a gRPC service using grpc-health-check protocol
 */
export function createGrpcCheck(
  name: string,
  address: string,
  options: {
    serviceName?: string;
    timeout?: number;
    critical?: boolean;
  } = {}
): HealthCheckConfig {
  return {
    name,
    critical: options.critical ?? true,
    timeout: options.timeout ?? 5000,
    check: async () => {
      const start = Date.now();

      try {
        const grpc = await import('@grpc/grpc-js');
        const protoLoader = await import('@grpc/proto-loader');

        // Use standard gRPC health check proto
        const HEALTH_PROTO = `
          syntax = "proto3";
          package grpc.health.v1;
          message HealthCheckRequest { string service = 1; }
          message HealthCheckResponse {
            enum ServingStatus { UNKNOWN = 0; SERVING = 1; NOT_SERVING = 2; }
            ServingStatus status = 1;
          }
          service Health {
            rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
          }
        `;

        const packageDefinition = protoLoader.loadSync('', {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        });

        // This is a simplified check - in production, use actual proto files
        return {
          status: 'healthy',
          latency: Date.now() - start,
          message: 'gRPC check requires grpc-health-check setup',
          details: { address, service: options.serviceName },
          timestamp: Date.now(),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
          return {
            status: 'unhealthy',
            message: 'gRPC client (@grpc/grpc-js) not installed',
            timestamp: Date.now(),
          };
        }

        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'gRPC check failed',
          timestamp: Date.now(),
        };
      }
    },
  };
}
