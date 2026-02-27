/**
 * Output Differencing
 * 
 * Generates detailed diffs between implementation outputs.
 */

import type { Difference, DifferenceCategory, DifferenceSeverity } from './equivalence.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single change in a diff */
export interface DiffChange {
  type: 'add' | 'remove' | 'modify' | 'equal';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  implementation?: string;
}

/** Complete diff between two outputs */
export interface OutputDiff {
  changes: DiffChange[];
  summary: DiffSummary;
}

/** Summary of changes */
export interface DiffSummary {
  additions: number;
  removals: number;
  modifications: number;
  totalChanges: number;
}

/** Diff format options */
export interface DiffOptions {
  /** Maximum depth to recurse into objects */
  maxDepth?: number;
  /** Include equal values in output */
  includeEqual?: boolean;
  /** Truncate long strings at this length */
  truncateStrings?: number;
  /** Context lines to show around changes */
  contextLines?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate diff between two values
 */
export function diff(
  oldValue: unknown,
  newValue: unknown,
  options: DiffOptions = {},
  path = ''
): DiffChange[] {
  const maxDepth = options.maxDepth ?? 10;
  const currentDepth = path.split('.').filter(Boolean).length;

  if (currentDepth > maxDepth) {
    return [{
      type: 'modify',
      path: path || 'root',
      oldValue: '[max depth reached]',
      newValue: '[max depth reached]',
    }];
  }

  const changes: DiffChange[] = [];

  // Handle null/undefined
  if (oldValue === null && newValue === null) {
    if (options.includeEqual) {
      changes.push({ type: 'equal', path: path || 'root', oldValue, newValue });
    }
    return changes;
  }

  if (oldValue === undefined && newValue === undefined) {
    if (options.includeEqual) {
      changes.push({ type: 'equal', path: path || 'root', oldValue, newValue });
    }
    return changes;
  }

  if (oldValue === null || oldValue === undefined) {
    changes.push({ type: 'add', path: path || 'root', newValue });
    return changes;
  }

  if (newValue === null || newValue === undefined) {
    changes.push({ type: 'remove', path: path || 'root', oldValue });
    return changes;
  }

  // Different types
  if (typeof oldValue !== typeof newValue) {
    changes.push({ type: 'modify', path: path || 'root', oldValue, newValue });
    return changes;
  }

  // Primitives
  if (typeof oldValue !== 'object') {
    if (oldValue === newValue) {
      if (options.includeEqual) {
        changes.push({ type: 'equal', path: path || 'root', oldValue, newValue });
      }
    } else {
      changes.push({ type: 'modify', path: path || 'root', oldValue, newValue });
    }
    return changes;
  }

  // Arrays
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const maxLen = Math.max(oldValue.length, newValue.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= oldValue.length) {
        changes.push({ type: 'add', path: itemPath, newValue: newValue[i] });
      } else if (i >= newValue.length) {
        changes.push({ type: 'remove', path: itemPath, oldValue: oldValue[i] });
      } else {
        changes.push(...diff(oldValue[i], newValue[i], options, itemPath));
      }
    }
    return changes;
  }

  // Objects
  if (typeof oldValue === 'object' && typeof newValue === 'object') {
    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      if (!(key in oldObj)) {
        changes.push({ type: 'add', path: keyPath, newValue: newObj[key] });
      } else if (!(key in newObj)) {
        changes.push({ type: 'remove', path: keyPath, oldValue: oldObj[key] });
      } else {
        changes.push(...diff(oldObj[key], newObj[key], options, keyPath));
      }
    }
    return changes;
  }

  // Fallback
  if (oldValue !== newValue) {
    changes.push({ type: 'modify', path: path || 'root', oldValue, newValue });
  } else if (options.includeEqual) {
    changes.push({ type: 'equal', path: path || 'root', oldValue, newValue });
  }

  return changes;
}

/**
 * Generate complete output diff with summary
 */
