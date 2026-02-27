/**
 * Boundary Mutation Operators
 * 
 * Mutates boundary values: min, max, length ±1
 */

import { MutationOperator, MutantCandidate } from '../types';

/**
 * Min/Max constraint boundary mutation
 */
export const boundaryConstraintOperator: MutationOperator = {
  name: 'BoundaryConstraintOperator',
  type: 'boundary',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'TypeConstraint' &&
      (hasProperty(node, 'min') || 
       hasProperty(node, 'max') ||
       hasProperty(node, 'min_length') ||
       hasProperty(node, 'max_length'))
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // min boundary mutations
    if (hasProperty(node, 'min') && typeof node.min === 'number') {
      const min = node.min;
      
      // Boundary - 1
      candidates.push({
        type: 'boundary',
        original: `min: ${min}`,
        mutated: `min: ${min - 1}`,
        description: `Decrease min boundary from ${min} to ${min - 1}`,
        location: {},
      });

      // Boundary + 1
      candidates.push({
        type: 'boundary',
        original: `min: ${min}`,
        mutated: `min: ${min + 1}`,
        description: `Increase min boundary from ${min} to ${min + 1}`,
        location: {},
      });

      // Remove constraint
      candidates.push({
        type: 'boundary',
        original: `min: ${min}`,
        mutated: '// min removed',
        description: 'Remove min constraint',
        location: {},
      });
    }

    // max boundary mutations
    if (hasProperty(node, 'max') && typeof node.max === 'number') {
      const max = node.max;
      
      candidates.push({
        type: 'boundary',
        original: `max: ${max}`,
        mutated: `max: ${max - 1}`,
        description: `Decrease max boundary from ${max} to ${max - 1}`,
        location: {},
      });

      candidates.push({
        type: 'boundary',
        original: `max: ${max}`,
        mutated: `max: ${max + 1}`,
        description: `Increase max boundary from ${max} to ${max + 1}`,
        location: {},
      });

      candidates.push({
        type: 'boundary',
        original: `max: ${max}`,
        mutated: '// max removed',
        description: 'Remove max constraint',
        location: {},
      });
    }

    // min_length boundary mutations
    if (hasProperty(node, 'min_length') && typeof node.min_length === 'number') {
      const minLength = node.min_length;
      
      candidates.push({
        type: 'boundary',
        original: `min_length: ${minLength}`,
        mutated: `min_length: ${minLength - 1}`,
        description: `Decrease min_length from ${minLength} to ${minLength - 1}`,
        location: {},
      });

      candidates.push({
        type: 'boundary',
        original: `min_length: ${minLength}`,
        mutated: `min_length: ${minLength + 1}`,
        description: `Increase min_length from ${minLength} to ${minLength + 1}`,
        location: {},
      });
    }

    // max_length boundary mutations
    if (hasProperty(node, 'max_length') && typeof node.max_length === 'number') {
      const maxLength = node.max_length;
      
      candidates.push({
        type: 'boundary',
        original: `max_length: ${maxLength}`,
        mutated: `max_length: ${maxLength - 1}`,
        description: `Decrease max_length from ${maxLength} to ${maxLength - 1}`,
        location: {},
      });

      candidates.push({
        type: 'boundary',
        original: `max_length: ${maxLength}`,
        mutated: `max_length: ${maxLength + 1}`,
        description: `Increase max_length from ${maxLength} to ${maxLength + 1}`,
        location: {},
      });
    }

    return candidates;
  },
};

/**
 * Array/List length boundary mutation
 */
export const lengthBoundaryOperator: MutationOperator = {
  name: 'LengthBoundaryOperator',
  type: 'boundary',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'MemberExpression' &&
      node.property === 'length'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // length > 0 -> length >= 0
    candidates.push({
      type: 'boundary',
      original: '.length > 0',
      mutated: '.length >= 0',
      description: 'Change length > 0 to length >= 0',
      location: {},
    });

    // length > 0 -> length > 1
    candidates.push({
      type: 'boundary',
      original: '.length > 0',
      mutated: '.length > 1',
      description: 'Change length > 0 to length > 1',
      location: {},
    });

    return candidates;
  },
};

