/**
 * Mutator Registry
 * 
 * Central registry for all mutation types.
 */

import type { Mutator, MutationType } from '../types.js';
import { removeAssertMutator } from './remove-assert.js';
import { changeComparatorMutator } from './change-comparator.js';
import { deleteExpectationMutator } from './delete-expectation.js';
import { bypassPreconditionMutator } from './bypass-precondition.js';

// Re-export individual mutators
export { removeAssertMutator } from './remove-assert.js';
export { changeComparatorMutator } from './change-comparator.js';
export { deleteExpectationMutator } from './delete-expectation.js';
export { bypassPreconditionMutator } from './bypass-precondition.js';

/**
 * Registry of all available mutators
 */
export const mutatorRegistry: Map<MutationType, Mutator> = new Map([
  ['remove-assert', removeAssertMutator],
  ['change-comparator', changeComparatorMutator],
  ['delete-expectation', deleteExpectationMutator],
  ['bypass-precondition', bypassPreconditionMutator],
]);

/**
 * Get a mutator by type
 */
export function getMutator(type: MutationType): Mutator | undefined {
  return mutatorRegistry.get(type);
}

/**
 * Get all available mutation types
 */
export function getMutationTypes(): MutationType[] {
  return Array.from(mutatorRegistry.keys());
}

/**
 * Check if a mutation type is valid
 */
export function isValidMutationType(type: string): type is MutationType {
  return mutatorRegistry.has(type as MutationType);
}

/**
 * Apply a mutation to source code
 */
export function applyMutation(
  type: MutationType,
  source: string,
  filePath: string,
  target: { line: number; pattern?: string | RegExp }
): { applied: boolean; source: string; description: string } {
  const mutator = getMutator(type);
  
  if (!mutator) {
    return {
      applied: false,
      source,
      description: `Unknown mutation type: ${type}`,
    };
  }

  const result = mutator.apply({
    source,
    filePath,
    target: { file: filePath, line: target.line, pattern: target.pattern },
  });

  return {
    applied: result.applied,
    source: result.mutatedSource,
    description: result.changeDescription,
  };
}
