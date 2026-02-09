/**
 * Canonical JSON Serialization
 * 
 * Produces deterministic, hashable JSON output by:
 * - Sorting object keys recursively at all depth levels
 * - Normalizing line endings to LF (\n)
 * - Using consistent indentation (2 spaces)
 * - Handling special values (undefined → omitted, NaN → null, Infinity → null)
 * - Producing stable output regardless of key insertion order
 * 
 * Conforms to ProofBundle v1 hashing rules.
 * 
 * @module @isl-lang/proof
 */

/**
 * Recursively sort all object keys and normalize values for canonical output.
 * Arrays preserve order (index-significant); objects get sorted keys.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  if (typeof value === 'string') {
    // Normalize line endings to LF
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      const v = (value as Record<string, unknown>)[key];
      // Omit undefined values entirely
      if (v !== undefined) {
        sorted[key] = canonicalize(v);
      }
    }
    return sorted;
  }

  // Fallback: convert to string
  return String(value);
}

/**
 * Serialize a value to canonical JSON.
 * 
 * Rules:
 * - Object keys sorted lexicographically at every depth level
 * - Line endings normalized to LF
 * - 2-space indentation
 * - Trailing newline
 * - undefined values omitted
 * - NaN/Infinity → null
 * 
 * Guarantees: identical input → identical output byte-for-byte.
 */
export function canonicalJsonStringify(value: unknown): string {
  const canonical = canonicalize(value);
  return JSON.stringify(canonical, null, 2) + '\n';
}

/**
 * Serialize a value to compact canonical JSON (no whitespace).
 * Used for hash computation where size matters.
 */
export function canonicalJsonCompact(value: unknown): string {
  const canonical = canonicalize(value);
  return JSON.stringify(canonical);
}

/**
 * Parse JSON and re-serialize canonically.
 * Useful for normalizing existing JSON files.
 */
export function normalizeJson(jsonString: string): string {
  const parsed = JSON.parse(jsonString);
  return canonicalJsonStringify(parsed);
}
