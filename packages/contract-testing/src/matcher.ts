/**
 * Contract Matcher
 * 
 * Advanced matching utilities for contract verification.
 */

export interface MatchResult {
  /** Whether the match succeeded */
  matched: boolean;
  /** Path to first mismatch */
  path?: string;
  /** Expected value at mismatch */
  expected?: unknown;
  /** Actual value at mismatch */
  actual?: unknown;
  /** All mismatches found */
  mismatches: Mismatch[];
}

export interface Mismatch {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface MatcherOptions {
  /** Allow additional properties not in expected */
  allowExtraProperties?: boolean;
  /** Paths to ignore during matching */
  ignorePaths?: string[];
  /** Custom matchers for specific paths */
  customMatchers?: Record<string, (value: unknown) => boolean>;
  /** Numeric tolerance for floating point comparison */
  numericTolerance?: number;
  /** Case insensitive string comparison */
  caseInsensitive?: boolean;
  /** Array matching mode */
  arrayMatchMode?: 'exact' | 'contains' | 'unordered';
}

/**
 * Contract Matcher
 */
export class ContractMatcher {
  private options: Required<MatcherOptions>;

  constructor(options: MatcherOptions = {}) {
    this.options = {
      allowExtraProperties: options.allowExtraProperties ?? true,
      ignorePaths: options.ignorePaths ?? [],
      customMatchers: options.customMatchers ?? {},
      numericTolerance: options.numericTolerance ?? 0,
      caseInsensitive: options.caseInsensitive ?? false,
      arrayMatchMode: options.arrayMatchMode ?? 'exact',
    };
  }

  /**
   * Match actual against expected
   */
  match(expected: unknown, actual: unknown, path = ''): MatchResult {
    const mismatches: Mismatch[] = [];
    this.matchRecursive(expected, actual, path, mismatches);

    return {
      matched: mismatches.length === 0,
      path: mismatches[0]?.path,
      expected: mismatches[0]?.expected,
      actual: mismatches[0]?.actual,
      mismatches,
    };
  }

  /**
   * Recursive matching implementation
   */
  private matchRecursive(
    expected: unknown,
    actual: unknown,
    path: string,
    mismatches: Mismatch[]
  ): void {
    // Check ignored paths
    if (this.options.ignorePaths.includes(path)) {
      return;
    }

    // Check custom matchers
    if (this.options.customMatchers[path]) {
      if (!this.options.customMatchers[path](actual)) {
        mismatches.push({
          path,
          expected: 'custom matcher',
          actual,
          message: `Custom matcher failed at '${path}'`,
        });
      }
      return;
    }

    // Handle matchers
    if (this.isMatcher(expected)) {
      if (!this.applyMatcher(expected as Matcher, actual)) {
        mismatches.push({
          path,
          expected,
          actual,
          message: `Matcher failed at '${path}'`,
        });
      }
      return;
    }

    // Null checks
    if (expected === null) {
      if (actual !== null) {
        mismatches.push({
          path,
          expected: null,
          actual,
          message: `Expected null at '${path}'`,
        });
      }
      return;
    }

    if (actual === null || actual === undefined) {
      mismatches.push({
        path,
        expected,
        actual,
        message: `Expected value at '${path}', got ${actual}`,
      });
      return;
    }

    // Type check
    if (typeof expected !== typeof actual) {
      mismatches.push({
        path,
        expected: typeof expected,
        actual: typeof actual,
        message: `Type mismatch at '${path}': expected ${typeof expected}, got ${typeof actual}`,
      });
      return;
    }

    // Primitive types
    if (typeof expected !== 'object') {
      if (!this.primitiveMatch(expected, actual)) {
        mismatches.push({
          path,
          expected,
          actual,
          message: `Value mismatch at '${path}'`,
        });
      }
      return;
    }

    // Array matching
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        mismatches.push({
          path,
          expected: 'array',
          actual: typeof actual,
          message: `Expected array at '${path}'`,
        });
        return;
      }

      this.matchArrays(expected, actual, path, mismatches);
      return;
    }

