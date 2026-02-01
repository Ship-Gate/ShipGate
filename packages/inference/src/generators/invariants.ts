/**
 * Invariant Inference
 *
 * Infer global invariants from code patterns.
 */

import type { ExtractedType, ExtractedFunction } from '../analyzer.js';

/**
 * Infer global invariants from types and functions
 */
export function inferInvariants(
  types: ExtractedType[],
  functions: ExtractedFunction[]
): string[] {
  const invariants: string[] = [];

  // Security invariants
  const securityInvariants = inferSecurityInvariants(types, functions);
  invariants.push(...securityInvariants);

  // Data integrity invariants
  const integrityInvariants = inferIntegrityInvariants(types);
  invariants.push(...integrityInvariants);

  // Consistency invariants
  const consistencyInvariants = inferConsistencyInvariants(types);
  invariants.push(...consistencyInvariants);

  return [...new Set(invariants)]; // Remove duplicates
}

/**
 * Infer security-related invariants
 */
function inferSecurityInvariants(
  types: ExtractedType[],
  functions: ExtractedFunction[]
): string[] {
  const invariants: string[] = [];

  // Check for password fields
  const hasPasswordFields = types.some((t) =>
    t.fields.some(
      (f) =>
        f.name.includes('password') ||
        f.name.includes('secret') ||
        f.annotations.includes('secret')
    )
  );

  if (hasPasswordFields) {
    invariants.push('passwords never stored in plaintext');
    invariants.push('passwords never appear in logs');
  }

  // Check for session/token handling
  const hasSessionHandling = types.some(
    (t) =>
      t.name.toLowerCase().includes('session') ||
      t.fields.some((f) => f.name.includes('token'))
  );

  if (hasSessionHandling) {
    invariants.push('session tokens cryptographically secure');
  }

  // Check for authentication functions
  const hasAuthFunctions = functions.some(
    (f) =>
      f.name.toLowerCase().includes('login') ||
      f.name.toLowerCase().includes('authenticate')
  );

  if (hasAuthFunctions) {
    invariants.push('all auth events logged');
  }

  // Check for sensitive data
  const hasSensitiveParams = functions.some((f) =>
    f.parameters.some(
      (p) =>
        p.name.includes('password') ||
        p.name.includes('secret') ||
        p.name.includes('token')
    )
  );

  if (hasSensitiveParams) {
    invariants.push('sensitive data never logged');
  }

  return invariants;
}

/**
 * Infer data integrity invariants
 */
function inferIntegrityInvariants(types: ExtractedType[]): string[] {
  const invariants: string[] = [];

  for (const type of types) {
    if (type.isEnum) continue;

    // Check for unique fields
    const uniqueFields = type.fields.filter((f) =>
      f.annotations.includes('unique')
    );

    for (const field of uniqueFields) {
      invariants.push(
        `${type.name}.${field.name} is unique across all ${type.name} instances`
      );
    }

    // Check for foreign key relationships
    const fkFields = type.fields.filter(
      (f) => f.name.endsWith('_id') && f.name !== 'id'
    );

    for (const field of fkFields) {
      const referencedEntity = toPascalCase(field.name.replace(/_id$/, ''));
      invariants.push(
        `${type.name}.${field.name} references valid ${referencedEntity}`
      );
    }
  }

  return invariants;
}

/**
 * Infer consistency invariants
 */
function inferConsistencyInvariants(types: ExtractedType[]): string[] {
  const invariants: string[] = [];

  for (const type of types) {
    if (type.isEnum) continue;

    // Check for timestamp pairs
    const hasCreatedAt = type.fields.some(
      (f) => f.name === 'created_at' || f.name === 'createdAt'
    );
    const hasUpdatedAt = type.fields.some(
      (f) => f.name === 'updated_at' || f.name === 'updatedAt'
    );

    if (hasCreatedAt && hasUpdatedAt) {
      invariants.push(
        `${type.name}.updated_at >= ${type.name}.created_at`
      );
    }

    // Check for start/end time pairs
    const hasStartAt = type.fields.some(
      (f) => f.name.includes('start') && f.type === 'Timestamp'
    );
    const hasEndAt = type.fields.some(
      (f) => f.name.includes('end') && f.type === 'Timestamp'
    );

    if (hasStartAt && hasEndAt) {
      invariants.push(
        `${type.name}.end_at >= ${type.name}.start_at when both set`
      );
    }

    // Check for quantity/amount fields
    const amountFields = type.fields.filter(
      (f) =>
        f.name.includes('amount') ||
        f.name.includes('quantity') ||
        f.name.includes('count') ||
        f.name.includes('balance')
    );

    for (const field of amountFields) {
      if (!invariants.some((i) => i.includes(field.name))) {
        invariants.push(`${type.name}.${field.name} >= 0`);
      }
    }

    // Check for percentage/rate fields
    const percentageFields = type.fields.filter(
      (f) =>
        f.name.includes('percentage') ||
        f.name.includes('rate') ||
        f.name.includes('percent')
    );

    for (const field of percentageFields) {
      invariants.push(`${type.name}.${field.name} >= 0`);
      invariants.push(`${type.name}.${field.name} <= 100`);
    }
  }

  return invariants;
}

/**
 * Infer temporal invariants from function patterns
 */
export function inferTemporalInvariants(functions: ExtractedFunction[]): string[] {
  const invariants: string[] = [];

  for (const func of functions) {
    // Check for async operations that should have timeouts
    if (func.async) {
      const hasExternalCall = func.sideEffects.some(
        (e) => e.type === 'external'
      );

      if (hasExternalCall) {
        invariants.push(
          `${func.name} completes within reasonable timeout`
        );
      }
    }

    // Check for operations that should be idempotent
    const isCreateOrUpdate =
      func.name.toLowerCase().includes('create') ||
      func.name.toLowerCase().includes('update');

    if (isCreateOrUpdate && func.sideEffects.length > 0) {
      invariants.push(
        `${func.name} is idempotent with same inputs`
      );
    }
  }

  return invariants;
}

/**
 * Infer rate limiting invariants
 */
export function inferRateLimitInvariants(functions: ExtractedFunction[]): string[] {
  const invariants: string[] = [];

  for (const func of functions) {
    // Auth functions should have rate limits
    if (
      func.name.toLowerCase().includes('login') ||
      func.name.toLowerCase().includes('authenticate')
    ) {
      invariants.push(`${func.name} rate limited per IP`);
      invariants.push(`${func.name} rate limited per user`);
    }

    // Registration functions should have rate limits
    if (
      func.name.toLowerCase().includes('register') ||
      func.name.toLowerCase().includes('signup')
    ) {
      invariants.push(`${func.name} rate limited per IP`);
    }

    // Password reset should have rate limits
    if (
      func.name.toLowerCase().includes('reset') &&
      func.name.toLowerCase().includes('password')
    ) {
      invariants.push(`${func.name} rate limited per IP`);
      invariants.push(`${func.name} rate limited per email`);
    }
  }

  return invariants;
}

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
