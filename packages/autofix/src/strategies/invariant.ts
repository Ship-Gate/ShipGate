/**
 * Invariant Fix Strategy
 * 
 * Fixes state mutations that violate invariants.
 */

import type { AnalysisResult, CodeSegment } from '../analyzer.js';
import type { Patch, PatchContext } from '../patcher.js';

export interface InvariantFix {
  type: 'add_guard' | 'clamp_value' | 'add_validation' | 'reorder_operations';
  field: string;
  constraint: InvariantConstraint;
}

export interface InvariantConstraint {
  type: 'min' | 'max' | 'range' | 'unique' | 'non_null' | 'positive';
  value?: number;
  min?: number;
  max?: number;
}

/**
 * Generate patches to fix invariant violations
 */
export function generateInvariantPatches(
  analysis: AnalysisResult,
  context: PatchContext
): Patch[] {
  const patches: Patch[] = [];
  const { failure, relatedCode } = analysis;

  // Parse the invariant predicate
  const fix = parseInvariantPredicate(failure.predicate);
  
  if (!fix) {
    return patches;
  }

  // Find mutations that need to be guarded
  const mutations = findMutations(fix.field, relatedCode, context.implementation);

  for (const mutation of mutations) {
    const patchSet = generateGuardPatches(fix, mutation, context, analysis.confidence);
    patches.push(...patchSet);
  }

  return patches;
}

/**
 * Parse invariant predicate to determine the fix needed
 */
function parseInvariantPredicate(predicate: string): InvariantFix | null {
  // Pattern: field >= 0 (non-negative constraint)
  const nonNegativeMatch = predicate.match(/(\w+(?:\.\w+)*)\s*>=\s*0/);
  if (nonNegativeMatch) {
    return {
      type: 'add_guard',
      field: nonNegativeMatch[1]!,
      constraint: { type: 'min', value: 0 },
    };
  }

  // Pattern: field > 0 (positive constraint)
  const positiveMatch = predicate.match(/(\w+(?:\.\w+)*)\s*>\s*0/);
  if (positiveMatch) {
    return {
      type: 'add_guard',
      field: positiveMatch[1]!,
      constraint: { type: 'positive' },
    };
  }

  // Pattern: field <= MAX
  const maxMatch = predicate.match(/(\w+(?:\.\w+)*)\s*<=\s*(\d+)/);
  if (maxMatch) {
    return {
      type: 'clamp_value',
      field: maxMatch[1]!,
      constraint: { type: 'max', value: parseInt(maxMatch[2]!, 10) },
    };
  }

  // Pattern: field >= MIN
  const minMatch = predicate.match(/(\w+(?:\.\w+)*)\s*>=\s*(\d+)/);
  if (minMatch) {
    return {
      type: 'clamp_value',
      field: minMatch[1]!,
      constraint: { type: 'min', value: parseInt(minMatch[2]!, 10) },
    };
  }

  // Pattern: MIN <= field <= MAX or field in range
  const rangeMatch = predicate.match(/(\d+)\s*<=\s*(\w+(?:\.\w+)*)\s*<=\s*(\d+)/);
  if (rangeMatch) {
    return {
      type: 'clamp_value',
      field: rangeMatch[2]!,
      constraint: {
        type: 'range',
        min: parseInt(rangeMatch[1]!, 10),
        max: parseInt(rangeMatch[3]!, 10),
      },
    };
  }

  // Pattern: field != null or field is not null
  const nonNullMatch = predicate.match(/(\w+(?:\.\w+)*)\s*(!?=|is\s+not)\s*null/i);
  if (nonNullMatch) {
    return {
      type: 'add_validation',
      field: nonNullMatch[1]!,
      constraint: { type: 'non_null' },
    };
  }

  // Pattern: unique(field) or field is unique
  const uniqueMatch = predicate.match(/unique\((\w+(?:\.\w+)*)\)|(\w+(?:\.\w+)*)\s+is\s+unique/i);
  if (uniqueMatch) {
    return {
      type: 'add_validation',
      field: uniqueMatch[1] ?? uniqueMatch[2]!,
      constraint: { type: 'unique' },
    };
  }

  return null;
}

/**
 * Find code segments that mutate the field
 */
function findMutations(
  field: string,
  _relatedCode: CodeSegment[],
  implementation: string
): Array<{ line: number; code: string; type: 'assignment' | 'increment' | 'decrement' }> {
  const mutations: Array<{ line: number; code: string; type: 'assignment' | 'increment' | 'decrement' }> = [];
  const lines = implementation.split('\n');
  const fieldName = field.split('.').pop() ?? field;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Check for direct assignment
    const assignMatch = line.match(new RegExp(`${fieldName}\\s*=\\s*[^=]`));
    if (assignMatch) {
      mutations.push({ line: i, code: line, type: 'assignment' });
      continue;
    }

    // Check for increment
    if (line.includes(`${fieldName}++`) || line.includes(`${fieldName} +=`) || line.includes(`++${fieldName}`)) {
      mutations.push({ line: i, code: line, type: 'increment' });
      continue;
    }

    // Check for decrement
    if (line.includes(`${fieldName}--`) || line.includes(`${fieldName} -=`) || line.includes(`--${fieldName}`)) {
      mutations.push({ line: i, code: line, type: 'decrement' });
      continue;
    }

    // Check for object spread or create with field
    const objectMatch = line.match(new RegExp(`{[^}]*${fieldName}\\s*:`));
    if (objectMatch) {
      mutations.push({ line: i, code: line, type: 'assignment' });
    }
  }

  return mutations;
}