    // Object matching
    this.matchObjects(
      expected as Record<string, unknown>,
      actual as Record<string, unknown>,
      path,
      mismatches
    );
  }

  /**
   * Match primitive values
   */
  private primitiveMatch(expected: unknown, actual: unknown): boolean {
    // String matching
    if (typeof expected === 'string' && typeof actual === 'string') {
      if (this.options.caseInsensitive) {
        return expected.toLowerCase() === actual.toLowerCase();
      }
      return expected === actual;
    }

    // Numeric matching with tolerance
    if (typeof expected === 'number' && typeof actual === 'number') {
      if (this.options.numericTolerance > 0) {
        return Math.abs(expected - actual) <= this.options.numericTolerance;
      }
      return expected === actual;
    }

    return expected === actual;
  }

  /**
   * Match arrays
   */
  private matchArrays(
    expected: unknown[],
    actual: unknown[],
    path: string,
    mismatches: Mismatch[]
  ): void {
    switch (this.options.arrayMatchMode) {
      case 'exact':
        this.matchArraysExact(expected, actual, path, mismatches);
        break;
      case 'contains':
        this.matchArraysContains(expected, actual, path, mismatches);
        break;
      case 'unordered':
        this.matchArraysUnordered(expected, actual, path, mismatches);
        break;
    }
  }

  /**
   * Exact array matching (order matters)
   */
  private matchArraysExact(
    expected: unknown[],
    actual: unknown[],
    path: string,
    mismatches: Mismatch[]
  ): void {
    if (expected.length !== actual.length) {
      mismatches.push({
        path,
        expected: `array of length ${expected.length}`,
        actual: `array of length ${actual.length}`,
        message: `Array length mismatch at '${path}'`,
      });
      return;
    }

    for (let i = 0; i < expected.length; i++) {
      this.matchRecursive(expected[i], actual[i], `${path}[${i}]`, mismatches);
    }
  }

  /**
   * Contains array matching (actual must contain all expected items)
   */
  private matchArraysContains(
    expected: unknown[],
    actual: unknown[],
    path: string,
    mismatches: Mismatch[]
  ): void {
    for (let i = 0; i < expected.length; i++) {
      const found = actual.some((item) => {
        const result = this.match(expected[i], item);
        return result.matched;
      });

      if (!found) {
        mismatches.push({
          path: `${path}[${i}]`,
          expected: expected[i],
          actual: 'not found',
          message: `Expected item not found in array at '${path}'`,
        });
      }
    }
  }

  /**
   * Unordered array matching (same items, any order)
   */
  private matchArraysUnordered(
    expected: unknown[],
    actual: unknown[],
    path: string,
    mismatches: Mismatch[]
  ): void {
    if (expected.length !== actual.length) {
      mismatches.push({
        path,
        expected: `array of length ${expected.length}`,
        actual: `array of length ${actual.length}`,
        message: `Array length mismatch at '${path}'`,
      });
      return;
    }

    const actualCopy = [...actual];

    for (let i = 0; i < expected.length; i++) {
      const matchIndex = actualCopy.findIndex((item) => {
        const result = this.match(expected[i], item);
        return result.matched;
      });

      if (matchIndex === -1) {
        mismatches.push({
          path: `${path}[${i}]`,
          expected: expected[i],
          actual: 'not found',
          message: `Expected item not found in array at '${path}'`,
        });
      } else {
        actualCopy.splice(matchIndex, 1);
      }
    }
  }

  /**
   * Match objects
   */
  private matchObjects(
    expected: Record<string, unknown>,
    actual: Record<string, unknown>,
    path: string,
    mismatches: Mismatch[]
  ): void {
    // Check expected keys
    for (const key of Object.keys(expected)) {
      const keyPath = path ? `${path}.${key}` : key;

      if (!(key in actual)) {
        mismatches.push({
          path: keyPath,
          expected: expected[key],
          actual: undefined,
          message: `Missing property '${keyPath}'`,
        });
        continue;
      }

      this.matchRecursive(expected[key], actual[key], keyPath, mismatches);
    }

    // Check extra keys in actual
    if (!this.options.allowExtraProperties) {
      for (const key of Object.keys(actual)) {
        if (!(key in expected)) {
          const keyPath = path ? `${path}.${key}` : key;
          mismatches.push({
            path: keyPath,
            expected: undefined,
            actual: actual[key],
            message: `Unexpected property '${keyPath}'`,
          });
        }
      }
    }
  }

  /**
   * Check if value is a matcher
   */
  private isMatcher(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    return '__isMatcher' in value;
  }

  /**
   * Apply matcher
   */
  private applyMatcher(matcher: Matcher, value: unknown): boolean {
    return matcher.match(value);
  }
}

