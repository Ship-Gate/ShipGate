// ============================================================================
// Federation Registry
// Central registry for federated ISL services
// ============================================================================

import type * as AST from './ast';
import type {
  FederatedService,
  ServiceRegistration,
  SchemaVersion,
  ServiceStatus,
  CrossServiceReference,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface RegistryOptions {
  storage?: RegistryStorage;
  validateOnRegister?: boolean;
  trackDependencies?: boolean;
  healthCheckInterval?: number;
}

export interface RegistryStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// ============================================================================
// FEDERATION REGISTRY
// ============================================================================

export class FederationRegistry {
  private services: Map<string, ServiceRegistration> = new Map();
  private references: CrossServiceReference[] = [];
  private storage?: RegistryStorage;
  private options: Omit<Required<RegistryOptions>, 'storage'> & { storage?: RegistryStorage };

  constructor(options: RegistryOptions = {}) {
    this.options = {
      storage: options.storage,
      validateOnRegister: options.validateOnRegister ?? true,
      trackDependencies: options.trackDependencies ?? true,
      healthCheckInterval: options.healthCheckInterval ?? 30000,
    };
    this.storage = options.storage;
  }

  // ============================================================================
  // SERVICE REGISTRATION
  // ============================================================================

  /**
   * Register a new service with its ISL domain
   */
  async register(service: FederatedService): Promise<ServiceRegistration> {
    const schemaHash = this.computeSchemaHash(service.domain);
    
    const schemaVersion: SchemaVersion = {
      version: service.version,
      domain: service.domain,
      timestamp: new Date(),
      hash: schemaHash,
    };

    const existing = this.services.get(service.name);
    
    const registration: ServiceRegistration = {
      service,
      versions: existing ? [...existing.versions, schemaVersion] : [schemaVersion],
      currentVersion: service.version,
      status: 'unknown',
    };

    // Validate if enabled
    if (this.options.validateOnRegister) {
      const validation = this.validateRegistration(registration);
      if (!validation.valid) {
        throw new Error(`Registration validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Track dependencies
    if (this.options.trackDependencies) {
      this.extractReferences(service);
    }

    this.services.set(service.name, registration);

    // Persist if storage is available
    if (this.storage) {
      await this.persistRegistration(registration);
    }

    return registration;
  }

  /**
   * Unregister a service
   */
  async unregister(serviceName: string): Promise<void> {
    // Check for dependents
    const dependents = this.getDependents(serviceName);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister ${serviceName}: depended on by ${dependents.join(', ')}`
      );
    }

    this.services.delete(serviceName);
    this.references = this.references.filter(
      r => r.sourceService !== serviceName && r.targetService !== serviceName
    );

    if (this.storage) {
      await this.storage.delete(`service:${serviceName}`);
    }
  }

  /**
   * Update a service's schema
   */
  async updateSchema(
    serviceName: string,
    newDomain: AST.Domain,
    changelog?: string
  ): Promise<ServiceRegistration> {
    const registration = this.services.get(serviceName);
    if (!registration) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const newVersion: SchemaVersion = {
      version: newDomain.version.value,
      domain: newDomain,
      timestamp: new Date(),
      hash: this.computeSchemaHash(newDomain),
      changelog,
    };

    registration.versions.push(newVersion);
    registration.currentVersion = newVersion.version;
    registration.service.domain = newDomain;
    registration.service.version = newVersion.version;

    if (this.options.trackDependencies) {
      this.extractReferences(registration.service);
    }

    if (this.storage) {
      await this.persistRegistration(registration);
    }

    return registration;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get a registered service
   */
  getService(name: string): ServiceRegistration | undefined {
    return this.services.get(name);
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceRegistration[] {
    return Array.from(this.services.values());
  }

  /**
   * Get service by type name
   */
  findServiceByType(typeName: string): ServiceRegistration | undefined {
    for (const registration of this.services.values()) {
      const domain = registration.service.domain;
      if (domain.entities.some(e => e.name.name === typeName)) {
        return registration;
      }
      if (domain.types.some(t => t.name.name === typeName)) {
        return registration;
      }
    }
    return undefined;
  }

  /**
   * Get service by behavior name
   */
  findServiceByBehavior(behaviorName: string): ServiceRegistration | undefined {
    for (const registration of this.services.values()) {
      if (registration.service.domain.behaviors.some(b => b.name.name === behaviorName)) {
        return registration;
      }
    }
    return undefined;
  }

  /**
   * Get all versions of a service
   */
  getVersionHistory(serviceName: string): SchemaVersion[] {
    const registration = this.services.get(serviceName);
    return registration?.versions ?? [];
  }

  /**
   * Get a specific version of a service schema
   */
  getSchemaVersion(serviceName: string, version: string): AST.Domain | undefined {
    const registration = this.services.get(serviceName);
    const schemaVersion = registration?.versions.find(v => v.version === version);
    return schemaVersion?.domain;
  }

  // ============================================================================
  // DEPENDENCY MANAGEMENT
  // ============================================================================

  /**
   * Get dependencies of a service
   */
  getDependencies(serviceName: string): string[] {
    return this.references
      .filter(r => r.sourceService === serviceName)
      .map(r => r.targetService)
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  /**
   * Get services that depend on a service
   */
  getDependents(serviceName: string): string[] {
    return this.references
      .filter(r => r.targetService === serviceName)
      .map(r => r.sourceService)
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  /**
   * Get all cross-service references
   */
  getReferences(): CrossServiceReference[] {
    return [...this.references];
  }

  /**
   * Check for circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (service: string) => {
      if (path.includes(service)) {
        const cycleStart = path.indexOf(service);
        cycles.push([...path.slice(cycleStart), service]);
        return;
      }

      if (visited.has(service)) return;
      visited.add(service);
      path.push(service);

      for (const dep of this.getDependencies(service)) {
        dfs(dep);
      }

      path.pop();
    };

    for (const serviceName of this.services.keys()) {
      dfs(serviceName);
    }

    return cycles;
  }

  // ============================================================================
  // HEALTH CHECKS
  // ============================================================================

  /**
   * Update service health status
   */
  updateHealth(serviceName: string, status: ServiceStatus): void {
    const registration = this.services.get(serviceName);
    if (registration) {
      registration.status = status;
      registration.lastHealthCheck = new Date();
    }
  }

  /**
   * Get unhealthy services
   */
  getUnhealthyServices(): ServiceRegistration[] {
    return Array.from(this.services.values()).filter(
      r => r.status === 'unhealthy' || r.status === 'degraded'
    );
  }

  // ============================================================================
  // DEPRECATION
  // ============================================================================

  /**
   * Deprecate a schema version
   */
  deprecateVersion(serviceName: string, version: string, reason: string): void {
    const registration = this.services.get(serviceName);
    if (!registration) return;

    const schemaVersion = registration.versions.find(v => v.version === version);
    if (schemaVersion) {
      schemaVersion.deprecated = true;
      schemaVersion.deprecationReason = reason;
    }
  }

  /**
   * Get deprecated versions still in use
   */
  getDeprecatedInUse(): Array<{ service: string; version: string; dependents: string[] }> {
    const result: Array<{ service: string; version: string; dependents: string[] }> = [];

    for (const [name, registration] of this.services) {
      for (const version of registration.versions) {
        if (version.deprecated && version.version === registration.currentVersion) {
          result.push({
            service: name,
            version: version.version,
            dependents: this.getDependents(name),
          });
        }
      }
    }

    return result;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private computeSchemaHash(domain: AST.Domain): string {
    const content = JSON.stringify(domain);
    // Simple hash function (djb2 algorithm)
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).slice(0, 16).padStart(16, '0');
  }

  private validateRegistration(registration: ServiceRegistration): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for missing dependencies
    for (const dep of registration.service.metadata.dependencies) {
      if (!this.services.has(dep)) {
        errors.push(`Missing dependency: ${dep}`);
      }
    }

    // Check for type conflicts
    for (const entity of registration.service.domain.entities) {
      const existing = this.findServiceByType(entity.name.name);
      if (existing && existing.service.name !== registration.service.name) {
        errors.push(`Entity name conflict: ${entity.name.name} already defined in ${existing.service.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private extractReferences(service: FederatedService): void {
    // Remove old references from this service
    this.references = this.references.filter(r => r.sourceService !== service.name);

    const domain = service.domain;

    // Extract references from imports
    for (const imp of domain.imports) {
      const targetService = this.extractServiceFromImport(imp.from.value);
      if (targetService) {
        for (const item of imp.items) {
          this.references.push({
            sourceService: service.name,
            sourcePath: `imports.${item.name.name}`,
            targetService,
            targetType: item.name.name,
            referenceKind: 'type-import',
          });
        }
      }
    }

    // Extract references from entity fields
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        this.extractTypeReferences(service.name, `entities.${entity.name.name}.${field.name.name}`, field.type);
      }
    }
  }

  private extractTypeReferences(serviceName: string, path: string, type: AST.TypeDefinition): void {
    if (type.kind === 'ReferenceType') {
      const refName = type.name.parts.map(p => p.name).join('.');
      const targetService = this.findServiceByType(refName);
      if (targetService && targetService.service.name !== serviceName) {
        this.references.push({
          sourceService: serviceName,
          sourcePath: path,
          targetService: targetService.service.name,
          targetType: refName,
          referenceKind: 'entity-reference',
        });
      }
    } else if (type.kind === 'ListType') {
      this.extractTypeReferences(serviceName, path, type.element);
    } else if (type.kind === 'MapType') {
      this.extractTypeReferences(serviceName, path, type.value);
    } else if (type.kind === 'OptionalType') {
      this.extractTypeReferences(serviceName, path, type.inner);
    }
  }

  private extractServiceFromImport(importPath: string): string | null {
    // Handle patterns like "@services/auth" or "./auth.isl"
    const match = importPath.match(/@services\/([^/]+)/);
    if (match && match[1]) return match[1];
    
    const fileMatch = importPath.match(/\.\/([^/.]+)\.isl/);
    if (fileMatch && fileMatch[1]) return fileMatch[1];
    
    return null;
  }

  private async persistRegistration(registration: ServiceRegistration): Promise<void> {
    if (!this.storage) return;
    
    const key = `service:${registration.service.name}`;
    const value = JSON.stringify({
      service: {
        name: registration.service.name,
        version: registration.service.version,
        url: registration.service.url,
        metadata: registration.service.metadata,
      },
      versions: registration.versions.map(v => ({
        version: v.version,
        timestamp: v.timestamp.toISOString(),
        hash: v.hash,
        deprecated: v.deprecated,
        deprecationReason: v.deprecationReason,
      })),
      currentVersion: registration.currentVersion,
      status: registration.status,
    });
    
    await this.storage.set(key, value);
  }
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

export class InMemoryRegistryStorage implements RegistryStorage {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.data.keys()).filter(k => k.startsWith(prefix));
  }
}
