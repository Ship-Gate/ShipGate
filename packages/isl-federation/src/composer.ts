// ============================================================================
// Schema Composer
// Composes multiple federated services into a unified schema
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import type {
  FederatedService,
  ComposedSchema,
  SchemaConflict,
  FederatedBehavior,
  RoutingRule,
  CompositionResult,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface CompositionOptions {
  resolveConflicts?: 'first' | 'last' | 'error' | 'merge';
  includeDeprecated?: boolean;
  prefixTypes?: boolean;
  generateFederatedBehaviors?: boolean;
}

// ============================================================================
// MAIN COMPOSER
// ============================================================================

/**
 * Compose multiple federated services into a unified schema
 */
export function compose(
  services: FederatedService[],
  options: CompositionOptions = {}
): CompositionResult {
  const conflicts: SchemaConflict[] = [];
  const warnings: string[] = [];
  
  const resolveConflicts = options.resolveConflicts ?? 'error';
  const prefix = options.prefixTypes ?? false;

  // Collect all types
  const typeMap = new Map<string, { type: AST.TypeDeclaration; service: string }[]>();
  const entityMap = new Map<string, { entity: AST.Entity; service: string }[]>();
  const behaviorMap = new Map<string, { behavior: AST.Behavior; service: string }[]>();

  for (const service of services) {
    const domain = service.domain;
    const serviceName = service.name;

    // Collect types
    for (const type of domain.types) {
      const typeName = prefix ? `${serviceName}_${type.name.name}` : type.name.name;
      const existing = typeMap.get(typeName) ?? [];
      existing.push({ type, service: serviceName });
      typeMap.set(typeName, existing);
    }

    // Collect entities
    for (const entity of domain.entities) {
      const entityName = prefix ? `${serviceName}_${entity.name.name}` : entity.name.name;
      const existing = entityMap.get(entityName) ?? [];
      existing.push({ entity, service: serviceName });
      entityMap.set(entityName, existing);
    }

    // Collect behaviors
    for (const behavior of domain.behaviors) {
      const behaviorName = prefix ? `${serviceName}_${behavior.name.name}` : behavior.name.name;
      const existing = behaviorMap.get(behaviorName) ?? [];
      existing.push({ behavior, service: serviceName });
      behaviorMap.set(behaviorName, existing);
    }
  }

  // Detect and resolve conflicts
  const resolvedTypes: AST.TypeDeclaration[] = [];
  const resolvedEntities: AST.Entity[] = [];
  const resolvedBehaviors: AST.Behavior[] = [];
  const federatedBehaviors: FederatedBehavior[] = [];

  // Process types
  for (const [name, definitions] of typeMap) {
    if (definitions.length > 1) {
      const conflict = detectTypeConflict(name, definitions);
      if (conflict) {
        conflicts.push(conflict);
        if (resolveConflicts === 'error') continue;
      }
    }

    const resolved = resolveDefinitions(definitions, resolveConflicts);
    if (resolved) {
      resolvedTypes.push(resolved.type);
    }
  }

  // Process entities
  for (const [name, definitions] of entityMap) {
    if (definitions.length > 1) {
      const conflict = detectEntityConflict(name, definitions);
      if (conflict) {
        conflicts.push(conflict);
        if (resolveConflicts === 'error') continue;
      }
    }

    const resolved = resolveEntityDefinitions(definitions, resolveConflicts);
    if (resolved) {
      resolvedEntities.push(resolved.entity);
    }
  }

  // Process behaviors
  for (const [name, definitions] of behaviorMap) {
    if (definitions.length > 1) {
      const conflict = detectBehaviorConflict(name, definitions);
      if (conflict) {
        conflicts.push(conflict);
        if (resolveConflicts === 'error') continue;
      }
    }

    const resolved = resolveBehaviorDefinitions(definitions, resolveConflicts);
    if (resolved) {
      resolvedBehaviors.push(resolved.behavior);
      
      // Generate federated behavior if from external service
      if (options.generateFederatedBehaviors) {
        const service = services.find(s => s.name === resolved.service);
        if (service) {
          federatedBehaviors.push({
            name: resolved.behavior.name.name,
            service: resolved.service,
            behavior: resolved.behavior,
            routing: generateRoutingRule(service, resolved.behavior),
          });
        }
      }
    }
  }

  // Check for success
  const hasErrors = conflicts.some(c => c.severity === 'error');
  if (hasErrors && resolveConflicts === 'error') {
    return {
      success: false,
      conflicts,
      warnings,
    };
  }

  const composedSchema: ComposedSchema = {
    name: 'FederatedSchema',
    version: generateComposedVersion(services),
    services: services.map(s => s.name),
    types: resolvedTypes,
    entities: resolvedEntities,
    behaviors: resolvedBehaviors,
    crossServiceBehaviors: federatedBehaviors,
  };

  return {
    success: true,
    schema: composedSchema,
    conflicts,
    warnings,
  };
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

function detectTypeConflict(
  name: string,
  definitions: Array<{ type: AST.TypeDeclaration; service: string }>
): SchemaConflict | null {
  // Check if definitions are compatible
  const first = definitions[0];
  
  for (let i = 1; i < definitions.length; i++) {
    const current = definitions[i];
    if (!areTypesCompatible(first.type.definition, current.type.definition)) {
      return {
        type: 'type-mismatch',
        severity: 'error',
        services: definitions.map(d => d.service),
        path: `types.${name}`,
        description: `Type "${name}" has incompatible definitions across services`,
        suggestion: 'Consider using service-prefixed type names or unifying the definition',
      };
    }
  }

  return null;
}

function detectEntityConflict(
  name: string,
  definitions: Array<{ entity: AST.Entity; service: string }>
): SchemaConflict | null {
  return {
    type: 'entity-collision',
    severity: 'error',
    services: definitions.map(d => d.service),
    path: `entities.${name}`,
    description: `Entity "${name}" is defined in multiple services`,
    suggestion: 'Entities should be owned by a single service',
  };
}

function detectBehaviorConflict(
  name: string,
  definitions: Array<{ behavior: AST.Behavior; service: string }>
): SchemaConflict | null {
  return {
    type: 'behavior-collision',
    severity: 'warning',
    services: definitions.map(d => d.service),
    path: `behaviors.${name}`,
    description: `Behavior "${name}" is defined in multiple services`,
    suggestion: 'Use service-prefixed behavior names or route through gateway',
  };
}

function areTypesCompatible(a: AST.TypeDefinition, b: AST.TypeDefinition): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'PrimitiveType':
      return a.name === (b as AST.PrimitiveType).name;
    
    case 'EnumType': {
      const bEnum = b as AST.EnumType;
      const aVariants = new Set(a.variants.map(v => v.name.name));
      const bVariants = new Set(bEnum.variants.map(v => v.name.name));
      // Check if one is subset of other (forward/backward compatible)
      return [...aVariants].every(v => bVariants.has(v)) ||
             [...bVariants].every(v => aVariants.has(v));
    }
    
    case 'StructType': {
      const bStruct = b as AST.StructType;
      // Check if required fields match
      const aRequired = a.fields.filter(f => !f.optional);
      const bRequired = bStruct.fields.filter(f => !f.optional);
      if (aRequired.length !== bRequired.length) return false;
      
      for (const aField of aRequired) {
        const bField = bRequired.find(f => f.name.name === aField.name.name);
        if (!bField) return false;
        if (!areTypesCompatible(aField.type, bField.type)) return false;
      }
      return true;
    }
    
    default:
      return JSON.stringify(a) === JSON.stringify(b);
  }
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

function resolveDefinitions<T>(
  definitions: Array<{ type: T; service: string }>,
  strategy: 'first' | 'last' | 'error' | 'merge'
): { type: T; service: string } | null {
  switch (strategy) {
    case 'first':
      return definitions[0];
    case 'last':
      return definitions[definitions.length - 1];
    case 'error':
      return definitions.length === 1 ? definitions[0] : null;
    case 'merge':
      // For types, we'd need type-specific merge logic
      return definitions[0];
    default:
      return definitions[0];
  }
}

function resolveEntityDefinitions(
  definitions: Array<{ entity: AST.Entity; service: string }>,
  strategy: 'first' | 'last' | 'error' | 'merge'
): { entity: AST.Entity; service: string } | null {
  return resolveDefinitions(definitions.map(d => ({ type: d.entity, service: d.service })), strategy) as any;
}

function resolveBehaviorDefinitions(
  definitions: Array<{ behavior: AST.Behavior; service: string }>,
  strategy: 'first' | 'last' | 'error' | 'merge'
): { behavior: AST.Behavior; service: string } | null {
  return resolveDefinitions(definitions.map(d => ({ type: d.behavior, service: d.service })), strategy) as any;
}

// ============================================================================
// ROUTING
// ============================================================================

function generateRoutingRule(service: FederatedService, behavior: AST.Behavior): RoutingRule {
  return {
    service: service.name,
    path: `/${service.name}/${toKebabCase(behavior.name.name)}`,
    method: 'POST',
    timeout: 30000,
    retries: 3,
    circuitBreaker: {
      threshold: 50,
      timeout: 60000,
      halfOpenRequests: 3,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function generateComposedVersion(services: FederatedService[]): string {
  // Create a composite version based on all service versions
  const versions = services.map(s => s.version);
  const hash = versions.join('-').slice(0, 8);
  return `composed-${hash}`;
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

// ============================================================================
// MERGING
// ============================================================================

/**
 * Merge two entity definitions
 */
export function mergeEntities(a: AST.Entity, b: AST.Entity): AST.Entity {
  const fieldMap = new Map<string, AST.Field>();
  
  // Add fields from a
  for (const field of a.fields) {
    fieldMap.set(field.name.name, field);
  }
  
  // Add/merge fields from b
  for (const field of b.fields) {
    if (!fieldMap.has(field.name.name)) {
      fieldMap.set(field.name.name, field);
    }
    // If field exists, keep original (could add merge logic here)
  }

  return {
    ...a,
    fields: Array.from(fieldMap.values()),
    invariants: [...a.invariants, ...b.invariants],
  };
}

/**
 * Merge two type definitions (for compatible types)
 */
export function mergeTypes(a: AST.TypeDefinition, b: AST.TypeDefinition): AST.TypeDefinition {
  if (a.kind !== b.kind) {
    return a; // Can't merge incompatible types
  }

  if (a.kind === 'EnumType' && b.kind === 'EnumType') {
    // Merge enum variants
    const variantSet = new Set(a.variants.map(v => v.name.name));
    const mergedVariants = [...a.variants];
    
    for (const variant of b.variants) {
      if (!variantSet.has(variant.name.name)) {
        mergedVariants.push(variant);
      }
    }
    
    return { ...a, variants: mergedVariants };
  }

  return a;
}