export function generateOutputDiff(
  oldValue: unknown,
  newValue: unknown,
  options: DiffOptions = {}
): OutputDiff {
  const changes = diff(oldValue, newValue, options);
  
  const summary: DiffSummary = {
    additions: changes.filter(c => c.type === 'add').length,
    removals: changes.filter(c => c.type === 'remove').length,
    modifications: changes.filter(c => c.type === 'modify').length,
    totalChanges: changes.filter(c => c.type !== 'equal').length,
  };

  return { changes, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Implementation Diff
// ─────────────────────────────────────────────────────────────────────────────

/** Diff across multiple implementations */
export interface MultiDiff {
  /** Reference implementation name */
  reference: string;
  /** Diffs compared to reference */
  comparisons: Map<string, OutputDiff>;
  /** Aggregated differences */
  aggregated: AggregatedDiff;
}

/** Aggregated diff statistics */
export interface AggregatedDiff {
  /** Paths that differ across implementations */
  differingPaths: Set<string>;
  /** Implementations grouped by output similarity */
  similarityGroups: SimilarityGroup[];
  /** Overall similarity matrix */
  similarityMatrix: Map<string, Map<string, number>>;
}

/** Group of similar implementations */
export interface SimilarityGroup {
  implementations: string[];
  similarity: number;
}

/**
 * Generate diffs between multiple implementation outputs
 */
export function generateMultiDiff(
  outputs: Map<string, unknown>,
  referenceImpl?: string,
  options: DiffOptions = {}
): MultiDiff {
  const implNames = Array.from(outputs.keys());
  const reference = referenceImpl ?? implNames[0];
  const referenceOutput = outputs.get(reference);

  const comparisons = new Map<string, OutputDiff>();
  const differingPaths = new Set<string>();

  // Generate diff for each implementation against reference
  for (const [name, output] of outputs) {
    if (name === reference) continue;
    
    const outputDiff = generateOutputDiff(referenceOutput, output, options);
    comparisons.set(name, outputDiff);

    // Collect differing paths
    for (const change of outputDiff.changes) {
      if (change.type !== 'equal') {
        differingPaths.add(change.path);
      }
    }
  }

  // Calculate similarity matrix
  const similarityMatrix = new Map<string, Map<string, number>>();
  for (const name1 of implNames) {
    const row = new Map<string, number>();
    for (const name2 of implNames) {
      if (name1 === name2) {
        row.set(name2, 100);
      } else {
        const output1 = outputs.get(name1);
        const output2 = outputs.get(name2);
        const d = generateOutputDiff(output1, output2, options);
        const totalFields = d.changes.length || 1;
        const matchingFields = d.changes.filter(c => c.type === 'equal').length;
        row.set(name2, (matchingFields / totalFields) * 100);
      }
    }
    similarityMatrix.set(name1, row);
  }

  // Group by similarity (simple clustering)
  const similarityGroups = clusterBySimilarity(implNames, similarityMatrix);

  return {
    reference,
    comparisons,
    aggregated: {
      differingPaths,
      similarityGroups,
      similarityMatrix,
    },
  };
}

/**
 * Cluster implementations by similarity
 */
function clusterBySimilarity(
  implNames: string[],
  similarityMatrix: Map<string, Map<string, number>>
): SimilarityGroup[] {
  const groups: SimilarityGroup[] = [];
  const assigned = new Set<string>();
  const threshold = 95; // 95% similarity to be in same group

  for (const name of implNames) {
    if (assigned.has(name)) continue;

    const group: string[] = [name];
    assigned.add(name);

    const row = similarityMatrix.get(name);
    if (!row) continue;

    for (const [other, similarity] of row) {
      if (assigned.has(other)) continue;
      if (similarity >= threshold) {
        group.push(other);
        assigned.add(other);
      }
    }

    // Calculate average similarity within group
    let totalSim = 0;
    let count = 0;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const sim = similarityMatrix.get(group[i])?.get(group[j]) ?? 0;
        totalSim += sim;
        count++;
      }
    }

    groups.push({
      implementations: group,
      similarity: count > 0 ? totalSim / count : 100,
    });
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a diff change for display
 */
export function formatChange(change: DiffChange, options: DiffOptions = {}): string {
  const truncate = options.truncateStrings ?? 100;
  const formatValue = (v: unknown): string => {
    const str = JSON.stringify(v);
    if (str.length > truncate) {
      return str.slice(0, truncate) + '...';
    }
    return str;
  };

  switch (change.type) {
    case 'add':
      return `+ ${change.path}: ${formatValue(change.newValue)}`;
    case 'remove':
      return `- ${change.path}: ${formatValue(change.oldValue)}`;
    case 'modify':
      return `~ ${change.path}: ${formatValue(change.oldValue)} → ${formatValue(change.newValue)}`;
    case 'equal':
      return `  ${change.path}: ${formatValue(change.oldValue)}`;
  }
}

/**
 * Format entire diff for display
 */
export function formatDiff(outputDiff: OutputDiff, options: DiffOptions = {}): string {
  const lines: string[] = [];
  
  // Filter to only show changes unless includeEqual is true
  const changes = options.includeEqual 
    ? outputDiff.changes 
    : outputDiff.changes.filter(c => c.type !== 'equal');

  for (const change of changes) {
    lines.push(formatChange(change, options));
  }

  // Summary
  lines.push('');
  lines.push(`Summary: +${outputDiff.summary.additions} -${outputDiff.summary.removals} ~${outputDiff.summary.modifications}`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { diff as generateDiff };
