import { createHash, createHmac } from 'node:crypto';

export function computeHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function computeHmac(content: string | Buffer, key: string): string {
  return createHmac('sha256', key).update(content).digest('hex');
}

/**
 * Deterministic JSON serialization: keys sorted recursively, no whitespace.
 * Produces identical output for semantically equal objects regardless of
 * insertion order, making it safe for hash-then-compare workflows.
 */
export function canonicalize(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
