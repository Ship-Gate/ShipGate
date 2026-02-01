// ============================================================================
// ISL Standard Library - Service Mesh
// @intentos/stdlib-distributed/service-mesh
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceInstance {
  id: string;
  serviceName: string;
  version: string;
  endpoint: Endpoint;
  health: HealthStatus;
  metadata: Record<string, string>;
  registeredAt: Date;
  lastHeartbeat: Date;
}

export interface Endpoint {
  protocol: 'http' | 'https' | 'grpc' | 'tcp';
  host: string;
  port: number;
  path?: string;
}

export type HealthStatus = 'healthy' | 'unhealthy' | 'draining' | 'unknown';

export type LoadBalancingStrategy =
  | 'round-robin'
  | 'random'
  | 'least-connections'
  | 'weighted-round-robin'
  | 'consistent-hash'
  | 'locality-aware';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenRequests: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface TimeoutConfig {
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
}

// ============================================================================
// SERVICE REGISTRY
// ============================================================================

export class ServiceRegistry {
  private services = new Map<string, Map<string, ServiceInstance>>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Register a service instance.
   */
  register(instance: Omit<ServiceInstance, 'registeredAt' | 'lastHeartbeat'>): ServiceInstance {
    const full: ServiceInstance = {
      ...instance,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
    };

    if (!this.services.has(instance.serviceName)) {
      this.services.set(instance.serviceName, new Map());
    }

    this.services.get(instance.serviceName)!.set(instance.id, full);
    return full;
  }

  /**
   * Deregister a service instance.
   */
  deregister(serviceName: string, instanceId: string): boolean {
    const instances = this.services.get(serviceName);
    if (!instances) return false;
    return instances.delete(instanceId);
  }

  /**
   * Update heartbeat for an instance.
   */
  heartbeat(serviceName: string, instanceId: string): boolean {
    const instance = this.services.get(serviceName)?.get(instanceId);
    if (!instance) return false;
    instance.lastHeartbeat = new Date();
    return true;
  }

  /**
   * Update health status for an instance.
   */
  updateHealth(serviceName: string, instanceId: string, health: HealthStatus): boolean {
    const instance = this.services.get(serviceName)?.get(instanceId);
    if (!instance) return false;
    instance.health = health;
    return true;
  }

  /**
   * Get all healthy instances of a service.
   */
  getHealthyInstances(serviceName: string): ServiceInstance[] {
    const instances = this.services.get(serviceName);
    if (!instances) return [];

    const staleThresholdMs = 30000; // 30 seconds
    const now = Date.now();

    return Array.from(instances.values()).filter(i => {
      // Check health status
      if (i.health !== 'healthy') return false;
      // Check heartbeat freshness
      if (now - i.lastHeartbeat.getTime() > staleThresholdMs) return false;
      return true;
    });
  }

  /**
   * Get all instances of a service (regardless of health).
   */
  getAllInstances(serviceName: string): ServiceInstance[] {
    const instances = this.services.get(serviceName);
    if (!instances) return [];
    return Array.from(instances.values());
  }

