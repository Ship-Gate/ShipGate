// ============================================================================
// Federation Types
// ============================================================================

import type * as AST from './ast';

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface FederatedService {
  name: string;
  version: string;
  url: string;
  domain: AST.Domain;
  healthCheck?: string;
  metadata: ServiceMetadata;
}

export interface ServiceMetadata {
  owner: string;
  team?: string;
  description?: string;
  tags: string[];
  sla?: ServiceSLA;
  dependencies: string[];
  consumers: string[];
}

export interface ServiceSLA {
  availability: number;  // e.g., 99.9
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorBudget: number;
}

// ============================================================================
// REGISTRY TYPES
// ============================================================================

export interface SchemaVersion {
  version: string;
  domain: AST.Domain;
  timestamp: Date;
  hash: string;
  changelog?: string;
  deprecated?: boolean;
  deprecationReason?: string;
}

export interface ServiceRegistration {
  service: FederatedService;
  versions: SchemaVersion[];
  currentVersion: string;
  status: ServiceStatus;
  lastHealthCheck?: Date;
}

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// ============================================================================
// REFERENCE TYPES
// ============================================================================

export interface CrossServiceReference {
  sourceService: string;
  sourcePath: string;
  targetService: string;
  targetType: string;
  referenceKind: ReferenceKind;
}

export type ReferenceKind =
  | 'entity-reference'      // References an entity from another service
  | 'behavior-call'         // Calls a behavior from another service
  | 'type-import'           // Imports a type definition
  | 'event-subscription';   // Subscribes to events from another service

export interface ResolvedReference {
  reference: CrossServiceReference;
  resolved: boolean;
  targetSchema?: AST.Domain;
  error?: string;
}

// ============================================================================
// COMPOSITION TYPES
// ============================================================================

export interface CompositionResult {
  success: boolean;
  schema?: ComposedSchema;
  conflicts: SchemaConflict[];
  warnings: string[];
}

export interface ComposedSchema {
  name: string;
  version: string;
  services: string[];
  types: AST.TypeDeclaration[];
  entities: AST.Entity[];
  behaviors: AST.Behavior[];
  crossServiceBehaviors: FederatedBehavior[];
}

export interface FederatedBehavior {
  name: string;
  service: string;
  behavior: AST.Behavior;
  routing: RoutingRule;
}

export interface RoutingRule {
  service: string;
  path: string;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  timeout: number;
  retries: number;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  threshold: number;      // Error threshold percentage
  timeout: number;        // Time in ms before attempting reset
  halfOpenRequests: number;
}

// ============================================================================
// CONFLICT TYPES
// ============================================================================

export interface SchemaConflict {
  type: ConflictType;
  severity: 'error' | 'warning';
  services: string[];
  path: string;
  description: string;
  suggestion?: string;
}

export type ConflictType =
  | 'type-mismatch'           // Same type name, different definitions
  | 'entity-collision'        // Same entity name across services
  | 'behavior-collision'      // Same behavior name
  | 'incompatible-version'    // Version compatibility issue
  | 'circular-dependency'     // Circular service dependencies
  | 'missing-dependency'      // Required service not registered
  | 'breaking-change';        // Breaking change in dependency

// ============================================================================
// GATEWAY TYPES
// ============================================================================

export interface GatewaySpec {
  name: string;
  version: string;
  services: GatewayService[];
  routes: GatewayRoute[];
  middleware: MiddlewareConfig[];
  rateLimit?: RateLimitConfig;
  cors?: CorsConfig;
}

export interface GatewayService {
  name: string;
  url: string;
  healthCheck: string;
  timeout: number;
}

export interface GatewayRoute {
  path: string;
  service: string;
  behavior: string;
  method: string;
  authentication?: AuthConfig;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
}

export interface MiddlewareConfig {
  name: string;
  order: number;
  config: Record<string, unknown>;
}

export interface RateLimitConfig {
  requests: number;
  window: number;  // seconds
  by: 'ip' | 'user' | 'api_key';
}

export interface CorsConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge: number;
}

export interface AuthConfig {
  type: 'jwt' | 'api_key' | 'oauth2';
  required: boolean;
  scopes?: string[];
}

export interface CacheConfig {
  ttl: number;
  varyBy: string[];
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface FederatedEvent {
  name: string;
  service: string;
  schema: AST.TypeDefinition;
  topic: string;
  subscribers: EventSubscriber[];
}

export interface EventSubscriber {
  service: string;
  handler: string;
  filter?: string;
}

export interface EventContract {
  publisher: string;
  event: string;
  consumers: string[];
  schema: AST.TypeDefinition;
  compatibility: 'forward' | 'backward' | 'full' | 'none';
}
