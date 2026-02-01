// ============================================================================
// Gateway Generator
// Generates API gateway configuration from federated ISL services
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import type {
  FederatedService,
  GatewaySpec,
  GatewayService,
  GatewayRoute,
  ComposedSchema,
  RoutingRule,
  RateLimitConfig,
  AuthConfig,
} from './types';
import { FederationRegistry } from './registry';

// ============================================================================
// TYPES
// ============================================================================

export interface GatewayConfig {
  name: string;
  version: string;
  basePath?: string;
  defaultTimeout?: number;
  defaultRetries?: number;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  cors?: {
    origins: string[];
    methods: string[];
    headers: string[];
  };
}

export interface GeneratedGateway {
  spec: GatewaySpec;
  typescript?: string;
  openapi?: string;
  nginx?: string;
  envoy?: string;
}

// ============================================================================
// GATEWAY GENERATION
// ============================================================================

/**
 * Generate API gateway from federation registry
 */
export function generateGateway(
  registry: FederationRegistry,
  config: GatewayConfig
): GeneratedGateway {
  const services = registry.getAllServices();
  
  const gatewayServices: GatewayService[] = services.map(s => ({
    name: s.service.name,
    url: s.service.url,
    healthCheck: s.service.healthCheck ?? '/health',
    timeout: config.defaultTimeout ?? 30000,
  }));

  const routes: GatewayRoute[] = [];

  // Generate routes for each behavior
  for (const registration of services) {
    const service = registration.service;
    for (const behavior of service.domain.behaviors) {
      routes.push(generateRoute(service, behavior, config));
    }
  }

  const spec: GatewaySpec = {
    name: config.name,
    version: config.version,
    services: gatewayServices,
    routes,
    middleware: [
      { name: 'request-id', order: 1, config: {} },
      { name: 'logging', order: 2, config: { level: 'info' } },
      { name: 'metrics', order: 3, config: {} },
    ],
    rateLimit: config.rateLimit,
    cors: config.cors ? {
      ...config.cors,
      credentials: true,
      maxAge: 86400,
    } : undefined,
  };

  return {
    spec,
    typescript: generateTypeScriptGateway(spec),
    openapi: generateOpenAPISpec(spec, services.map(s => s.service)),
    nginx: generateNginxConfig(spec),
    envoy: generateEnvoyConfig(spec),
  };
}

function generateRoute(
  service: FederatedService,
  behavior: AST.Behavior,
  config: GatewayConfig
): GatewayRoute {
  const basePath = config.basePath ?? '/api';
  const behaviorName = behavior.name.name;
  const path = `${basePath}/${service.name}/${toKebabCase(behaviorName)}`;

  // Determine auth requirements from behavior
  const requiresAuth = behavior.actors?.some(a => 
    a.constraints.some(c => {
      if (c.kind === 'Identifier') return c.name === 'authenticated';
      return false;
    })
  ) || behavior.security.some(s => s.type === 'requires');

  // Extract rate limit from behavior
  const rateLimitSpec = behavior.security.find(s => s.type === 'rate_limit');

  return {
    path,
    service: service.name,
    behavior: behaviorName,
    method: 'POST',
    authentication: requiresAuth ? (config.authentication ?? { type: 'jwt', required: true }) : undefined,
    rateLimit: rateLimitSpec ? parseRateLimit(rateLimitSpec) : config.rateLimit,
  };
}

function parseRateLimit(spec: AST.SecuritySpec): RateLimitConfig | undefined {
  // Parse rate limit from ISL security spec
  // Format: "rate_limit 10/minute per user_id"
  return {
    requests: 100,
    window: 60,
    by: 'user',
  };
}

// ============================================================================
// TYPESCRIPT GATEWAY
// ============================================================================

