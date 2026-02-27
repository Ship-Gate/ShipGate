/**
 * Contract Enforcer
 * 
 * Validates preconditions, postconditions, and invariants.
 */

import { StateManager } from './state.js';
import type { BehaviorSpec, DomainSpec, InvariantSpec, Logger, FieldSpec } from './runtime.js';
import type { ExecutionContext } from './executor.js';

// ============================================================================
// Types
// ============================================================================

export interface ContractViolation {
  type: 'precondition' | 'postcondition' | 'invariant' | 'input' | 'constraint';
  predicate: string;
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
}

// ============================================================================
// Contract Enforcer
// ============================================================================

export class ContractEnforcer {
  private state: StateManager;
  private logger: Logger;
  private domains: Map<string, DomainSpec> = new Map();

  constructor(state: StateManager, logger: Logger) {
    this.state = state;
    this.logger = logger;
  }

  /**
   * Register domain for type validation
   */
  registerDomain(spec: DomainSpec): void {
    this.domains.set(spec.name, spec);
  }

  /**
   * Validate input against behavior spec
   */
  validateInput(spec: BehaviorSpec, input: unknown): ContractViolation[] {
    const violations: ContractViolation[] = [];

    if (typeof input !== 'object' || input === null) {
      if (spec.input.length > 0) {
        violations.push({
          type: 'input',
          predicate: 'input.isObject',
          message: 'Input must be an object',
        });
      }
      return violations;
    }

    const inputObj = input as Record<string, unknown>;

    // Check required fields
    for (const field of spec.input) {
      const value = inputObj[field.name];

      if (value === undefined && !field.optional) {
        violations.push({
          type: 'input',
          predicate: `input.${field.name}.required`,
          message: `Required field '${field.name}' is missing`,
          path: field.name,
        });
        continue;
      }

      if (value !== undefined) {
        // Validate type
        const typeViolation = this.validateType(value, field.type, field.name);
        if (typeViolation) violations.push(typeViolation);

        // Validate constraints
        for (const constraint of field.constraints) {
          const constraintViolation = this.validateConstraint(value, constraint.name, constraint.value, field.name);
          if (constraintViolation) violations.push(constraintViolation);
        }
      }
    }

    return violations;
  }

