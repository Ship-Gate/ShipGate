/**
 * Service Discovery
 * Service registration and discovery for ISL services
 */

import { ServiceRegistration, ServiceQuery, HealthCheck } from './types';

/**
 * Service registry interface
 */
export interface ServiceRegistry {
  register(service: ServiceRegistration): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  discover(query: ServiceQuery): Promise<ServiceRegistration[]>;
  get(serviceId: string): Promise<ServiceRegistration | undefined>;
  watch(query: ServiceQuery, callback: (services: ServiceRegistration[]) => void): () => void;
}

/**
 * In-memory service registry
 */
export class InMemoryServiceRegistry implements ServiceRegistry {
  private services: Map<string, ServiceRegistration> = new Map();
  private watchers: Map<string, Set<(services: ServiceRegistration[]) => void>> = new Map();
  private healthCheckTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  async register(service: ServiceRegistration): Promise<void> {
    this.services.set(service.id, {
      ...service,
      registeredAt: Date.now(),
    });

    // Start health checks
    if (service.healthCheck) {
      this.startHealthCheck(service);
    }

    this.notifyWatchers();
  }

  async deregister(serviceId: string): Promise<void> {
    this.services.delete(serviceId);

    // Stop health checks
    const timer = this.healthCheckTimers.get(serviceId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(serviceId);
    }

    this.notifyWatchers();
  }

  async discover(query: ServiceQuery): Promise<ServiceRegistration[]> {
    let results = Array.from(this.services.values());

    if (query.name) {
      results = results.filter((s) => s.name === query.name);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((s) =>
        query.tags!.every((tag) => s.tags.includes(tag))
      );
    }

    if (query.version) {
      results = results.filter((s) => s.version === query.version);
    }

    if (query.healthy !== undefined) {
      results = results.filter((s) => {
        if (!s.healthCheck) return true;
        const healthyThreshold = Date.now() - s.healthCheck.interval * 3;
        return query.healthy
          ? (s.lastHealthCheck ?? 0) > healthyThreshold
          : (s.lastHealthCheck ?? 0) <= healthyThreshold;
      });
    }

    return results;
  }

  async get(serviceId: string): Promise<ServiceRegistration | undefined> {
    return this.services.get(serviceId);
  }

  watch(
    query: ServiceQuery,
    callback: (services: ServiceRegistration[]) => void
  ): () => void {
    const key = JSON.stringify(query);
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key)!.add(callback);

    // Initial callback
    this.discover(query).then(callback);

    return () => {
      this.watchers.get(key)?.delete(callback);
    };
  }

  private startHealthCheck(service: ServiceRegistration): void {
    const check = service.healthCheck!;
    const timer = setInterval(async () => {
      const healthy = await this.performHealthCheck(service, check);
      if (healthy) {
        const current = this.services.get(service.id);
        if (current) {
          current.lastHealthCheck = Date.now();
        }
      } else if (check.deregisterAfter) {
        const current = this.services.get(service.id);
        if (current) {
          const lastCheck = current.lastHealthCheck ?? current.registeredAt;
          if (Date.now() - lastCheck > check.deregisterAfter) {
            await this.deregister(service.id);
          }
        }
      }
    }, check.interval);

    this.healthCheckTimers.set(service.id, timer);
  }

  private async performHealthCheck(
    _service: ServiceRegistration,
    _check: HealthCheck
  ): Promise<boolean> {
    // In production, actually perform the health check
    // This is a simplified version
    return true;
  }

  private async notifyWatchers(): Promise<void> {
    for (const [queryKey, callbacks] of this.watchers) {
      const query = JSON.parse(queryKey) as ServiceQuery;
      const services = await this.discover(query);
      for (const callback of callbacks) {
        callback(services);
      }
    }
  }
}

/**
 * Load balancer strategies
 */
export type LoadBalancerStrategy = 'round-robin' | 'random' | 'least-connections' | 'weighted';

/**
 * Client-side load balancer
 */
export class LoadBalancer {
  private services: ServiceRegistration[] = [];
  private currentIndex = 0;
  private connectionCounts: Map<string, number> = new Map();
  private unsubscribe?: () => void;

  constructor(
    private registry: ServiceRegistry,
    private query: ServiceQuery,
    private strategy: LoadBalancerStrategy = 'round-robin'
  ) {
    this.startWatching();
  }

  /**
   * Get next service to call
   */
  getNext(): ServiceRegistration | undefined {
    if (this.services.length === 0) return undefined;

    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin();
      case 'random':
        return this.random();
      case 'least-connections':
        return this.leastConnections();
      case 'weighted':
        return this.weighted();
      default:
        return this.roundRobin();
    }
  }

  /**
   * Report connection started
   */
  startConnection(serviceId: string): void {
    const count = this.connectionCounts.get(serviceId) ?? 0;
    this.connectionCounts.set(serviceId, count + 1);
  }

  /**
   * Report connection ended
   */
  endConnection(serviceId: string): void {
    const count = this.connectionCounts.get(serviceId) ?? 0;
    this.connectionCounts.set(serviceId, Math.max(0, count - 1));
  }

  /**
   * Stop watching for changes
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private startWatching(): void {
    this.unsubscribe = this.registry.watch(this.query, (services) => {
      this.services = services;
    });
  }

  private roundRobin(): ServiceRegistration {
    const service = this.services[this.currentIndex % this.services.length]!;
    this.currentIndex++;
    return service;
  }

  private random(): ServiceRegistration {
    const index = Math.floor(Math.random() * this.services.length);
    return this.services[index]!;
  }

  private leastConnections(): ServiceRegistration {
    let minConnections = Infinity;
    let selected = this.services[0]!;

    for (const service of this.services) {
      const connections = this.connectionCounts.get(service.id) ?? 0;
      if (connections < minConnections) {
        minConnections = connections;
        selected = service;
      }
    }

    return selected;
  }

  private weighted(): ServiceRegistration {
    // Use metadata.weight if available, default to 1
    const weights = this.services.map(
      (s) => (s.metadata.weight as number) ?? 1
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < this.services.length; i++) {
      random -= weights[i]!;
      if (random <= 0) {
        return this.services[i]!;
      }
    }

    return this.services[0]!;
  }
}

/**
 * Create service registry
 */
export function createServiceRegistry(): ServiceRegistry {
  return new InMemoryServiceRegistry();
}

/**
 * Create load balancer
 */
export function createLoadBalancer(
  registry: ServiceRegistry,
  query: ServiceQuery,
  strategy?: LoadBalancerStrategy
): LoadBalancer {
  return new LoadBalancer(registry, query, strategy);
}
