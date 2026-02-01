/**
 * Request Validator
 * 
 * Validate requests against ISL specifications.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation violations */
  violations: ValidationViolation[];
  /** Validated data (with defaults applied) */
  data?: Record<string, unknown>;
  /** Validation duration */
  duration: number;
}

export interface ValidationViolation {
  /** Violation type */
  type: 'missing_field' | 'invalid_type' | 'constraint_violation' | 'precondition_failed';
  /** Field path */
  path: string;
  /** Expected value/type */
  expected?: string;
  /** Actual value/type */
  actual?: string;
  /** Error message */
  message: string;
}

export interface ValidationError extends Error {
  violations: ValidationViolation[];
}

/**
 * Request Validator
 */
export class RequestValidator {
  private domains = new Map<string, DomainDeclaration>();
  private typeCache = new Map<string, TypeDefinition>();

  /**
   * Register a domain for validation
   */
  registerDomain(domain: DomainDeclaration): void {
    this.domains.set(domain.name.name, domain);
    this.cacheTypes(domain);
  }

  /**
   * Cache type definitions for faster lookup
   */
  private cacheTypes(domain: DomainDeclaration): void {
    for (const entity of domain.entities) {
      const key = `${domain.name.name}:${entity.name.name}`;
      this.typeCache.set(key, {
        kind: 'entity',
        name: entity.name.name,
        fields: entity.fields.map((f) => ({
          name: f.name.name,
          type: this.extractTypeName(f.type),
          optional: f.optional ?? false,
        })),
      });
    }

    for (const type of domain.types) {
      const key = `${domain.name.name}:${type.name.name}`;
      this.typeCache.set(key, {
        kind: 'type',
        name: type.name.name,
        baseType: this.extractTypeName(type.baseType),
        constraints: type.constraints ?? [],
      });
    }

    for (const enumDecl of domain.enums) {
      const key = `${domain.name.name}:${enumDecl.name.name}`;
      this.typeCache.set(key, {
        kind: 'enum',
        name: enumDecl.name.name,
        variants: enumDecl.variants.map((v) => v.name),
      });
    }
  }