/**
 * Comparison boundary mutation
 * Changes < to <= and > to >=
 */
export const comparisonBoundaryOperator: MutationOperator = {
  name: 'ComparisonBoundaryOperator',
  type: 'boundary',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'BinaryExpression' &&
      (node.operator === '<' || node.operator === '>' ||
       node.operator === '<=' || node.operator === '>=')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const candidates: MutantCandidate[] = [];
    const op = node.operator;

    // Off-by-one boundary mutations
    const boundaryMutations: Record<string, string[]> = {
      '<': ['<='],
      '<=': ['<'],
      '>': ['>='],
      '>=': ['>'],
    };

    const replacements = boundaryMutations[op] || [];
    for (const replacement of replacements) {
      candidates.push({
        type: 'boundary',
        original: op,
        mutated: replacement,
        description: `Boundary: change '${op}' to '${replacement}'`,
        location: {},
      });
    }

    return candidates;
  },
};

/**
 * ISL rate limit boundary mutation
 */
export const rateLimitBoundaryOperator: MutationOperator = {
  name: 'RateLimitBoundaryOperator',
  type: 'boundary',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'RateLimit' &&
      typeof node.limit === 'number'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.limit !== 'number') {
      return [];
    }

    const limit = node.limit;
    const candidates: MutantCandidate[] = [];

    // Decrease limit
    candidates.push({
      type: 'boundary',
      original: `rate_limit ${limit}`,
      mutated: `rate_limit ${Math.max(1, limit - 1)}`,
      description: `Decrease rate limit from ${limit} to ${limit - 1}`,
      location: {},
    });

    // Increase limit
    candidates.push({
      type: 'boundary',
      original: `rate_limit ${limit}`,
      mutated: `rate_limit ${limit + 1}`,
      description: `Increase rate limit from ${limit} to ${limit + 1}`,
      location: {},
    });

    // Half the limit
    candidates.push({
      type: 'boundary',
      original: `rate_limit ${limit}`,
      mutated: `rate_limit ${Math.floor(limit / 2)}`,
      description: `Halve rate limit from ${limit} to ${Math.floor(limit / 2)}`,
      location: {},
    });

    // Double the limit
    candidates.push({
      type: 'boundary',
      original: `rate_limit ${limit}`,
      mutated: `rate_limit ${limit * 2}`,
      description: `Double rate limit from ${limit} to ${limit * 2}`,
      location: {},
    });

    return candidates;
  },
};

/**
 * Precision boundary mutation for Decimal types
 */
export const precisionBoundaryOperator: MutationOperator = {
  name: 'PrecisionBoundaryOperator',
  type: 'boundary',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'TypeConstraint' &&
      hasProperty(node, 'precision') &&
      typeof node.precision === 'number'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.precision !== 'number') {
      return [];
    }

    const precision = node.precision;
    const candidates: MutantCandidate[] = [];

    // Decrease precision
    if (precision > 0) {
      candidates.push({
        type: 'boundary',
        original: `precision: ${precision}`,
        mutated: `precision: ${precision - 1}`,
        description: `Decrease precision from ${precision} to ${precision - 1}`,
        location: {},
      });
    }

    // Increase precision
    candidates.push({
      type: 'boundary',
      original: `precision: ${precision}`,
      mutated: `precision: ${precision + 1}`,
      description: `Increase precision from ${precision} to ${precision + 1}`,
      location: {},
    });

    return candidates;
  },
};

/** All boundary operators */
export const boundaryOperators: MutationOperator[] = [
  boundaryConstraintOperator,
  lengthBoundaryOperator,
  comparisonBoundaryOperator,
  rateLimitBoundaryOperator,
  precisionBoundaryOperator,
];

// Type guard helpers
function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}
