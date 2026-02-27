/**
 * Temporal Mutation Operators
 * 
 * Mutates timing constraints: response times, deadlines, percentiles
 */

import { MutationOperator, MutantCandidate } from '../types';

/**
 * Response time mutation
 * Changes timing requirements
 */
export const responseTimeOperator: MutationOperator = {
  name: 'ResponseTimeOperator',
  type: 'temporal',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'TemporalConstraint' &&
      hasProperty(node, 'within') &&
      typeof node.within === 'number'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.within !== 'number') {
      return [];
    }

    const within = node.within;
    const unit = (node.unit as string) || 'ms';
    const percentile = (node.percentile as string) || 'p99';
    const candidates: MutantCandidate[] = [];

    // Tighten (half the time)
    candidates.push({
      type: 'temporal',
      original: `within ${within}${unit} (${percentile})`,
      mutated: `within ${Math.floor(within / 2)}${unit} (${percentile})`,
      description: `Tighten response time from ${within}${unit} to ${Math.floor(within / 2)}${unit}`,
      location: {},
    });

    // Loosen (double the time)
    candidates.push({
      type: 'temporal',
      original: `within ${within}${unit} (${percentile})`,
      mutated: `within ${within * 2}${unit} (${percentile})`,
      description: `Loosen response time from ${within}${unit} to ${within * 2}${unit}`,
      location: {},
    });

    // Remove temporal constraint
    candidates.push({
      type: 'temporal',
      original: `within ${within}${unit} (${percentile})`,
      mutated: '// temporal constraint removed',
      description: 'Remove temporal constraint',
      location: {},
    });

    return candidates;
  },
};

/**
 * Percentile mutation
 * Changes percentile targets (p50, p95, p99, p99.9)
 */
export const percentileOperator: MutationOperator = {
  name: 'PercentileOperator',
  type: 'temporal',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'TemporalConstraint' &&
      hasProperty(node, 'percentile') &&
      typeof node.percentile === 'string'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.percentile !== 'string') {
      return [];
    }

    const original = node.percentile;
    const percentiles = ['p50', 'p90', 'p95', 'p99', 'p99.9'];
    const candidates: MutantCandidate[] = [];

    for (const percentile of percentiles) {
      if (percentile !== original) {
        candidates.push({
          type: 'temporal',
          original: `(${original})`,
          mutated: `(${percentile})`,
          description: `Change percentile from ${original} to ${percentile}`,
          location: {},
        });
      }
    }

    return candidates;
  },
};

/**
 * Eventually mutation
 * Mutates eventual consistency constraints
 */
export const eventuallyOperator: MutationOperator = {
  name: 'EventuallyOperator',
  type: 'temporal',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'EventualConstraint' &&
      hasProperty(node, 'within')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const within = node.within as number || 0;
    const unit = (node.unit as string) || 's';
    const candidates: MutantCandidate[] = [];

    // Tighten eventual deadline
    candidates.push({
      type: 'temporal',
      original: `eventually within ${within}${unit}`,
      mutated: `eventually within ${Math.floor(within / 2)}${unit}`,
      description: `Tighten eventual deadline from ${within}${unit} to ${Math.floor(within / 2)}${unit}`,
      location: {},
    });

    // Loosen eventual deadline
    candidates.push({
      type: 'temporal',
      original: `eventually within ${within}${unit}`,
      mutated: `eventually within ${within * 2}${unit}`,
      description: `Loosen eventual deadline from ${within}${unit} to ${within * 2}${unit}`,
      location: {},
    });

    // Change to immediately
    candidates.push({
      type: 'temporal',
      original: `eventually within ${within}${unit}`,
      mutated: 'immediately',
      description: 'Change from eventual to immediate',
      location: {},
    });

    return candidates;
  },
};

/**
 * Immediately mutation
 * Mutates immediate timing requirements
 */
export const immediatelyOperator: MutationOperator = {
  name: 'ImmediatelyOperator',
  type: 'temporal',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'ImmediateConstraint'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    return [
      {
        type: 'temporal',
        original: 'immediately',
        mutated: 'eventually within 5s',
        description: 'Change from immediate to eventual',
        location: {},
      },
      {
        type: 'temporal',
        original: 'immediately',
        mutated: '// timing constraint removed',
        description: 'Remove immediate constraint',
        location: {},
      },
    ];
  },
};

/**
 * Timeout mutation
 * Mutates timeout values
 */
export const timeoutOperator: MutationOperator = {
  name: 'TimeoutOperator',
  type: 'temporal',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      (node.type === 'TimeoutConstraint' || 
       (node.type === 'SecurityConstraint' && hasProperty(node, 'expires')))
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const timeout = (node.timeout || node.expires) as number || 0;
    const unit = (node.unit as string) || 's';
    const candidates: MutantCandidate[] = [];

    // Shorter timeout
    candidates.push({
      type: 'temporal',
      original: `timeout ${timeout}${unit}`,
      mutated: `timeout ${Math.floor(timeout / 2)}${unit}`,
      description: `Decrease timeout from ${timeout}${unit} to ${Math.floor(timeout / 2)}${unit}`,
      location: {},
    });

    // Longer timeout
    candidates.push({
      type: 'temporal',
      original: `timeout ${timeout}${unit}`,
      mutated: `timeout ${timeout * 2}${unit}`,
      description: `Increase timeout from ${timeout}${unit} to ${timeout * 2}${unit}`,
      location: {},
    });

    // Very short timeout (test boundary)
    candidates.push({
      type: 'temporal',
      original: `timeout ${timeout}${unit}`,
      mutated: 'timeout 1ms',
      description: 'Set very short timeout (1ms)',
      location: {},
    });

    return candidates;
  },
};

/**
 * Retry delay mutation
 */
export const retryDelayOperator: MutationOperator = {
  name: 'RetryDelayOperator',
  type: 'temporal',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'ErrorDefinition' &&
      hasProperty(node, 'retry_after')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const retryAfter = node.retry_after as number || 0;
    const unit = (node.retry_unit as string) || 's';
    const candidates: MutantCandidate[] = [];

    // Shorter retry delay
    if (retryAfter > 1) {
      candidates.push({
        type: 'temporal',
        original: `retry_after: ${retryAfter}${unit}`,
        mutated: `retry_after: ${Math.floor(retryAfter / 2)}${unit}`,
        description: `Decrease retry delay from ${retryAfter}${unit} to ${Math.floor(retryAfter / 2)}${unit}`,
        location: {},
      });
    }

    // Longer retry delay
    candidates.push({
      type: 'temporal',
      original: `retry_after: ${retryAfter}${unit}`,
      mutated: `retry_after: ${retryAfter * 2}${unit}`,
      description: `Increase retry delay from ${retryAfter}${unit} to ${retryAfter * 2}${unit}`,
      location: {},
    });

    // Remove retry delay
    candidates.push({
      type: 'temporal',
      original: `retry_after: ${retryAfter}${unit}`,
      mutated: '// retry_after removed',
      description: 'Remove retry delay',
      location: {},
    });

    return candidates;
  },
};

/** All temporal operators */
export const temporalOperators: MutationOperator[] = [
  responseTimeOperator,
  percentileOperator,
  eventuallyOperator,
  immediatelyOperator,
  timeoutOperator,
  retryDelayOperator,
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
