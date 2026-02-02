// ============================================================================
// Federation Validator
// Validates federated schemas and cross-service references
// ============================================================================

import type * as AST from './ast';
import type {
  FederatedService,
  CrossServiceReference,
  EventContract,
} from './types';
import { FederationRegistry } from './registry';

// ============================================================================
// TYPES
// ============================================================================

export interface FederationValidation {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface ValidationError {
  code: string;
  message: string;
  service?: string;
  path?: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  service?: string;
  path?: string;
  severity: 'warning';
}

export interface ValidationStats {
  servicesChecked: number;
  referencesValidated: number;
  conflictsDetected: number;
  deprecatedUsages: number;
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

/**
 * Validate a federation registry
 */
export function validate(registry: FederationRegistry): FederationValidation {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    servicesChecked: 0,
    referencesValidated: 0,
    conflictsDetected: 0,
    deprecatedUsages: 0,
  };

  const services = registry.getAllServices();
  stats.servicesChecked = services.length;

  // Validate each service
  for (const registration of services) {
    const serviceErrors = validateService(registration.service);
    errors.push(...serviceErrors);

    const serviceWarnings = checkServiceWarnings(registration.service);
    warnings.push(...serviceWarnings);
  }

  // Validate cross-service references
  const references = registry.getReferences();
  stats.referencesValidated = references.length;

  for (const ref of references) {
    const refErrors = validateReference(ref, registry);
    errors.push(...refErrors);
  }

  // Check for circular dependencies
  const cycles = registry.detectCircularDependencies();
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      errors.push({
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        severity: 'error',
      });
      stats.conflictsDetected++;
    }
  }

  // Check for deprecated usages
  const deprecatedInUse = registry.getDeprecatedInUse();
  for (const dep of deprecatedInUse) {
    warnings.push({
      code: 'DEPRECATED_IN_USE',
      message: `Deprecated version ${dep.version} of ${dep.service} is still in use by: ${dep.dependents.join(', ')}`,
      service: dep.service,
      severity: 'warning',
    });
    stats.deprecatedUsages++;
  }

  // Validate type compatibility
  const typeErrors = validateTypeCompatibility(services.map(s => s.service));
  errors.push(...typeErrors);
  stats.conflictsDetected += typeErrors.length;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

// ============================================================================
// SERVICE VALIDATION
// ============================================================================

function validateService(service: FederatedService): ValidationError[] {
  const errors: ValidationError[] = [];
  const domain = service.domain;

  // Validate domain structure
  if (!domain.name || !domain.version) {
    errors.push({
      code: 'INVALID_DOMAIN',
      message: 'Domain must have name and version',
      service: service.name,
      severity: 'error',
    });
  }

  // Validate entities
  for (const entity of domain.entities) {
    const entityErrors = validateEntity(entity, service.name);
    errors.push(...entityErrors);
  }

  // Validate behaviors
  for (const behavior of domain.behaviors) {
    const behaviorErrors = validateBehavior(behavior, service.name);
    errors.push(...behaviorErrors);
  }

  // Validate service metadata
  if (!service.metadata.owner) {
    errors.push({
      code: 'MISSING_OWNER',
      message: 'Service must have an owner defined',
      service: service.name,
      severity: 'error',
    });
  }

  return errors;
}

function validateEntity(entity: AST.Entity, serviceName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have at least one field
  if (entity.fields.length === 0) {
    errors.push({
      code: 'EMPTY_ENTITY',
      message: `Entity ${entity.name.name} has no fields`,
      service: serviceName,
      path: `entities.${entity.name.name}`,
      severity: 'error',
    });
  }

  // Should have an ID field
  const hasId = entity.fields.some(f => 
    f.name.name === 'id' || 
    f.annotations.some(a => a.name.name === 'unique' || a.name.name === 'primary')
  );

  if (!hasId) {
    errors.push({
      code: 'MISSING_ID',
      message: `Entity ${entity.name.name} should have an identifier field`,
      service: serviceName,
      path: `entities.${entity.name.name}`,
      severity: 'error',
    });
  }

  return errors;
}

function validateBehavior(behavior: AST.Behavior, serviceName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have input and output
  if (!behavior.input) {
    errors.push({
      code: 'MISSING_INPUT',
      message: `Behavior ${behavior.name.name} must have input spec`,
      service: serviceName,
      path: `behaviors.${behavior.name.name}`,
      severity: 'error',
    });
  }

  if (!behavior.output) {
    errors.push({
      code: 'MISSING_OUTPUT',
      message: `Behavior ${behavior.name.name} must have output spec`,
      service: serviceName,
      path: `behaviors.${behavior.name.name}`,
      severity: 'error',
    });
  }

  return errors;
}

