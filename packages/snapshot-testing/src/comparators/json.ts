/**
 * JSON Comparator
 * 
 * Deep comparison for JSON structures with configurable options.
 */

import deepEqual from 'fast-deep-equal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** JSON comparison options */
export interface JsonCompareOptions {
  /** Ignore specific keys during comparison */
  ignoreKeys?: string[];
  /** Ignore keys matching patterns */
  ignorePatterns?: RegExp[];
  /** Ignore array order */
  ignoreArrayOrder?: boolean;
  /** Tolerance for number comparison */
  numberTolerance?: number;
  /** Ignore undefined values */
  ignoreUndefined?: boolean;
  /** Custom key comparator */
  keyComparator?: (key: string, a: unknown, b: unknown) => boolean | undefined;
}

/** Difference type */
export type DiffType = 'added' | 'removed' | 'changed' | 'type_changed';

/** A single difference */
export interface JsonDiff {
  path: string;
  type: DiffType;
  expected?: unknown;
  actual?: unknown;
}

/** Comparison result */
export interface JsonCompareResult {
  match: boolean;
  differences: JsonDiff[];
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse JSON string safely
 */
export function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Serialize value to JSON
 */
export function serializeJson(value: unknown, pretty = true): string {
  return JSON.stringify(value, null, pretty ? 2 : undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a key should be ignored
 */
function shouldIgnoreKey(key: string, options: JsonCompareOptions): boolean {
  if (options.ignoreKeys?.includes(key)) return true;
  if (options.ignorePatterns?.some(p => p.test(key))) return true;
  return false;
}

/**
 * Filter object by removing ignored keys
 */
function filterObject(obj: Record<string, unknown>, options: JsonCompareOptions): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (shouldIgnoreKey(key, options)) continue;
    if (options.ignoreUndefined && value === undefined) continue;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = filterObject(value as Record<string, unknown>, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? filterObject(item as Record<string, unknown>, options)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Sort array for comparison
 */
function sortArray(arr: unknown[]): unknown[] {
  return [...arr].sort((a, b) => {
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    return aStr.localeCompare(bStr);
  });
}

/**
 * Compare two numbers with tolerance
 */
function compareNumbers(a: number, b: number, tolerance: number): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return Math.abs(a - b) <= tolerance;
}

/**
 * Collect differences between two values
 */
function collectDifferences(
  expected: unknown,
  actual: unknown,
  path: string,
  options: JsonCompareOptions
): JsonDiff[] {
  const diffs: JsonDiff[] = [];

  // Type comparison
  const expectedType = typeof expected;
  const actualType = typeof actual;

  if (expectedType !== actualType) {
    if (expected === null && actual !== null) {
      diffs.push({ path, type: 'type_changed', expected, actual });
    } else if (expected !== null && actual === null) {
      diffs.push({ path, type: 'type_changed', expected, actual });
    } else {
      diffs.push({ path, type: 'type_changed', expected, actual });
    }
    return diffs;
  }

  // Null comparison
  if (expected === null || actual === null) {
    if (expected !== actual) {
      diffs.push({ path, type: 'changed', expected, actual });
    }
    return diffs;
  }

  // Number comparison with tolerance
  if (typeof expected === 'number' && typeof actual === 'number') {
    const tolerance = options.numberTolerance ?? 0;
    if (!compareNumbers(expected, actual, tolerance)) {
      diffs.push({ path, type: 'changed', expected, actual });
    }
    return diffs;
  }

  // Array comparison
  if (Array.isArray(expected) && Array.isArray(actual)) {
    let expectedArr = expected;
    let actualArr = actual;

    if (options.ignoreArrayOrder) {
      expectedArr = sortArray(expected);
      actualArr = sortArray(actual);
    }

    if (expectedArr.length !== actualArr.length) {
      diffs.push({ path, type: 'changed', expected, actual });
      return diffs;
    }

    for (let i = 0; i < expectedArr.length; i++) {
      const itemDiffs = collectDifferences(
        expectedArr[i],
        actualArr[i],
        `${path}[${i}]`,
        options
      );
      diffs.push(...itemDiffs);
    }
    return diffs;
  }

  // Object comparison
  if (typeof expected === 'object' && typeof actual === 'object') {
    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;
    
    const allKeys = new Set([...Object.keys(expectedObj), ...Object.keys(actualObj)]);

    for (const key of allKeys) {
      if (shouldIgnoreKey(key, options)) continue;

      const keyPath = path ? `${path}.${key}` : key;
      const expectedVal = expectedObj[key];
      const actualVal = actualObj[key];

      // Custom comparator
      if (options.keyComparator) {
        const result = options.keyComparator(key, expectedVal, actualVal);
        if (result !== undefined) {
          if (!result) {
            diffs.push({ path: keyPath, type: 'changed', expected: expectedVal, actual: actualVal });
          }
          continue;
        }
      }

      if (!(key in expectedObj)) {
        diffs.push({ path: keyPath, type: 'added', actual: actualVal });
      } else if (!(key in actualObj)) {
        diffs.push({ path: keyPath, type: 'removed', expected: expectedVal });
      } else {
        const nestedDiffs = collectDifferences(expectedVal, actualVal, keyPath, options);
        diffs.push(...nestedDiffs);
      }
    }
    return diffs;
  }

  // Primitive comparison
  if (expected !== actual) {
    diffs.push({ path, type: 'changed', expected, actual });
  }

  return diffs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Compare Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two JSON values
 */
export function compareJson(
  expected: unknown,
  actual: unknown,
  options: JsonCompareOptions = {}
): JsonCompareResult {
  // Apply filters
  let filteredExpected = expected;
  let filteredActual = actual;

  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    filteredExpected = filterObject(expected as Record<string, unknown>, options);
  }
  if (actual !== null && typeof actual === 'object' && !Array.isArray(actual)) {
    filteredActual = filterObject(actual as Record<string, unknown>, options);
  }

  const differences = collectDifferences(filteredExpected, filteredActual, '', options);

  return {
    match: differences.length === 0,
    differences,
  };
}

/**
 * Compare two JSON strings
 */
export function compareJsonStrings(
  expected: string,
  actual: string,
  options: JsonCompareOptions = {}
): JsonCompareResult {
  const expectedObj = parseJson(expected);
  const actualObj = parseJson(actual);

  if (expectedObj === null && actualObj === null) {
    // Both failed to parse, compare as strings
    return {
      match: expected === actual,
      differences: expected === actual ? [] : [{
        path: '',
        type: 'changed',
        expected,
        actual,
      }],
    };
  }

  return compareJson(expectedObj, actualObj, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Serializer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create JSON serializer with options
 */
export function createJsonSerializer(options: JsonCompareOptions = {}): (value: unknown) => string {
  return (value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const filtered = filterObject(value as Record<string, unknown>, options);
      return serializeJson(filtered);
    }
    return serializeJson(value);
  };
}

/**
 * Create JSON comparator with options
 */
export function createJsonComparator(options: JsonCompareOptions = {}): (expected: string, actual: string) => boolean {
  return (expected: string, actual: string) => {
    const result = compareJsonStrings(expected, actual, options);
    return result.match;
  };
}
