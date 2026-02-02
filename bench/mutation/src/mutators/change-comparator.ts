/**
 * Change Comparator Mutator
 * 
 * Weakens boundary conditions by changing strict comparators:
 * - > to >=
 * - < to <=
 * - === to ==
 * - !== to !=
 * 
 * This mutation should cause boundary-related failures when
 * edge cases are tested.
 */

import type { Mutator, MutatorContext, MutationResult } from '../types.js';

/**
 * Comparator transformation rules
 */
const COMPARATOR_TRANSFORMS: Array<{
  from: RegExp;
  to: string;
  description: string;
}> = [
  { from: /([^=!<>])>([^=])/, to: '$1>=$2', description: '> to >=' },
  { from: /([^=!<>])<([^=])/, to: '$1<=$2', description: '< to <=' },
  { from: /===/, to: '==', description: '=== to ==' },
  { from: /!==/, to: '!=', description: '!== to !=' },
  // Reverse transforms for other mutations
  { from: />=/, to: '>', description: '>= to >' },
  { from: /<=/, to: '<', description: '<= to <' },
];

/**
 * Find which comparator transform applies to a line
 */
function findApplicableTransform(
  line: string,
  preferredDirection?: 'weaken' | 'strengthen'
): typeof COMPARATOR_TRANSFORMS[number] | null {
  // Default to weakening comparators (> to >=)
  const weakenTransforms = COMPARATOR_TRANSFORMS.slice(0, 4);
  const strengthenTransforms = COMPARATOR_TRANSFORMS.slice(4);
  
  const transforms = preferredDirection === 'strengthen'
    ? strengthenTransforms
    : weakenTransforms;
    
  for (const transform of transforms) {
    if (transform.from.test(line)) {
      return transform;
    }
  }
  
  return null;
}

/**
 * Change Comparator Mutator Implementation
 */
export const changeComparatorMutator: Mutator = {
  type: 'change-comparator',

  canApply(ctx: MutatorContext): boolean {
    const lines = ctx.source.split('\n');
    const targetLine = lines[ctx.target.line - 1];
    
    if (!targetLine) return false;
    
    // Check if the pattern matches
    if (ctx.target.pattern) {
      const pattern = typeof ctx.target.pattern === 'string'
        ? new RegExp(ctx.target.pattern)
        : ctx.target.pattern;
      if (!pattern.test(targetLine)) return false;
    }
    
    // Check if any comparator transform applies
    return findApplicableTransform(targetLine) !== null;
  },

  apply(ctx: MutatorContext): MutationResult {
    const lines = ctx.source.split('\n');
    const lineIndex = ctx.target.line - 1;
    const originalLine = lines[lineIndex];
    
    if (!originalLine) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'Target line not found',
        affectedLines: [],
      };
    }

    const transform = findApplicableTransform(originalLine);
    
    if (!transform) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'No comparator found at target line',
        affectedLines: [],
      };
    }

    // Apply the transformation
    const mutatedLine = originalLine.replace(transform.from, transform.to);
    
    // Ensure something actually changed
    if (mutatedLine === originalLine) {
      return {
        applied: false,
        mutatedSource: ctx.source,
        changeDescription: 'Comparator transform had no effect',
        affectedLines: [],
      };
    }

    // Build mutated source
    const mutatedLines = [...lines];
    mutatedLines[lineIndex] = mutatedLine;

    return {
      applied: true,
      mutatedSource: mutatedLines.join('\n'),
      changeDescription: `Changed comparator at line ${ctx.target.line}: ${transform.description}`,
      affectedLines: [ctx.target.line],
    };
  },
};

export default changeComparatorMutator;