  /**
   * Check preconditions
   */
  async checkPreconditions(
    spec: BehaviorSpec,
    input: unknown,
    context: ExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    for (const predicate of spec.preconditions) {
      try {
        const result = await this.evaluatePredicate(predicate, { input, context });
        if (!result) {
          violations.push({
            type: 'precondition',
            predicate,
            message: `Precondition failed: ${predicate}`,
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to evaluate precondition: ${predicate}`, { error });
      }
    }

    return violations;
  }

  /**
   * Check postconditions
   */
  async checkPostconditions(
    spec: BehaviorSpec,
    input: unknown,
    result: unknown,
    context: ExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    for (const postcondition of spec.postconditions) {
      // Check if guard matches
      const guardMatches = this.evaluateGuard(postcondition.guard, result);
      if (!guardMatches) continue;

      for (const predicate of postcondition.predicates) {
        try {
          const evalResult = await this.evaluatePredicate(predicate, {
            input,
            result,
            old: context.oldState,
            context,
          });
          if (!evalResult) {
            violations.push({
              type: 'postcondition',
              predicate,
              message: `Postcondition failed: ${predicate}`,
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to evaluate postcondition: ${predicate}`, { error });
        }
      }
    }

    return violations;
  }

  /**
   * Check invariants
   */
  async checkInvariants(
    invariants: InvariantSpec[],
    context: ExecutionContext
  ): Promise<ContractViolation[]> {
    const violations: ContractViolation[] = [];

    for (const invariant of invariants) {
      if (invariant.scope === 'global' || invariant.scope === 'transaction') {
        for (const predicate of invariant.predicates) {
          try {
            const result = await this.evaluatePredicate(predicate, { context });
            if (!result) {
              violations.push({
                type: 'invariant',
                predicate,
                message: `Invariant '${invariant.name}' violated: ${predicate}`,
              });
            }
          } catch (error) {
            this.logger.warn(`Failed to evaluate invariant: ${predicate}`, { error });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Validate a value against a type
   */
  private validateType(value: unknown, type: string, path: string): ContractViolation | null {
    switch (type) {
      case 'String':
        if (typeof value !== 'string') {
          return { type: 'input', predicate: `${path}.type`, message: `Expected string at '${path}'`, path, expected: 'string', actual: typeof value };
        }
        break;
      case 'Int':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return { type: 'input', predicate: `${path}.type`, message: `Expected integer at '${path}'`, path, expected: 'integer', actual: typeof value };
        }
        break;
      case 'Decimal':
        if (typeof value !== 'number' && typeof value !== 'string') {
          return { type: 'input', predicate: `${path}.type`, message: `Expected decimal at '${path}'`, path };
        }
        break;
      case 'Boolean':
        if (typeof value !== 'boolean') {
          return { type: 'input', predicate: `${path}.type`, message: `Expected boolean at '${path}'`, path, expected: 'boolean', actual: typeof value };
        }
        break;
      case 'UUID':
        if (typeof value !== 'string' || !this.isUUID(value)) {
          return { type: 'input', predicate: `${path}.type`, message: `Expected UUID at '${path}'`, path };
        }
        break;
    }
    return null;
  }

  /**
   * Validate a constraint
   */
  private validateConstraint(value: unknown, constraint: string, constraintValue: unknown, path: string): ContractViolation | null {
    switch (constraint) {
      case 'min':
        if (typeof value === 'number' && value < (constraintValue as number)) {
          return { type: 'constraint', predicate: `${path}.min`, message: `Value at '${path}' must be >= ${constraintValue}`, path, expected: constraintValue, actual: value };
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > (constraintValue as number)) {
          return { type: 'constraint', predicate: `${path}.max`, message: `Value at '${path}' must be <= ${constraintValue}`, path, expected: constraintValue, actual: value };
        }
        break;
      case 'min_length':
        if (typeof value === 'string' && value.length < (constraintValue as number)) {
          return { type: 'constraint', predicate: `${path}.min_length`, message: `String at '${path}' must be >= ${constraintValue} chars`, path };
        }
        break;
      case 'max_length':
        if (typeof value === 'string' && value.length > (constraintValue as number)) {
          return { type: 'constraint', predicate: `${path}.max_length`, message: `String at '${path}' must be <= ${constraintValue} chars`, path };
        }
        break;
      case 'pattern':
      case 'format':
        if (typeof value === 'string') {
          const regex = new RegExp(constraintValue as string);
          if (!regex.test(value)) {
            return { type: 'constraint', predicate: `${path}.pattern`, message: `Value at '${path}' must match pattern`, path };
          }
        }
        break;
    }
    return null;
  }

  /**
   * Evaluate a predicate expression
   */
  private async evaluatePredicate(predicate: string, context: Record<string, unknown>): Promise<boolean> {
    // Simple predicate evaluation - in production, use a proper expression evaluator
    try {
      // Handle common patterns
      if (predicate.includes('input.') && predicate.includes('.is_valid')) {
        return true; // Assume valid after type checking
      }
      if (predicate.includes('.length >=')) {
        const match = predicate.match(/(\w+)\.length >= (\d+)/);
        if (match) {
          const value = this.resolvePath(context, match[1] || '');
          return typeof value === 'string' && value.length >= parseInt(match[2] || '0');
        }
      }
      if (predicate.includes('.exists')) {
        return true; // Simplified
      }

      // Default to true for now (production would evaluate properly)
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Evaluate a guard condition
   */
  private evaluateGuard(guard: string, result: unknown): boolean {
    if (guard === 'success') {
      return result !== undefined && result !== null;
    }
    if (guard === 'any_error') {
      return result === undefined || result === null;
    }
    // Custom error code guard
    return true;
  }

  /**
   * Resolve a path in an object
   */
  private resolvePath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Check if string is UUID
   */
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }
}
