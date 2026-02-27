// ============================================================================
// Call Command
// Execute behavior calls
// ============================================================================

import type { Domain, CommandResult, Behavior, BehaviorResult } from '../types.js';
import { formatValue } from '../formatter.js';

/**
 * Call a behavior with arguments
 */
export async function callBehavior(
  behaviorName: string,
  args: Record<string, unknown>,
  domain: Domain,
  state: Map<string, unknown>
): Promise<BehaviorResult> {
  // Find behavior
  const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
  if (!behavior) {
    return {
      success: false,
      error: `Unknown behavior: ${behaviorName}`,
    };
  }

  // Validate input
  const validation = validateInput(behavior, args);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      details: validation.details,
    };
  }

  // Check preconditions
  const preconditionCheck = checkPreconditions(behavior, args, state);
  if (!preconditionCheck.satisfied) {
    return {
      success: false,
      error: `Precondition failed: ${preconditionCheck.failed}`,
    };
  }

  // Execute behavior (simulation)
  const result = await executeBehavior(behavior, args, state, domain);

  // Record the call
  recordCall(behaviorName, args, result, state);

  return result;
}

/**
 * Validate input against behavior specification
 */
function validateInput(
  behavior: Behavior,
  args: Record<string, unknown>
): { valid: boolean; error?: string; details?: Record<string, unknown> } {
  const errors: string[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of behavior.input.fields) {
    const value = args[field.name.name];

    // Check required fields
    if (value === undefined && !field.optional) {
      missing.push(field.name.name);
      continue;
    }

    // Skip validation for undefined optional fields
    if (value === undefined) continue;

    // Type validation (basic)
    const typeError = validateType(value, field.type);
    if (typeError) {
      invalid.push(`${field.name.name}: ${typeError}`);
    }
  }

  // Check for unknown fields
  const knownFields = new Set(behavior.input.fields.map(f => f.name.name));
  const unknown = Object.keys(args).filter(k => !knownFields.has(k));
  if (unknown.length > 0) {
    errors.push(`Unknown fields: ${unknown.join(', ')}`);
  }

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
  }

  if (invalid.length > 0) {
    errors.push(`Invalid values: ${invalid.join('; ')}`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('\n'),
      details: { missing, invalid, unknown },
    };
  }

  return { valid: true };
}

/**
 * Basic type validation
 */
function validateType(value: unknown, type: Behavior['input']['fields'][0]['type']): string | null {
  switch (type.kind) {
    case 'PrimitiveType':
      return validatePrimitive(value, type.name);
    
    case 'ReferenceType':
      // References should be objects with an id
      if (typeof value !== 'object' || value === null) {
        return `expected ${type.name.name} reference`;
      }
      return null;
    
    case 'ListType':
      if (!Array.isArray(value)) {
        return 'expected array';
      }
      return null;
    
    case 'OptionalType':
      if (value === null || value === undefined) return null;
      return validateType(value, type.inner);
    
    default:
      return null;
  }
}

/**
 * Validate primitive types
 */
function validatePrimitive(value: unknown, typeName: string): string | null {
  switch (typeName) {
    case 'String':
      if (typeof value !== 'string') return 'expected string';
      break;
    case 'Int':
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'expected integer';
      break;
    case 'Decimal':
      if (typeof value !== 'number') return 'expected number';
      break;
    case 'Boolean':
      if (typeof value !== 'boolean') return 'expected boolean';
      break;
    case 'UUID':
      if (typeof value !== 'string' || !isValidUUID(value)) return 'expected UUID';
      break;
    case 'Timestamp':
      if (!(value instanceof Date) && typeof value !== 'string') return 'expected timestamp';
      break;
  }
  return null;
}

/**
 * Check if string is valid UUID
 */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Check preconditions
 */
function checkPreconditions(
  behavior: Behavior,
  _args: Record<string, unknown>,
  _state: Map<string, unknown>
): { satisfied: boolean; failed?: string } {
  // In a real implementation, this would evaluate each precondition
  // For now, assume all pass
  for (const _pre of behavior.preconditions) {
    // Evaluate precondition
    // const result = evaluateExpression(pre, { args, state });
    // if (!result) return { satisfied: false, failed: formatExpression(pre) };
  }

  return { satisfied: true };
}

/**
 * Execute behavior (simulation)
 */
async function executeBehavior(
  behavior: Behavior,
  args: Record<string, unknown>,
  state: Map<string, unknown>,
  domain: Domain
): Promise<BehaviorResult> {
  // Simulate execution
  // In a real implementation, this would call actual implementations

  // Apply side effects
  for (const effect of behavior.sideEffects) {
    applySideEffect(effect, args, state, domain);
  }

  // Generate mock output
  const output = generateOutput(behavior);

  return {
    success: true,
    data: output,
  };
}

/**
 * Apply side effect to state
 */
function applySideEffect(
  effect: Behavior['sideEffects'][0],
  args: Record<string, unknown>,
  state: Map<string, unknown>,
  _domain: Domain
): void {
  const entityName = effect.entity.name;
  const entities = (state.get(entityName) as unknown[]) ?? [];

  switch (effect.action) {
    case 'creates':
      // Create new entity instance
      const newEntity = {
        id: generateId(),
        ...args,
        createdAt: new Date().toISOString(),
      };
      entities.push(newEntity);
      state.set(entityName, entities);
      break;

    case 'updates':
      // Update would require identifying which entity
      break;

    case 'deletes':
      // Delete would require identifying which entity
      break;
  }
}

/**
 * Generate output based on behavior specification
 */
function generateOutput(behavior: Behavior): unknown {
  const type = behavior.output.success;

  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'result';
        case 'Int': return 1;
        case 'Decimal': return 1.0;
        case 'Boolean': return true;
        case 'UUID': return generateId();
        case 'Timestamp': return new Date().toISOString();
        default: return null;
      }

    case 'ReferenceType':
      return { id: generateId(), __type__: type.name.name };

    case 'StructType':
      const obj: Record<string, unknown> = {};
      for (const field of type.fields) {
        obj[field.name.name] = null;
      }
      return obj;

    default:
      return null;
  }
}

/**
 * Record call in state
 */
function recordCall(
  behaviorName: string,
  args: Record<string, unknown>,
  result: BehaviorResult,
  state: Map<string, unknown>
): void {
  const calls = (state.get('__calls__') as unknown[]) ?? [];
  calls.push({
    behavior: behaviorName,
    args,
    result: result.success ? result.data : result.error,
    success: result.success,
    timestamp: new Date().toISOString(),
  });
  state.set('__calls__', calls);
}

/**
 * Generate a mock UUID
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get call history
 */
export function getCallHistory(state: Map<string, unknown>): unknown[] {
  return (state.get('__calls__') as unknown[]) ?? [];
}

/**
 * Clear call history
 */
export function clearCallHistory(state: Map<string, unknown>): void {
  state.delete('__calls__');
}