/**
 * Matcher interface
 */
export interface Matcher {
  __isMatcher: true;
  match(value: unknown): boolean;
  describe(): string;
}

/**
 * Create matchers
 */
export const match = {
  /** Match any value */
  any(): Matcher {
    return {
      __isMatcher: true,
      match: () => true,
      describe: () => 'any value',
    };
  },

  /** Match value of specific type */
  type(typeName: string): Matcher {
    return {
      __isMatcher: true,
      match: (value) => typeof value === typeName,
      describe: () => `type ${typeName}`,
    };
  },

  /** Match string against regex */
  regex(pattern: RegExp | string): Matcher {
    const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return {
      __isMatcher: true,
      match: (value) => typeof value === 'string' && re.test(value),
      describe: () => `regex ${re.source}`,
    };
  },

  /** Match UUID format */
  uuid(): Matcher {
    return match.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  },

  /** Match ISO date */
  isoDate(): Matcher {
    return match.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  },

  /** Match email */
  email(): Matcher {
    return match.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  },

  /** Match number in range */
  numberBetween(min: number, max: number): Matcher {
    return {
      __isMatcher: true,
      match: (value) =>
        typeof value === 'number' && value >= min && value <= max,
      describe: () => `number between ${min} and ${max}`,
    };
  },

  /** Match string length */
  stringLength(min: number, max?: number): Matcher {
    return {
      __isMatcher: true,
      match: (value) =>
        typeof value === 'string' &&
        value.length >= min &&
        (max === undefined || value.length <= max),
      describe: () =>
        max ? `string length ${min}-${max}` : `string length >= ${min}`,
    };
  },

  /** Match array containing specific items */
  arrayContaining(items: unknown[]): Matcher {
    const matcher = new ContractMatcher({ arrayMatchMode: 'contains' });
    return {
      __isMatcher: true,
      match: (value) => {
        if (!Array.isArray(value)) return false;
        return matcher.match(items, value).matched;
      },
      describe: () => `array containing ${JSON.stringify(items)}`,
    };
  },

  /** Match object containing specific keys */
  objectContaining(obj: Record<string, unknown>): Matcher {
    const matcher = new ContractMatcher({ allowExtraProperties: true });
    return {
      __isMatcher: true,
      match: (value) => {
        if (typeof value !== 'object' || value === null) return false;
        return matcher.match(obj, value).matched;
      },
      describe: () => `object containing ${JSON.stringify(obj)}`,
    };
  },

  /** Match one of the given values */
  oneOf(...values: unknown[]): Matcher {
    return {
      __isMatcher: true,
      match: (value) => values.includes(value),
      describe: () => `one of ${JSON.stringify(values)}`,
    };
  },

  /** Negate a matcher */
  not(m: Matcher): Matcher {
    return {
      __isMatcher: true,
      match: (value) => !m.match(value),
      describe: () => `not ${m.describe()}`,
    };
  },

  /** Combine matchers with AND */
  allOf(...matchers: Matcher[]): Matcher {
    return {
      __isMatcher: true,
      match: (value) => matchers.every((m) => m.match(value)),
      describe: () => `all of [${matchers.map((m) => m.describe()).join(', ')}]`,
    };
  },

  /** Combine matchers with OR */
  anyOf(...matchers: Matcher[]): Matcher {
    return {
      __isMatcher: true,
      match: (value) => matchers.some((m) => m.match(value)),
      describe: () => `any of [${matchers.map((m) => m.describe()).join(', ')}]`,
    };
  },
};

/**
 * Match request against expected
 */
export function matchRequest(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  options?: MatcherOptions
): MatchResult {
  const matcher = new ContractMatcher(options);
  return matcher.match(expected, actual);
}

/**
 * Match response against expected
 */
export function matchResponse(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  options?: MatcherOptions
): MatchResult {
  const matcher = new ContractMatcher(options);
  return matcher.match(expected, actual);
}