/**
 * Generate guard patches for a mutation
 */
function generateGuardPatches(
  fix: InvariantFix,
  mutation: { line: number; code: string; type: 'assignment' | 'increment' | 'decrement' },
  context: PatchContext,
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const indent = context.indentation ?? '  ';

  switch (fix.type) {
    case 'add_guard': {
      // Add validation before the mutation
      const guard = generateGuardCode(fix.field, fix.constraint, indent, context);
      patches.push({
        type: 'insert',
        file: 'implementation',
        line: mutation.line + 1,
        column: 0,
        content: guard,
        description: `Add guard to ensure ${fix.field} satisfies invariant`,
        confidence,
      });
      break;
    }

    case 'clamp_value': {
      // Wrap the mutation with clamping
      const clamp = generateClampCode(fix.field, fix.constraint, mutation, indent);
      if (clamp) {
        patches.push({
          type: 'replace',
          file: 'implementation',
          line: mutation.line + 1,
          original: mutation.code.trim(),
          replacement: clamp,
          description: `Clamp ${fix.field} to valid range`,
          confidence: confidence * 0.9,
        });
      }
      break;
    }

    case 'add_validation': {
      // Add validation check
      const validation = generateValidationCode(fix.field, fix.constraint, indent, context);
      patches.push({
        type: 'insert',
        file: 'implementation',
        line: mutation.line + 1,
        column: 0,
        content: validation,
        description: `Add validation for ${fix.field}`,
        confidence: confidence * 0.85,
      });
      break;
    }
  }

  return patches;
}

/**
 * Generate guard code for a constraint
 */
function generateGuardCode(
  field: string,
  constraint: InvariantConstraint,
  indent: string,
  context: PatchContext
): string {
  const errorCode = context.useCustomErrors
    ? `throw new InvariantViolationError({ field: '${field}', constraint: '${constraint.type}' });`
    : `throw new Error('Invariant violation: ${field} must satisfy ${constraint.type} constraint');`;

  switch (constraint.type) {
    case 'min':
      return `${indent}// Guard: ${field} >= ${constraint.value}
${indent}if (${field} < ${constraint.value}) {
${indent}${indent}${errorCode}
${indent}}
`;
    case 'max':
      return `${indent}// Guard: ${field} <= ${constraint.value}
${indent}if (${field} > ${constraint.value}) {
${indent}${indent}${errorCode}
${indent}}
`;
    case 'positive':
      return `${indent}// Guard: ${field} > 0
${indent}if (${field} <= 0) {
${indent}${indent}${errorCode}
${indent}}
`;
    case 'range':
      return `${indent}// Guard: ${constraint.min} <= ${field} <= ${constraint.max}
${indent}if (${field} < ${constraint.min} || ${field} > ${constraint.max}) {
${indent}${indent}${errorCode}
${indent}}
`;
    default:
      return '';
  }
}

/**
 * Generate clamping code for a constraint
 */
function generateClampCode(
  field: string,
  constraint: InvariantConstraint,
  _mutation: { line: number; code: string; type: string },
  indent: string
): string | null {
  const fieldName = field.split('.').pop() ?? field;

  switch (constraint.type) {
    case 'min':
      return `${indent}${fieldName} = Math.max(${constraint.value}, ${fieldName});`;
    case 'max':
      return `${indent}${fieldName} = Math.min(${constraint.value}, ${fieldName});`;
    case 'range':
      return `${indent}${fieldName} = Math.max(${constraint.min}, Math.min(${constraint.max}, ${fieldName}));`;
    default:
      return null;
  }
}

/**
 * Generate validation code for a constraint
 */
function generateValidationCode(
  field: string,
  constraint: InvariantConstraint,
  indent: string,
  context: PatchContext
): string {
  const errorCode = context.useCustomErrors
    ? `throw new InvariantViolationError({ field: '${field}', constraint: '${constraint.type}' });`
    : `throw new Error('Invariant violation: ${field} validation failed');`;

  switch (constraint.type) {
    case 'non_null':
      return `${indent}// Validation: ${field} must not be null
${indent}if (${field} == null) {
${indent}${indent}${errorCode}
${indent}}
`;
    case 'unique':
      return `${indent}// Validation: ${field} must be unique
${indent}// Note: Implement uniqueness check based on your data layer
${indent}const isUnique = await checkUnique('${field}', ${field});
${indent}if (!isUnique) {
${indent}${indent}${errorCode}
${indent}}
`;
    default:
      return '';
  }
}

/**
 * Generate a defensive wrapper for state mutations
 */
export function generateDefensiveMutation(
  field: string,
  operation: string,
  constraint: InvariantConstraint
): string {
  const fieldName = field.split('.').pop() ?? field;

  switch (constraint.type) {
    case 'min':
      return `${fieldName} = Math.max(${constraint.value}, ${operation});`;
    case 'max':
      return `${fieldName} = Math.min(${constraint.value}, ${operation});`;
    case 'range':
      return `${fieldName} = Math.max(${constraint.min}, Math.min(${constraint.max}, ${operation}));`;
    case 'positive':
      return `${fieldName} = Math.max(1, ${operation});`;
    default:
      return `${fieldName} = ${operation};`;
  }
}
