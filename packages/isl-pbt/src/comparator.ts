// ============================================================================
// Output Comparator - Structural and semantic equality for differential testing
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single difference found between two outputs
 */
export interface OutputDiff {
  /** JSON-pointer-style path to the differing value (e.g. "user.address.zip") */
  path: string;
  /** Value from implementation A */
  valueA: unknown;
  /** Value from implementation B */
  valueB: unknown;
  /** Kind of difference */
  type: 'missing' | 'extra' | 'different';
}

// ============================================================================
// DEEP EQUALITY
// ============================================================================

/**
 * Strict structural equality. Two values are deeply equal when they have
 * identical types, identical keys (for objects), identical ordering (for
 * arrays), and recursively identical leaf values.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
      if (!deepEqual(objA[keysA[i]!], objB[keysB[i]!])) return false;
    }
    return true;
  }

  return false;
}

// ============================================================================
// SEMANTIC EQUALITY
// ============================================================================

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Semantic equality that tolerates common representation differences:
 *  - floating-point tolerance (default 1e-9)
 *  - date strings in different ISO-8601 formats compared by instant
 *  - object key ordering
 *  - NaN === NaN
 */
export function semanticEqual(
  a: unknown,
  b: unknown,
  tolerance = 1e-9,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;

  // Numbers: NaN handling + tolerance
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return Math.abs(a - b) <= tolerance;
  }

  // Date objects → compare milliseconds
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // String-encoded dates → parse and compare instants
  if (typeof a === 'string' && typeof b === 'string') {
    if (ISO_DATE_RE.test(a) && ISO_DATE_RE.test(b)) {
      const da = new Date(a);
      const db = new Date(b);
      if (!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime())) {
        return da.getTime() === db.getTime();
      }
    }
    return a === b;
  }

  // Arrays: element-wise semantic comparison
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!semanticEqual(a[i], b[i], tolerance)) return false;
    }
    return true;
  }

  // Objects: key-order-independent comparison
  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
      if (!semanticEqual(objA[keysA[i]!], objB[keysB[i]!], tolerance)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

// ============================================================================
// DIFF OUTPUTS
// ============================================================================

/**
 * Produce a detailed list of differences between two output values.
 * Each entry includes a dot-separated path, both values, and the kind of
 * divergence (missing in B, extra in B, or value mismatch).
 */
export function diffOutputs(a: unknown, b: unknown): OutputDiff[] {
  const diffs: OutputDiff[] = [];
  collectDiffs(a, b, '', diffs);
  return diffs;
}

function collectDiffs(
  a: unknown,
  b: unknown,
  path: string,
  out: OutputDiff[],
): void {
  if (a === b) return;

  // null / undefined vs something
  if (a == null && b == null) return;
  if (a == null) {
    out.push({ path: path || '<root>', valueA: a, valueB: b, type: 'extra' });
    return;
  }
  if (b == null) {
    out.push({ path: path || '<root>', valueA: a, valueB: b, type: 'missing' });
    return;
  }

  // Type mismatch → single "different" entry
  if (typeof a !== typeof b) {
    out.push({ path: path || '<root>', valueA: a, valueB: b, type: 'different' });
    return;
  }

  // Scalars
  if (typeof a !== 'object') {
    if (a !== b) {
      out.push({ path: path || '<root>', valueA: a, valueB: b, type: 'different' });
    }
    return;
  }

  // Date objects
  if (a instanceof Date && b instanceof Date) {
    if (a.getTime() !== b.getTime()) {
      out.push({ path: path || '<root>', valueA: a, valueB: b, type: 'different' });
    }
    return;
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= a.length) {
        out.push({ path: childPath, valueA: undefined, valueB: b[i], type: 'extra' });
      } else if (i >= b.length) {
        out.push({ path: childPath, valueA: a[i], valueB: undefined, type: 'missing' });
      } else {
        collectDiffs(a[i], b[i], childPath, out);
      }
    }
    return;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    out.push({ path: path || '<root>', valueA: a, valueB: b, type: 'different' });
    return;
  }

  // Objects
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key;
    const inA = key in objA;
    const inB = key in objB;

    if (inA && !inB) {
      out.push({ path: childPath, valueA: objA[key], valueB: undefined, type: 'missing' });
    } else if (!inA && inB) {
      out.push({ path: childPath, valueA: undefined, valueB: objB[key], type: 'extra' });
    } else {
      collectDiffs(objA[key], objB[key], childPath, out);
    }
  }
}
