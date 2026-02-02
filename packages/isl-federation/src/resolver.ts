// ============================================================================
// Reference Resolver
// Resolves cross-service references in federated ISL
// ============================================================================

import type * as AST from './ast';
import type {
  CrossServiceReference,
  ResolvedReference,
} from './types';
import { FederationRegistry } from './registry';

// ============================================================================
// TYPES
// ============================================================================

export interface ReferenceResolver {
  resolve(ref: CrossServiceReference): Promise<ResolvedReference>;
  resolveAll(refs: CrossServiceReference[]): Promise<ResolvedReference[]>;
  resolveType(serviceName: string, typeName: string): Promise<AST.TypeDefinition | null>;
  resolveBehavior(serviceName: string, behaviorName: string): Promise<AST.Behavior | null>;
}

export interface ResolverOptions {
  cache?: boolean;
  timeout?: number;
  retries?: number;
}

// ============================================================================
// REFERENCE RESOLVER
// ============================================================================

/**
 * Create a reference resolver for a federation registry
 */
export function createResolver(
  registry: FederationRegistry,
  options: ResolverOptions = {}
): ReferenceResolver {
  const cache = options.cache !== false ? new Map<string, ResolvedReference>() : null;

  return {
    async resolve(ref: CrossServiceReference): Promise<ResolvedReference> {
      const cacheKey = `${ref.sourceService}:${ref.sourcePath}:${ref.targetService}:${ref.targetType}`;
      
      if (cache?.has(cacheKey)) {
        return cache.get(cacheKey)!;
      }

      const result = await resolveReference(ref, registry);
      
      if (cache && result.resolved) {
        cache.set(cacheKey, result);
      }

      return result;
    },

    async resolveAll(refs: CrossServiceReference[]): Promise<ResolvedReference[]> {
      return Promise.all(refs.map(ref => this.resolve(ref)));
    },

    async resolveType(serviceName: string, typeName: string): Promise<AST.TypeDefinition | null> {
      const service = registry.getService(serviceName);
      if (!service) return null;

      const domain = service.service.domain;

      // Check type declarations
      const typeDecl = domain.types.find(t => t.name.name === typeName);
      if (typeDecl) return typeDecl.definition;

      // Check entities (as types)
      const entity = domain.entities.find(e => e.name.name === typeName);
      if (entity) {
        return {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: typeName, location: entity.location }],
            location: entity.location,
          },
          location: entity.location,
        };
      }

      return null;
    },

    async resolveBehavior(serviceName: string, behaviorName: string): Promise<AST.Behavior | null> {
      const service = registry.getService(serviceName);
      if (!service) return null;

      return service.service.domain.behaviors.find(b => b.name.name === behaviorName) ?? null;
    },
  };
}

async function resolveReference(
  ref: CrossServiceReference,
  registry: FederationRegistry
): Promise<ResolvedReference> {
  const targetService = registry.getService(ref.targetService);

  if (!targetService) {
    return {
      reference: ref,
      resolved: false,
      error: `Service ${ref.targetService} not found in registry`,
    };
  }

  const domain = targetService.service.domain;

  switch (ref.referenceKind) {
    case 'entity-reference': {
      const entity = domain.entities.find(e => e.name.name === ref.targetType);
      if (!entity) {
        return {
          reference: ref,
          resolved: false,
          error: `Entity ${ref.targetType} not found in ${ref.targetService}`,
        };
      }
      return {
        reference: ref,
        resolved: true,
        targetSchema: domain,
      };
    }

    case 'type-import': {
      const type = domain.types.find(t => t.name.name === ref.targetType);
      const entity = domain.entities.find(e => e.name.name === ref.targetType);
      
      if (!type && !entity) {
        return {
          reference: ref,
          resolved: false,
          error: `Type ${ref.targetType} not found in ${ref.targetService}`,
        };
      }
      return {
        reference: ref,
        resolved: true,
        targetSchema: domain,
      };
    }

    case 'behavior-call': {
      const behavior = domain.behaviors.find(b => b.name.name === ref.targetType);
      if (!behavior) {
        return {
          reference: ref,
          resolved: false,
          error: `Behavior ${ref.targetType} not found in ${ref.targetService}`,
        };
      }
      return {
        reference: ref,
        resolved: true,
        targetSchema: domain,
      };
    }

    case 'event-subscription': {
      // Events would be defined differently - for now just check service exists
      return {
        reference: ref,
        resolved: true,
        targetSchema: domain,
      };
    }

    default:
      return {
        reference: ref,
        resolved: false,
        error: `Unknown reference kind: ${ref.referenceKind}`,
      };
  }
}

// ============================================================================
// REFERENCE UTILITIES
// ============================================================================

/**
 * Extract all references from a domain
 */
