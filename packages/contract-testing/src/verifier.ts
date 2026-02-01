/**
 * Contract Verifier
 * 
 * Verify contracts against ISL specifications.
 */

import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import type { Contract, ContractBehavior } from './broker.js';

export interface VerificationOptions {
  /** Strict mode - fail on any mismatch */
  strict?: boolean;
  /** Check preconditions */
  checkPreconditions?: boolean;
  /** Check postconditions */
  checkPostconditions?: boolean;
  /** Check types */
  checkTypes?: boolean;
  /** Allow extra fields in contract */
  allowExtraFields?: boolean;
}

export interface VerificationResult {
  /** Overall verification success */
  valid: boolean;
  /** Contract being verified */
  contract: Contract;
  /** ISL domain verified against */
  domain: string;
  /** Individual verification results */
  results: BehaviorVerificationResult[];
  /** Errors found */
  errors: VerificationError[];
  /** Warnings */
  warnings: VerificationWarning[];
}

export interface BehaviorVerificationResult {
  /** Behavior name */
  behavior: string;
  /** Verification success */
  valid: boolean;
  /** Input verification */
  input: FieldVerificationResult;
  /** Output verification */
  output: FieldVerificationResult;
  /** Precondition verification */
  preconditions: ConditionVerificationResult;
  /** Postcondition verification */
  postconditions: ConditionVerificationResult;
}

export interface FieldVerificationResult {
  valid: boolean;
  missingFields: string[];
  extraFields: string[];
  typeMismatches: TypeMismatch[];
}

export interface TypeMismatch {
  field: string;
  expected: string;
  actual: string;
}

export interface ConditionVerificationResult {
  valid: boolean;
  missing: string[];
  extra: string[];
}

export interface VerificationError {
  type: 'missing_behavior' | 'type_mismatch' | 'missing_field' | 'invalid_condition';
  behavior?: string;
  field?: string;
  message: string;
}

export interface VerificationWarning {
  type: 'extra_field' | 'extra_behavior' | 'deprecated';
  behavior?: string;
  field?: string;
  message: string;
}

/**
 * Contract Verifier
 */
export class ContractVerifier {
  private options: Required<VerificationOptions>;