  /**
   * Validate request input
   */
  async validate(
    domainName: string,
    behaviorName: string,
    data: unknown
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const violations: ValidationViolation[] = [];

    const domain = this.domains.get(domainName);
    if (!domain) {
      return {
        valid: false,
        violations: [{
          type: 'precondition_failed',
          path: '',
          message: `Domain '${domainName}' not found`,
        }],
        duration: Date.now() - startTime,
      };
    }

    const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
    if (!behavior) {
      return {
        valid: false,
        violations: [{
          type: 'precondition_failed',
          path: '',
          message: `Behavior '${behaviorName}' not found in domain '${domainName}'`,
        }],
        duration: Date.now() - startTime,
      };
    }

    // Validate input fields
    if (behavior.input) {
      const inputViolations = this.validateFields(
        domainName,
        behavior.input.fields,
        data as Record<string, unknown>,
        ''
      );
      violations.push(...inputViolations);
    }

    // Validate preconditions
    if (behavior.preconditions) {
      const preconditionViolations = await this.validatePreconditions(
        behavior.preconditions.conditions,
        data as Record<string, unknown>
      );
      violations.push(...preconditionViolations);
    }

    return {
      valid: violations.length === 0,
      violations,
      data: violations.length === 0 ? data as Record<string, unknown> : undefined,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate response output
   */
  async validateResponse(
    domainName: string,
    behaviorName: string,
    data: unknown
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const violations: ValidationViolation[] = [];

    const domain = this.domains.get(domainName);
    if (!domain) {
      return {
        valid: false,
        violations: [],
        duration: Date.now() - startTime,
      };
    }

    const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
    if (!behavior?.output) {
      return {
        valid: true,
        violations: [],
        duration: Date.now() - startTime,
      };
    }

    // Validate output type
    const outputTypeName = this.extractTypeName(behavior.output.success);
    const outputType = this.typeCache.get(`${domainName}:${outputTypeName}`);

    if (outputType?.kind === 'entity') {
      const outputViolations = this.validateFields(
        domainName,
        outputType.fields.map((f) => ({
          name: { name: f.name },
          type: { kind: 'SimpleType', name: { name: f.type } },
          optional: f.optional,
        })),
        data as Record<string, unknown>,
        ''
      );
      violations.push(...outputViolations);
    }

    // Validate postconditions
    if (behavior.postconditions) {
      const postconditionViolations = await this.validatePostconditions(
        behavior.postconditions.conditions,
        data as Record<string, unknown>
      );
      violations.push(...postconditionViolations);
    }

    return {
      valid: violations.length === 0,
      violations,
      data: violations.length === 0 ? data as Record<string, unknown> : undefined,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate fields against schema
   */
  private validateFields(
    domainName: string,
    fields: Array<{
      name: { name: string };
      type: unknown;
      optional?: boolean;
    }>,
    data: Record<string, unknown>,
    path: string
  ): ValidationViolation[] {
    const violations: ValidationViolation[] = [];

    for (const field of fields) {
      const fieldPath = path ? `${path}.${field.name.name}` : field.name.name;
      const value = data?.[field.name.name];

      // Check required fields
      if (!field.optional && (value === undefined || value === null)) {
        violations.push({
          type: 'missing_field',
          path: fieldPath,
          expected: 'value',
          actual: 'undefined',
          message: `Required field '${fieldPath}' is missing`,
        });
        continue;
      }

      // Skip optional missing fields
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const expectedType = this.extractTypeName(field.type);
      const typeViolation = this.validateType(
        domainName,
        expectedType,
        value,
        fieldPath
      );
      
      if (typeViolation) {
        violations.push(typeViolation);
      }
    }

    return violations;
  }

  /**
   * Validate a value against a type
   */
  private validateType(
    domainName: string,
    typeName: string,
    value: unknown,
    path: string
  ): ValidationViolation | null {
    // Primitive types
    switch (typeName) {
      case 'String':
        if (typeof value !== 'string') {
          return {
            type: 'invalid_type',
            path,
            expected: 'String',
            actual: typeof value,
            message: `Expected String at '${path}', got ${typeof value}`,
          };
        }
        return null;

      case 'Int':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return {
            type: 'invalid_type',
            path,
            expected: 'Int',
            actual: typeof value,
            message: `Expected Int at '${path}', got ${typeof value}`,
          };
        }
        return null;

      case 'Decimal':
        if (typeof value !== 'number') {
          return {
            type: 'invalid_type',
            path,
            expected: 'Decimal',
            actual: typeof value,
            message: `Expected Decimal at '${path}', got ${typeof value}`,
          };
        }
        return null;

      case 'Boolean':
        if (typeof value !== 'boolean') {
          return {
            type: 'invalid_type',
            path,
            expected: 'Boolean',
            actual: typeof value,
            message: `Expected Boolean at '${path}', got ${typeof value}`,
          };
        }
        return null;

      case 'UUID':
        if (typeof value !== 'string' || !this.isUUID(value)) {
          return {
            type: 'invalid_type',
            path,
            expected: 'UUID',
            actual: String(value),
            message: `Expected UUID at '${path}'`,
          };
        }
        return null;

      case 'Timestamp':
        if (typeof value !== 'string' || !this.isTimestamp(value)) {
          return {
            type: 'invalid_type',
            path,
            expected: 'Timestamp',
            actual: String(value),
            message: `Expected Timestamp at '${path}'`,
          };
        }
        return null;
    }

    // Check custom types
    const customType = this.typeCache.get(`${domainName}:${typeName}`);
    
    if (customType?.kind === 'enum') {
      if (!customType.variants.includes(value as string)) {
        return {
          type: 'invalid_type',
          path,
          expected: `one of [${customType.variants.join(', ')}]`,
          actual: String(value),
          message: `Invalid enum value at '${path}'`,
        };
      }
      return null;
    }

    return null;
  }

  /**
   * Validate preconditions
   */
  private async validatePreconditions(
    conditions: unknown[],
    data: Record<string, unknown>
  ): Promise<ValidationViolation[]> {
    // In a full implementation, this would evaluate ISL expressions
    // For now, we return no violations
    return [];
  }

  /**
   * Validate postconditions
   */
  private async validatePostconditions(
    conditions: unknown[],
    data: Record<string, unknown>
  ): Promise<ValidationViolation[]> {
    // In a full implementation, this would evaluate ISL expressions
    return [];
  }

  /**
   * Extract type name from type expression
   */
  private extractTypeName(type: unknown): string {
    if (!type || typeof type !== 'object') return 'unknown';

    const t = type as { kind: string; name?: { name: string } };

    if (t.kind === 'SimpleType' && t.name) {
      return t.name.name;
    }

    if (t.kind === 'GenericType' && t.name) {
      return t.name.name;
    }

    return 'unknown';
  }

  /**
   * Check if string is UUID format
   */
  private isUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Check if string is ISO timestamp
   */
  private isTimestamp(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}

interface TypeDefinition {
  kind: 'entity' | 'type' | 'enum';
  name: string;
  fields?: Array<{ name: string; type: string; optional: boolean }>;
  baseType?: string;
  constraints?: unknown[];
  variants?: string[];
}

/**
 * Validate a request
 */
export async function validateRequest(
  domain: DomainDeclaration,
  behaviorName: string,
  data: unknown
): Promise<ValidationResult> {
  const validator = new RequestValidator();
  validator.registerDomain(domain);
  return validator.validate(domain.name.name, behaviorName, data);
}