  /**
   * Get all registered service names.
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}

// ============================================================================
// LOAD BALANCER
// ============================================================================

export class LoadBalancer {
  private strategy: LoadBalancingStrategy;
  private roundRobinCounters = new Map<string, number>();
  private connectionCounts = new Map<string, number>();

  constructor(strategy: LoadBalancingStrategy = 'round-robin') {
    this.strategy = strategy;
  }

  /**
   * Select an instance from the given list.
   */
  select(
    serviceName: string,
    instances: ServiceInstance[],
    hashKey?: string
  ): ServiceInstance | null {
    if (instances.length === 0) return null;
    if (instances.length === 1) return instances[0];

    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(serviceName, instances);
      case 'random':
        return this.random(instances);
      case 'least-connections':
        return this.leastConnections(instances);
      case 'consistent-hash':
        return this.consistentHash(instances, hashKey ?? '');
      default:
        return instances[0];
    }
  }

  /**
   * Record a connection to an instance.
   */
  recordConnection(instanceId: string): void {
    const count = this.connectionCounts.get(instanceId) ?? 0;
    this.connectionCounts.set(instanceId, count + 1);
  }

  /**
   * Record a connection release from an instance.
   */
  releaseConnection(instanceId: string): void {
    const count = this.connectionCounts.get(instanceId) ?? 0;
    this.connectionCounts.set(instanceId, Math.max(0, count - 1));
  }

  private roundRobin(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const counter = this.roundRobinCounters.get(serviceName) ?? 0;
    const index = counter % instances.length;
    this.roundRobinCounters.set(serviceName, counter + 1);
    return instances[index];
  }

  private random(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    let minConnections = Infinity;
    let selected = instances[0];

    for (const instance of instances) {
      const connections = this.connectionCounts.get(instance.id) ?? 0;
      if (connections < minConnections) {
        minConnections = connections;
        selected = instance;
      }
    }

    return selected;
  }

  private consistentHash(instances: ServiceInstance[], key: string): ServiceInstance {
    // Simple consistent hashing
    const hash = this.hashCode(key);
    const index = Math.abs(hash) % instances.length;
    return instances[index];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
      halfOpenRequests: config.halfOpenRequests ?? 3,
    };
  }

  /**
   * Check if request should be allowed.
   */
  allowRequest(): boolean {
    this.maybeTransitionFromOpen();

    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        return false;
      case 'half-open':
        return this.halfOpenAttempts < this.config.halfOpenRequests;
    }
  }

  /**
   * Record a successful request.
   */
  recordSuccess(): void {
    switch (this.state) {
      case 'closed':
        this.failureCount = 0;
        break;
      case 'half-open':
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionToClosed();
        }
        break;
    }
  }

  /**
   * Record a failed request.
   */
  recordFailure(): void {
    this.lastFailureTime = new Date();

    switch (this.state) {
      case 'closed':
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionToOpen();
        }
        break;
      case 'half-open':
        this.transitionToOpen();
        break;
    }
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get time until circuit might close (if open).
   */
  getTimeUntilRetry(): number | null {
    if (this.state !== 'open' || !this.lastFailureTime) return null;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.config.timeoutMs - elapsed);
  }

  private maybeTransitionFromOpen(): void {
    if (this.state !== 'open' || !this.lastFailureTime) return;

    const elapsed = Date.now() - this.lastFailureTime.getTime();
    if (elapsed >= this.config.timeoutMs) {
      this.transitionToHalfOpen();
    }
  }

  private transitionToClosed(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  private transitionToOpen(): void {
    this.state = 'open';
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  private transitionToHalfOpen(): void {
    this.state = 'half-open';
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }
}

// ============================================================================
// SERVICE CLIENT
// ============================================================================

export class ServiceClient {
  private registry: ServiceRegistry;
  private loadBalancer: LoadBalancer;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private retryConfig: RetryConfig;
  private timeoutConfig: TimeoutConfig;

  constructor(options: {
    registry: ServiceRegistry;
    loadBalancer?: LoadBalancer;
    retryConfig?: Partial<RetryConfig>;
    timeoutConfig?: Partial<TimeoutConfig>;
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  }) {
    this.registry = options.registry;
    this.loadBalancer = options.loadBalancer ?? new LoadBalancer();
    this.retryConfig = {
      maxAttempts: options.retryConfig?.maxAttempts ?? 3,
      initialDelayMs: options.retryConfig?.initialDelayMs ?? 100,
      maxDelayMs: options.retryConfig?.maxDelayMs ?? 5000,
      backoffMultiplier: options.retryConfig?.backoffMultiplier ?? 2,
      retryableErrors: options.retryConfig?.retryableErrors ?? ['ECONNREFUSED', 'ETIMEDOUT'],
    };
    this.timeoutConfig = {
      connectionTimeoutMs: options.timeoutConfig?.connectionTimeoutMs ?? 5000,
      requestTimeoutMs: options.timeoutConfig?.requestTimeoutMs ?? 30000,
    };
  }

  /**
   * Call a service.
   */
  async call<Req, Resp>(
    serviceName: string,
    method: string,
    request: Req,
    options: {
      timeout?: number;
      retries?: number;
      hashKey?: string;
    } = {}
  ): Promise<ServiceCallResult<Resp>> {
    const circuitBreaker = this.getCircuitBreaker(serviceName);

    if (!circuitBreaker.allowRequest()) {
      return {
        success: false,
        error: 'circuit_open',
        retryAfterMs: circuitBreaker.getTimeUntilRetry() ?? this.retryConfig.initialDelayMs,
      };
    }

    const instances = this.registry.getHealthyInstances(serviceName);
    if (instances.length === 0) {
      return {
        success: false,
        error: 'no_healthy_instances',
      };
    }

    const instance = this.loadBalancer.select(serviceName, instances, options.hashKey);
    if (!instance) {
      return {
        success: false,
        error: 'no_instance_selected',
      };
    }

    const maxAttempts = options.retries ?? this.retryConfig.maxAttempts;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.loadBalancer.recordConnection(instance.id);
        
        // In a real implementation, this would make an HTTP/gRPC call
        const response = await this.makeRequest<Req, Resp>(
          instance,
          method,
          request,
          options.timeout ?? this.timeoutConfig.requestTimeoutMs
        );

        circuitBreaker.recordSuccess();
        this.loadBalancer.releaseConnection(instance.id);

        return {
          success: true,
          data: response,
          instance: instance.id,
        };
      } catch (error) {
        this.loadBalancer.releaseConnection(instance.id);
        
        const err = error as Error;
        const isRetryable = this.retryConfig.retryableErrors.some(e => 
          err.message.includes(e)
        );

        if (!isRetryable || attempt === maxAttempts - 1) {
          circuitBreaker.recordFailure();
          return {
            success: false,
            error: 'service_error',
            message: err.message,
          };
        }

        // Wait before retry
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelayMs
        );
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: 'max_retries_exceeded',
    };
  }

  private getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker());
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  private async makeRequest<Req, Resp>(
    instance: ServiceInstance,
    method: string,
    request: Req,
    timeoutMs: number
  ): Promise<Resp> {
    // Stub implementation - in reality, this would use fetch/http/grpc
    const url = `${instance.endpoint.protocol}://${instance.endpoint.host}:${instance.endpoint.port}${instance.endpoint.path ?? ''}/${method}`;
    
    // Simulated response for demonstration
    return {} as Resp;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export type ServiceCallResult<T> =
  | { success: true; data: T; instance: string }
  | { success: false; error: string; message?: string; retryAfterMs?: number };

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createServiceRegistry(): ServiceRegistry {
  return new ServiceRegistry();
}

export function createLoadBalancer(strategy?: LoadBalancingStrategy): LoadBalancer {
  return new LoadBalancer(strategy);
}

export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}

export function createServiceClient(options: {
  registry: ServiceRegistry;
  loadBalancer?: LoadBalancer;
  retryConfig?: Partial<RetryConfig>;
  timeoutConfig?: Partial<TimeoutConfig>;
}): ServiceClient {
  return new ServiceClient(options);
}
