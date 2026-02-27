/**
 * Comparison Mutation Operators
 * 
 * Mutates comparison operators: ==, !=, <, >, <=, >=
 */

import { MutationOperator, MutantCandidate } from '../types';

/** Comparison operator replacements */
const COMPARISON_REPLACEMENTS: Record<string, string[]> = {
  '==': ['!=', '<', '>', '<=', '>='],
  '!=': ['==', '<', '>', '<=', '>='],
  '<': ['<=', '>', '>=', '==', '!='],
  '>': ['>=', '<', '<=', '==', '!='],
  '<=': ['<', '>', '>=', '==', '!='],
  '>=': ['>', '<', '<=', '==', '!='],
};

/**
 * Comparison operator mutation
 */
export const comparisonOperator: MutationOperator = {
  name: 'ComparisonOperator',
  type: 'comparison',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'BinaryExpression' &&
      typeof node.operator === 'string' &&
      node.operator in COMPARISON_REPLACEMENTS
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const original = node.operator;
    const replacements = COMPARISON_REPLACEMENTS[original] || [];

    return replacements.map((replacement) => ({
      type: 'comparison',
      original,
      mutated: replacement,
      description: `Replace '${original}' with '${replacement}'`,
      location: {},
    }));
  },
};

/**
 * ISL status comparison mutation
 * Mutates entity status comparisons
 */
export const statusComparisonOperator: MutationOperator = {
  name: 'StatusComparisonOperator',
  type: 'comparison',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'StatusComparison' &&
      typeof node.expected === 'string'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.expected !== 'string') {
      return [];
    }

    const candidates: MutantCandidate[] = [];
    const expected = node.expected;
    const availableStatuses = node.availableStatuses as string[] || [];

    // Replace with other statuses
    for (const status of availableStatuses) {
      if (status !== expected) {
        candidates.push({
          type: 'comparison',
          original: `status == ${expected}`,
          mutated: `status == ${status}`,
          description: `Replace status ${expected} with ${status}`,
          location: {},
        });
      }
    }

    // Negate comparison
    candidates.push({
      type: 'comparison',
      original: `status == ${expected}`,
      mutated: `status != ${expected}`,
      description: `Negate status comparison`,
      location: {},
    });

    return candidates;
  },
};

/**
 * ISL postcondition comparison mutation
 */
export const postconditionComparisonOperator: MutationOperator = {
  name: 'PostconditionComparisonOperator',
  type: 'comparison',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'Postcondition' &&
      hasComparison(node)
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];
    const comparison = node.comparison as Record<string, unknown>;

    if (comparison && typeof comparison.operator === 'string') {
      const original = comparison.operator;
      const replacements = COMPARISON_REPLACEMENTS[original] || [];

      for (const replacement of replacements) {
        candidates.push({
          type: 'comparison',
          original: `postcondition: ${original}`,
          mutated: `postcondition: ${replacement}`,
          description: `Change postcondition operator from '${original}' to '${replacement}'`,
          location: {},
        });
      }
    }

    return candidates;
  },
};

/**
 * ISL invariant comparison mutation
 */
export const invariantComparisonOperator: MutationOperator = {
  name: 'InvariantComparisonOperator',
  type: 'comparison',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'Invariant' &&
      typeof node.operator === 'string' &&
      node.operator in COMPARISON_REPLACEMENTS
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const original = node.operator;
    const replacements = COMPARISON_REPLACEMENTS[original] || [];

    return replacements.map((replacement) => ({
      type: 'comparison',
      original: `invariant: ${original}`,
      mutated: `invariant: ${replacement}`,
      description: `Change invariant operator from '${original}' to '${replacement}'`,
      location: {},
    }));
  },
};

/**
 * Equality to identity mutation
 * Changes == to === style checks
 */
export const equalityIdentityOperator: MutationOperator = {
  name: 'EqualityIdentityOperator',
  type: 'comparison',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'BinaryExpression' &&
      (node.operator === '==' || node.operator === '!=')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    // For ISL, swap between equality and assignment checks
    const candidates: MutantCandidate[] = [];

    if (node.operator === '==') {
      // Always true/false mutations
      candidates.push({
        type: 'comparison',
        original: '==',
        mutated: 'true',
        description: 'Replace equality check with always true',
        location: {},
      });
      candidates.push({
        type: 'comparison',
        original: '==',
        mutated: 'false',
        description: 'Replace equality check with always false',
        location: {},
      });
    }

    return candidates;
  },
};

/** All comparison operators */
export const comparisonOperators: MutationOperator[] = [
  comparisonOperator,
  statusComparisonOperator,
  postconditionComparisonOperator,
  invariantComparisonOperator,
  equalityIdentityOperator,
];

// Type guard helpers
function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function hasComparison(node: Record<string, unknown>): boolean {
  return 'comparison' in node && typeof node.comparison === 'object';
}