  constructor(options: VerificationOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      checkPreconditions: options.checkPreconditions ?? true,
      checkPostconditions: options.checkPostconditions ?? true,
      checkTypes: options.checkTypes ?? true,
      allowExtraFields: options.allowExtraFields ?? true,
    };
  }

  /**
   * Verify a contract against an ISL source
   */
  verify(contract: Contract, islSource: string): VerificationResult {
    const parseResult = parseISL(islSource);

    if (parseResult.errors.length > 0 || !parseResult.ast) {
      return {
        valid: false,
        contract,
        domain: contract.domain,
        results: [],
        errors: [{
          type: 'missing_behavior',
          message: `Failed to parse ISL: ${parseResult.errors[0]?.message}`,
        }],
        warnings: [],
      };
    }

    return this.verifyAgainstDomain(contract, parseResult.ast);
  }

  /**
   * Verify against a parsed domain
   */
  verifyAgainstDomain(
    contract: Contract,
    domain: DomainDeclaration
  ): VerificationResult {
    const errors: VerificationError[] = [];
    const warnings: VerificationWarning[] = [];
    const results: BehaviorVerificationResult[] = [];

    // Build behavior map from domain
    const domainBehaviors = new Map<string, typeof domain.behaviors[0]>();
    for (const behavior of domain.behaviors) {
      domainBehaviors.set(behavior.name.name, behavior);
    }

    // Verify each contract behavior
    for (const contractBehavior of contract.spec.behaviors) {
      const domainBehavior = domainBehaviors.get(contractBehavior.name);

      if (!domainBehavior) {
        errors.push({
          type: 'missing_behavior',
          behavior: contractBehavior.name,
          message: `Behavior '${contractBehavior.name}' not found in domain`,
        });
        continue;
      }

      const result = this.verifyBehavior(contractBehavior, domainBehavior, domain);
      results.push(result);

      // Collect errors
      if (!result.input.valid) {
        for (const field of result.input.missingFields) {
          errors.push({
            type: 'missing_field',
            behavior: contractBehavior.name,
            field,
            message: `Missing required input field '${field}'`,
          });
        }
        for (const mismatch of result.input.typeMismatches) {
          errors.push({
            type: 'type_mismatch',
            behavior: contractBehavior.name,
            field: mismatch.field,
            message: `Type mismatch for '${mismatch.field}': expected ${mismatch.expected}, got ${mismatch.actual}`,
          });
        }
      }

      // Collect warnings
      if (!this.options.strict) {
        for (const field of result.input.extraFields) {
          warnings.push({
            type: 'extra_field',
            behavior: contractBehavior.name,
            field,
            message: `Extra input field '${field}' not in ISL spec`,
          });
        }
      }
    }

    // Check for behaviors in contract not in domain
    const contractBehaviorNames = new Set(contract.spec.behaviors.map((b) => b.name));
    for (const [name] of domainBehaviors) {
      if (!contractBehaviorNames.has(name)) {
        warnings.push({
          type: 'extra_behavior',
          behavior: name,
          message: `Domain behavior '${name}' not covered by contract`,
        });
      }
    }

    const valid = errors.length === 0 && results.every((r) => r.valid);

    return {
      valid,
      contract,
      domain: domain.name.name,
      results,
      errors,
      warnings,
    };
  }

  /**
   * Verify a single behavior
   */
  private verifyBehavior(
    contractBehavior: ContractBehavior,
    domainBehavior: DomainDeclaration['behaviors'][0],
    domain: DomainDeclaration
  ): BehaviorVerificationResult {
    // Verify input
    const inputResult = this.verifyFields(
      contractBehavior.input ?? {},
      domainBehavior.input?.fields ?? [],
      domain
    );

    // Verify output
    const outputResult = this.verifyOutputFields(
      contractBehavior.output ?? {},
      domainBehavior.output,
      domain
    );

    // Verify preconditions
    const preconditionsResult = this.options.checkPreconditions
      ? this.verifyConditions(
          contractBehavior.preconditions ?? [],
          domainBehavior.preconditions?.conditions ?? []
        )
      : { valid: true, missing: [], extra: [] };

    // Verify postconditions
    const postconditionsResult = this.options.checkPostconditions
      ? this.verifyConditions(
          contractBehavior.postconditions ?? [],
          domainBehavior.postconditions?.conditions ?? []
        )
      : { valid: true, missing: [], extra: [] };

    return {
      behavior: contractBehavior.name,
      valid:
        inputResult.valid &&
        outputResult.valid &&
        preconditionsResult.valid &&
        postconditionsResult.valid,
      input: inputResult,
      output: outputResult,
      preconditions: preconditionsResult,
      postconditions: postconditionsResult,
    };
  }

  /**
   * Verify input/output fields
   */
  private verifyFields(
    contractFields: Record<string, unknown>,
    domainFields: Array<{ name: { name: string }; type: unknown; optional?: boolean }>,
    domain: DomainDeclaration
  ): FieldVerificationResult {
    const missingFields: string[] = [];
    const extraFields: string[] = [];
    const typeMismatches: TypeMismatch[] = [];

    const domainFieldMap = new Map<string, typeof domainFields[0]>();
    for (const field of domainFields) {
      domainFieldMap.set(field.name.name, field);
    }

    // Check for missing required fields
    for (const [fieldName, field] of domainFieldMap) {
      if (!field.optional && !(fieldName in contractFields)) {
        missingFields.push(fieldName);
      }
    }

    // Check contract fields
    for (const [fieldName, value] of Object.entries(contractFields)) {
      const domainField = domainFieldMap.get(fieldName);

      if (!domainField) {
        extraFields.push(fieldName);
        continue;
      }

      // Type check if enabled
      if (this.options.checkTypes) {
        const expectedType = this.extractTypeName(domainField.type);
        const actualType = this.inferType(value);

        if (!this.typesCompatible(expectedType, actualType)) {
          typeMismatches.push({
            field: fieldName,
            expected: expectedType,
            actual: actualType,
          });
        }
      }
    }

    const valid =
      missingFields.length === 0 &&
      typeMismatches.length === 0 &&
      (this.options.allowExtraFields || extraFields.length === 0);

    return { valid, missingFields, extraFields, typeMismatches };
  }

  /**
   * Verify output fields
   */
  private verifyOutputFields(
    contractOutput: Record<string, unknown>,
    domainOutput: DomainDeclaration['behaviors'][0]['output'],
    domain: DomainDeclaration
  ): FieldVerificationResult {
    if (!domainOutput) {
      return {
        valid: Object.keys(contractOutput).length === 0,
        missingFields: [],
        extraFields: Object.keys(contractOutput),
        typeMismatches: [],
      };
    }

    // Output type is typically a single type reference
    const outputTypeName = this.extractTypeName(domainOutput.success);
    
    // Find the entity/type definition
    const entity = domain.entities.find((e) => e.name.name === outputTypeName);
    
    if (entity) {
      return this.verifyFields(contractOutput, entity.fields, domain);
    }

    // If no entity found, assume output matches
    return {
      valid: true,
      missingFields: [],
      extraFields: [],
      typeMismatches: [],
    };
  }

  /**
   * Verify conditions
   */
  private verifyConditions(
    contractConditions: string[],
    domainConditions: unknown[]
  ): ConditionVerificationResult {
    // Simplified condition matching
    // In a full implementation, this would parse and compare condition expressions
    return {
      valid: true,
      missing: [],
      extra: [],
    };
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
   * Infer type from JavaScript value
   */
  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    if (Array.isArray(value)) return 'List';

    switch (typeof value) {
      case 'string':
        // Check for specific string formats
        if (this.isUUID(value)) return 'UUID';
        if (this.isISO8601(value)) return 'Timestamp';
        return 'String';
      case 'number':
        return Number.isInteger(value) ? 'Int' : 'Decimal';
      case 'boolean':
        return 'Boolean';
      case 'object':
        return 'Object';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if types are compatible
   */
  private typesCompatible(expected: string, actual: string): boolean {
    if (expected === actual) return true;

    // String subtypes
    if (expected === 'String' && ['UUID', 'Email'].includes(actual)) return true;
    
    // Number compatibility
    if (expected === 'Decimal' && actual === 'Int') return true;
    
    // Any type
    if (expected === 'unknown') return true;

    return false;
  }

  /**
   * Check if string is UUID format
   */
  private isUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Check if string is ISO 8601 date format
   */
  private isISO8601(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}

/**
 * Verify a contract against ISL source
 */
export function verifyContract(
  contract: Contract,
  islSource: string,
  options?: VerificationOptions
): VerificationResult {
  const verifier = new ContractVerifier(options);
  return verifier.verify(contract, islSource);
}

/**
 * Verify provider implementation against contracts
 */
export function verifyProvider(
  contracts: Contract[],
  islSource: string,
  options?: VerificationOptions
): VerificationResult[] {
  const verifier = new ContractVerifier(options);
  return contracts.map((contract) => verifier.verify(contract, islSource));
}