function checkServiceWarnings(service: FederatedService): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for missing SLA
  if (!service.metadata.sla) {
    warnings.push({
      code: 'MISSING_SLA',
      message: 'Service should define SLA requirements',
      service: service.name,
      severity: 'warning',
    });
  }

  // Check for missing description
  if (!service.metadata.description) {
    warnings.push({
      code: 'MISSING_DESCRIPTION',
      message: 'Service should have a description',
      service: service.name,
      severity: 'warning',
    });
  }

  // Check for behaviors without descriptions
  for (const behavior of service.domain.behaviors) {
    if (!behavior.description) {
      warnings.push({
        code: 'MISSING_BEHAVIOR_DESCRIPTION',
        message: `Behavior ${behavior.name.name} should have a description`,
        service: service.name,
        path: `behaviors.${behavior.name.name}`,
        severity: 'warning',
      });
    }
  }

  return warnings;
}

// ============================================================================
// REFERENCE VALIDATION
// ============================================================================

function validateReference(
  ref: CrossServiceReference,
  registry: FederationRegistry
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if target service exists
  const targetService = registry.getService(ref.targetService);
  if (!targetService) {
    errors.push({
      code: 'MISSING_DEPENDENCY',
      message: `Service ${ref.sourceService} references non-existent service ${ref.targetService}`,
      service: ref.sourceService,
      path: ref.sourcePath,
      severity: 'error',
    });
    return errors;
  }

  // Check if target type exists
  const targetDomain = targetService.service.domain;
  
  switch (ref.referenceKind) {
    case 'entity-reference': {
      const entityExists = targetDomain.entities.some(e => e.name.name === ref.targetType);
      if (!entityExists) {
        errors.push({
          code: 'MISSING_ENTITY',
          message: `Referenced entity ${ref.targetType} not found in ${ref.targetService}`,
          service: ref.sourceService,
          path: ref.sourcePath,
          severity: 'error',
        });
      }
      break;
    }

    case 'type-import': {
      const typeExists = 
        targetDomain.types.some(t => t.name.name === ref.targetType) ||
        targetDomain.entities.some(e => e.name.name === ref.targetType);
      if (!typeExists) {
        errors.push({
          code: 'MISSING_TYPE',
          message: `Imported type ${ref.targetType} not found in ${ref.targetService}`,
          service: ref.sourceService,
          path: ref.sourcePath,
          severity: 'error',
        });
      }
      break;
    }

    case 'behavior-call': {
      const behaviorExists = targetDomain.behaviors.some(b => b.name.name === ref.targetType);
      if (!behaviorExists) {
        errors.push({
          code: 'MISSING_BEHAVIOR',
          message: `Called behavior ${ref.targetType} not found in ${ref.targetService}`,
          service: ref.sourceService,
          path: ref.sourcePath,
          severity: 'error',
        });
      }
      break;
    }
  }

  return errors;
}

// ============================================================================
// TYPE COMPATIBILITY
// ============================================================================

function validateTypeCompatibility(services: FederatedService[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const typeDefinitions = new Map<string, Array<{ service: string; type: AST.TypeDeclaration }>>();

  // Collect all type definitions
  for (const service of services) {
    for (const type of service.domain.types) {
      const existing = typeDefinitions.get(type.name.name) ?? [];
      existing.push({ service: service.name, type });
      typeDefinitions.set(type.name.name, existing);
    }
  }

  // Check for incompatible definitions
  for (const [typeName, definitions] of typeDefinitions) {
    if (definitions.length > 1) {
      const first = definitions[0];
      if (!first) continue;
      
      for (let i = 1; i < definitions.length; i++) {
        const current = definitions[i];
        if (!current) continue;
        
        if (!areTypesStructurallyEqual(first.type.definition, current.type.definition)) {
          errors.push({
            code: 'TYPE_MISMATCH',
            message: `Type ${typeName} has incompatible definitions in ${first.service} and ${current.service}`,
            severity: 'error',
          });
        }
      }
    }
  }

  return errors;
}

function areTypesStructurallyEqual(a: AST.TypeDefinition, b: AST.TypeDefinition): boolean {
  if (a.kind !== b.kind) return false;
  
  // Simplified structural equality check
  return JSON.stringify(stripLocations(a)) === JSON.stringify(stripLocations(b));
}

function stripLocations(node: unknown): unknown {
  if (node === null || node === undefined) return node;
  if (typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(stripLocations);
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'location') {
      result[key] = stripLocations(value);
    }
  }
  return result;
}

// ============================================================================
// EVENT CONTRACT VALIDATION
// ============================================================================

/**
 * Validate event contracts across services
 */
export function validateEventContracts(
  contracts: EventContract[],
  registry: FederationRegistry
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const contract of contracts) {
    // Check publisher exists
    const publisher = registry.getService(contract.publisher);
    if (!publisher) {
      errors.push({
        code: 'MISSING_PUBLISHER',
        message: `Event publisher ${contract.publisher} not found`,
        severity: 'error',
      });
      continue;
    }

    // Check all consumers exist
    for (const consumer of contract.consumers) {
      const consumerService = registry.getService(consumer);
      if (!consumerService) {
        errors.push({
          code: 'MISSING_CONSUMER',
          message: `Event consumer ${consumer} not found for event ${contract.event}`,
          severity: 'error',
        });
      }
    }

    // Validate schema compatibility based on compatibility mode
    // (This would check backward/forward compatibility based on contract.compatibility)
  }

  return errors;
}