export function extractReferences(domain: AST.Domain, serviceName: string): CrossServiceReference[] {
  const references: CrossServiceReference[] = [];

  // Extract from imports
  for (const imp of domain.imports) {
    const targetService = extractServiceFromPath(imp.from.value);
    if (targetService && targetService !== serviceName) {
      for (const item of imp.items) {
        references.push({
          sourceService: serviceName,
          sourcePath: `imports.${item.name.name}`,
          targetService,
          targetType: item.name.name,
          referenceKind: 'type-import',
        });
      }
    }
  }

  // Extract from entity fields
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const fieldRefs = extractTypeReferences(
        field.type,
        serviceName,
        `entities.${entity.name.name}.${field.name.name}`
      );
      references.push(...fieldRefs);
    }
  }

  // Extract from behavior inputs/outputs
  for (const behavior of domain.behaviors) {
    for (const field of behavior.input.fields) {
      const fieldRefs = extractTypeReferences(
        field.type,
        serviceName,
        `behaviors.${behavior.name.name}.input.${field.name.name}`
      );
      references.push(...fieldRefs);
    }

    const outputRefs = extractTypeReferences(
      behavior.output.success,
      serviceName,
      `behaviors.${behavior.name.name}.output.success`
    );
    references.push(...outputRefs);
  }

  return references;
}

function extractTypeReferences(
  type: AST.TypeDefinition,
  serviceName: string,
  path: string
): CrossServiceReference[] {
  const references: CrossServiceReference[] = [];

  switch (type.kind) {
    case 'ReferenceType': {
      const parts = type.name.parts.map(p => p.name);
      if (parts.length >= 2) {
        // Qualified reference like "Auth.User"
        const firstPart = parts[0];
        if (firstPart) {
          const targetService = firstPart.toLowerCase();
          const targetType = parts.slice(1).join('.');
          references.push({
            sourceService: serviceName,
            sourcePath: path,
            targetService,
            targetType,
            referenceKind: 'entity-reference',
          });
        }
      }
      break;
    }

    case 'ListType':
      references.push(...extractTypeReferences(type.element, serviceName, path));
      break;

    case 'MapType':
      references.push(...extractTypeReferences(type.key, serviceName, path));
      references.push(...extractTypeReferences(type.value, serviceName, path));
      break;

    case 'OptionalType':
      references.push(...extractTypeReferences(type.inner, serviceName, path));
      break;
  }

  return references;
}

function extractServiceFromPath(importPath: string): string | null {
  // Handle @services/auth pattern
  const serviceMatch = importPath.match(/@services\/([^/]+)/);
  if (serviceMatch && serviceMatch[1]) return serviceMatch[1];

  // Handle ./service.isl pattern
  const fileMatch = importPath.match(/\.\/([^/.]+)\.isl$/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];

  return null;
}

// ============================================================================
// RESOLVE REFERENCES IN DOMAIN
// ============================================================================

/**
 * Resolve all references in a domain, replacing qualified names with resolved types
 */
export async function resolveReferencesInDomain(
  domain: AST.Domain,
  resolver: ReferenceResolver
): Promise<AST.Domain> {
  const resolved = { ...domain };

  // Resolve entity field types
  resolved.entities = await Promise.all(
    domain.entities.map(async entity => ({
      ...entity,
      fields: await Promise.all(
        entity.fields.map(async field => ({
          ...field,
          type: await resolveTypeDefinition(field.type, resolver),
        }))
      ),
    }))
  );

  // Resolve behavior types
  resolved.behaviors = await Promise.all(
    domain.behaviors.map(async behavior => ({
      ...behavior,
      input: {
        ...behavior.input,
        fields: await Promise.all(
          behavior.input.fields.map(async field => ({
            ...field,
            type: await resolveTypeDefinition(field.type, resolver),
          }))
        ),
      },
      output: {
        ...behavior.output,
        success: await resolveTypeDefinition(behavior.output.success, resolver),
      },
    }))
  );

  return resolved;
}

async function resolveTypeDefinition(
  type: AST.TypeDefinition,
  resolver: ReferenceResolver
): Promise<AST.TypeDefinition> {
  switch (type.kind) {
    case 'ReferenceType': {
      const parts = type.name.parts.map(p => p.name);
      if (parts.length >= 2) {
        const firstPart = parts[0];
        if (firstPart) {
          const serviceName = firstPart.toLowerCase();
          const typeName = parts.slice(1).join('.');
          const resolved = await resolver.resolveType(serviceName, typeName);
          if (resolved) return resolved;
        }
      }
      return type;
    }

    case 'ListType':
      return {
        ...type,
        element: await resolveTypeDefinition(type.element, resolver),
      };

    case 'MapType':
      return {
        ...type,
        key: await resolveTypeDefinition(type.key, resolver),
        value: await resolveTypeDefinition(type.value, resolver),
      };

    case 'OptionalType':
      return {
        ...type,
        inner: await resolveTypeDefinition(type.inner, resolver),
      };

    default:
      return type;
  }
}

/**
 * Resolve references and return with any errors
 */
export function resolveReferences(
  domain: AST.Domain,
  registry: FederationRegistry
): { domain: AST.Domain; errors: string[] } {
  const errors: string[] = [];
  const serviceName = domain.name.name.toLowerCase();
  const references = extractReferences(domain, serviceName);
  
  for (const ref of references) {
    const service = registry.getService(ref.targetService);
    if (!service) {
      errors.push(`Missing service: ${ref.targetService}`);
    }
  }

  return { domain, errors };
}