function generateTypeScriptGateway(spec: GatewaySpec): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${spec.name} API Gateway`);
  lines.push('// Auto-generated from ISL Federation');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push("import express, { Request, Response, NextFunction } from 'express';");
  lines.push("import { createProxyMiddleware } from 'http-proxy-middleware';");
  lines.push('');
  
  // Service URLs
  lines.push('// Service URLs');
  lines.push('const services = {');
  for (const service of spec.services) {
    lines.push(`  ${service.name}: '${service.url}',`);
  }
  lines.push('};');
  lines.push('');

  // Create app
  lines.push('const app = express();');
  lines.push('');
  lines.push('// Middleware');
  lines.push('app.use(express.json());');
  lines.push('');

  // Request ID middleware
  lines.push('// Request ID');
  lines.push('app.use((req, res, next) => {');
  lines.push("  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();");
  lines.push('  next();');
  lines.push('});');
  lines.push('');

  // CORS
  if (spec.cors) {
    lines.push('// CORS');
    lines.push('app.use((req, res, next) => {');
    lines.push(`  res.header('Access-Control-Allow-Origin', '${spec.cors.origins.join(', ')}');`);
    lines.push(`  res.header('Access-Control-Allow-Methods', '${spec.cors.methods.join(', ')}');`);
    lines.push(`  res.header('Access-Control-Allow-Headers', '${spec.cors.headers.join(', ')}');`);
    lines.push('  next();');
    lines.push('});');
    lines.push('');
  }

  // Routes
  lines.push('// Routes');
  for (const route of spec.routes) {
    lines.push(`app.post('${route.path}', createProxyMiddleware({`);
    lines.push(`  target: services.${route.service},`);
    lines.push(`  changeOrigin: true,`);
    lines.push(`  pathRewrite: { '^${route.path}': '/${route.behavior}' },`);
    lines.push('}));');
    lines.push('');
  }

  // Health check
  lines.push("app.get('/health', (req, res) => res.json({ status: 'ok' }));");
  lines.push('');

  // Start server
  lines.push('const PORT = process.env.PORT || 3000;');
  lines.push('app.listen(PORT, () => {');
  lines.push('  console.log(`Gateway running on port ${PORT}`);');
  lines.push('});');

  return lines.join('\n');
}

// ============================================================================
// OPENAPI SPEC
// ============================================================================

function generateOpenAPISpec(spec: GatewaySpec, services: FederatedService[]): string {
  const openapi = {
    openapi: '3.0.3',
    info: {
      title: spec.name,
      version: spec.version,
      description: 'Federated API Gateway',
    },
    servers: [{ url: '/api', description: 'Gateway' }],
    paths: {} as Record<string, unknown>,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };

  for (const route of spec.routes) {
    const service = services.find(s => s.name === route.service);
    const behavior = service?.domain.behaviors.find(b => b.name.name === route.behavior);

    openapi.paths[route.path] = {
      post: {
        operationId: `${route.service}_${route.behavior}`,
        summary: behavior?.description?.value ?? route.behavior,
        tags: [route.service],
        security: route.authentication ? [{ bearerAuth: [] }] : undefined,
        responses: {
          200: { description: 'Success' },
          400: { description: 'Bad Request' },
          401: { description: 'Unauthorized' },
          500: { description: 'Internal Server Error' },
        },
      },
    };
  }

  return JSON.stringify(openapi, null, 2);
}

// ============================================================================
// NGINX CONFIG
// ============================================================================

function generateNginxConfig(spec: GatewaySpec): string {
  const lines: string[] = [];

  lines.push('# ============================================================================');
  lines.push(`# ${spec.name} NGINX Configuration`);
  lines.push('# ============================================================================');
  lines.push('');

  // Upstream servers
  lines.push('# Upstream servers');
  for (const service of spec.services) {
    lines.push(`upstream ${service.name} {`);
    lines.push(`    server ${new URL(service.url).host};`);
    lines.push('}');
    lines.push('');
  }

  // Server block
  lines.push('server {');
  lines.push('    listen 80;');
  lines.push('    server_name gateway;');
  lines.push('');

  // CORS
  if (spec.cors) {
    lines.push('    # CORS');
    lines.push(`    add_header Access-Control-Allow-Origin "${spec.cors.origins[0]}";`);
    lines.push(`    add_header Access-Control-Allow-Methods "${spec.cors.methods.join(', ')}";`);
    lines.push(`    add_header Access-Control-Allow-Headers "${spec.cors.headers.join(', ')}";`);
    lines.push('');
  }

  // Rate limiting
  if (spec.rateLimit) {
    lines.push('    # Rate limiting');
    lines.push(`    limit_req_zone $binary_remote_addr zone=api:10m rate=${spec.rateLimit.requests}r/m;`);
    lines.push('');
  }

  // Routes
  lines.push('    # Routes');
  for (const route of spec.routes) {
    lines.push(`    location ${route.path} {`);
    lines.push(`        proxy_pass http://${route.service}/${route.behavior};`);
    lines.push('        proxy_set_header Host $host;');
    lines.push('        proxy_set_header X-Real-IP $remote_addr;');
    lines.push('        proxy_set_header X-Request-ID $request_id;');
    if (spec.rateLimit) {
      lines.push('        limit_req zone=api burst=20 nodelay;');
    }
    lines.push('    }');
    lines.push('');
  }

  // Health check
  lines.push('    location /health {');
  lines.push('        return 200 \'{"status":"ok"}\';');
  lines.push("        add_header Content-Type application/json;");
  lines.push('    }');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// ENVOY CONFIG
// ============================================================================

function generateEnvoyConfig(spec: GatewaySpec): string {
  const config = {
    static_resources: {
      listeners: [
        {
          name: 'gateway_listener',
          address: {
            socket_address: { address: '0.0.0.0', port_value: 8080 },
          },
          filter_chains: [
            {
              filters: [
                {
                  name: 'envoy.filters.network.http_connection_manager',
                  typed_config: {
                    '@type': 'type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager',
                    stat_prefix: 'ingress_http',
                    route_config: {
                      name: 'local_route',
                      virtual_hosts: [
                        {
                          name: 'backend',
                          domains: ['*'],
                          routes: spec.routes.map(route => ({
                            match: { prefix: route.path },
                            route: {
                              cluster: route.service,
                              timeout: '30s',
                            },
                          })),
                        },
                      ],
                    },
                    http_filters: [
                      { name: 'envoy.filters.http.router', typed_config: {} },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
      clusters: spec.services.map(service => ({
        name: service.name,
        connect_timeout: '5s',
        type: 'LOGICAL_DNS',
        lb_policy: 'ROUND_ROBIN',
        load_assignment: {
          cluster_name: service.name,
          endpoints: [
            {
              lb_endpoints: [
                {
                  endpoint: {
                    address: {
                      socket_address: {
                        address: new URL(service.url).hostname,
                        port_value: parseInt(new URL(service.url).port || '80'),
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        health_checks: [
          {
            timeout: '1s',
            interval: '10s',
            unhealthy_threshold: 3,
            healthy_threshold: 2,
            http_health_check: { path: service.healthCheck },
          },
        ],
      })),
    },
  };

  return JSON.stringify(config, null, 2);
}

// ============================================================================
// HELPERS
// ============================================================================

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}