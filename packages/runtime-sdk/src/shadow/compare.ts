/**
 * Shadow Mode Comparison
 * 
 * Utilities for comparing primary and shadow results.
 */

export interface CompareResult {
  equal: boolean;
  differences: Difference[];
}

export interface Difference {
  path: string;
  primary: unknown;
  shadow: unknown;
  type: 'missing' | 'extra' | 'type_mismatch' | 'value_mismatch';
}

export interface ComparatorOptions {
  /** Paths to ignore in comparison */
  ignorePaths?: string[];
  /** Paths to treat as equivalent if both present */
  equivalentPaths?: Array<[string, string]>;
  /** Custom value comparators by path */
  customComparators?: Record<string, (a: unknown, b: unknown) => boolean>;
  /** Ignore order in arrays */
  ignoreArrayOrder?: boolean;
  /** Numeric tolerance for floating point comparison */
  numericTolerance?: number;
}

/**
 * Deep equality comparator
 */
function deepEqual(primary: unknown, shadow: unknown): CompareResult {
  const differences: Difference[] = [];
  
  compareValues(primary, shadow, '', differences, {});
  
  return {
    equal: differences.length === 0,
    differences,
  };
}

/**
 * Configurable comparator
 */
function createComparator(options: ComparatorOptions = {}): (primary: unknown, shadow: unknown) => CompareResult {
  return (primary: unknown, shadow: unknown): CompareResult => {
    const differences: Difference[] = [];
    
    compareValues(primary, shadow, '', differences, options);
    
    return {
      equal: differences.length === 0,
      differences,
    };
  };
}

/**
 * Compare two values recursively
 */
function compareValues(
  primary: unknown,
  shadow: unknown,
  path: string,
  differences: Difference[],
  options: ComparatorOptions
): void {
  // Check if path should be ignored
  if (options.ignorePaths?.some(p => matchPath(path, p))) {
    return;
  }

  // Check for custom comparator
  if (options.customComparators?.[path]) {
    if (!options.customComparators[path]!(primary, shadow)) {
      differences.push({
        path,
        primary,
        shadow,
        type: 'value_mismatch',
      });
    }
    return;
  }

  // Handle null/undefined
  if (primary === null || primary === undefined) {
    if (shadow !== null && shadow !== undefined) {
      differences.push({
        path,
        primary,
        shadow,
        type: 'value_mismatch',
      });
    }
    return;
  }

  if (shadow === null || shadow === undefined) {
    differences.push({
      path,
      primary,
      shadow,
      type: 'value_mismatch',
    });
    return;
  }

  // Check types
  const primaryType = typeof primary;
  const shadowType = typeof shadow;

  if (primaryType !== shadowType) {
    differences.push({
      path,
      primary,
      shadow,
      type: 'type_mismatch',
    });
    return;
  }

  // Handle primitives
  if (primaryType !== 'object') {
    if (primaryType === 'number' && options.numericTolerance) {
      if (Math.abs((primary as number) - (shadow as number)) > options.numericTolerance) {
        differences.push({
          path,
          primary,
          shadow,
          type: 'value_mismatch',
        });
      }
    } else if (primary !== shadow) {
      differences.push({
        path,
        primary,
        shadow,
        type: 'value_mismatch',
      });
    }
    return;
  }

  // Handle arrays
  if (Array.isArray(primary)) {
    if (!Array.isArray(shadow)) {
      differences.push({
        path,
        primary,
        shadow,
        type: 'type_mismatch',
      });
      return;
    }

    if (options.ignoreArrayOrder) {
      compareArraysUnordered(primary, shadow, path, differences, options);
    } else {
      compareArraysOrdered(primary, shadow, path, differences, options);
    }
    return;
  }

  // Handle objects
  if (Array.isArray(shadow)) {
    differences.push({
      path,
      primary,
      shadow,
      type: 'type_mismatch',
    });
    return;
  }

  compareObjects(
    primary as Record<string, unknown>,
    shadow as Record<string, unknown>,
    path,
    differences,
    options
  );
}

/**
 * Compare objects
 */
function compareObjects(
  primary: Record<string, unknown>,
  shadow: Record<string, unknown>,
  path: string,
  differences: Difference[],
  options: ComparatorOptions
): void {
  const primaryKeys = new Set(Object.keys(primary));
  const shadowKeys = new Set(Object.keys(shadow));

  // Check for missing keys in shadow
  for (const key of primaryKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    
    if (!shadowKeys.has(key)) {
      // Check equivalent paths
      const equivalent = options.equivalentPaths?.find(([p, _s]) => p === keyPath);
      if (equivalent && shadow[equivalent[1].split('.').pop()!] !== undefined) {
        continue;
      }

      differences.push({
        path: keyPath,
        primary: primary[key],
        shadow: undefined,
        type: 'missing',
      });
    } else {
      compareValues(primary[key], shadow[key], keyPath, differences, options);
    }
  }

  // Check for extra keys in shadow
  for (const key of shadowKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    
    if (!primaryKeys.has(key)) {
      // Check equivalent paths
      const equivalent = options.equivalentPaths?.find(([_p, s]) => s === keyPath);
      if (equivalent && primary[equivalent[0].split('.').pop()!] !== undefined) {
        continue;
      }

      differences.push({
        path: keyPath,
        primary: undefined,
        shadow: shadow[key],
        type: 'extra',
      });
    }
  }
}

/**
 * Compare arrays in order
 */
function compareArraysOrdered(
  primary: unknown[],
  shadow: unknown[],
  path: string,
  differences: Difference[],
  options: ComparatorOptions
): void {
  const maxLength = Math.max(primary.length, shadow.length);

  for (let i = 0; i < maxLength; i++) {
    const itemPath = `${path}[${i}]`;
    
    if (i >= primary.length) {
      differences.push({
        path: itemPath,
        primary: undefined,
        shadow: shadow[i],
        type: 'extra',
      });
    } else if (i >= shadow.length) {
      differences.push({
        path: itemPath,
        primary: primary[i],
        shadow: undefined,
        type: 'missing',
      });
    } else {
      compareValues(primary[i], shadow[i], itemPath, differences, options);
    }
  }
}

/**
 * Compare arrays ignoring order
 */
function compareArraysUnordered(
  primary: unknown[],
  shadow: unknown[],
  path: string,
  differences: Difference[],
  options: ComparatorOptions
): void {
  if (primary.length !== shadow.length) {
    differences.push({
      path: `${path}.length`,
      primary: primary.length,
      shadow: shadow.length,
      type: 'value_mismatch',
    });
    return;
  }

  // For each item in primary, try to find a match in shadow
  const shadowMatched = new Set<number>();

  for (let i = 0; i < primary.length; i++) {
    let found = false;
    
    for (let j = 0; j < shadow.length; j++) {
      if (shadowMatched.has(j)) continue;
      
      const tempDiffs: Difference[] = [];
      compareValues(primary[i], shadow[j], '', tempDiffs, options);
      
      if (tempDiffs.length === 0) {
        shadowMatched.add(j);
        found = true;
        break;
      }
    }

    if (!found) {
      differences.push({
        path: `${path}[${i}]`,
        primary: primary[i],
        shadow: undefined,
        type: 'missing',
      });
    }
  }
}

/**
 * Match a path against a pattern (supports * wildcard)
 */
function matchPath(path: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(path);
}

/**
 * Comparator utilities
 */
export const comparator = {
  deepEqual,
  createComparator,
  
  /**
   * Compare ignoring specified fields
   */
  ignoring(...paths: string[]) {
    return createComparator({ ignorePaths: paths });
  },

  /**
   * Compare with numeric tolerance
   */
  withTolerance(tolerance: number) {
    return createComparator({ numericTolerance: tolerance });
  },

  /**
   * Compare arrays ignoring order
   */
  unorderedArrays() {
    return createComparator({ ignoreArrayOrder: true });
  },

  /**
   * Combine multiple options
   */
  custom(options: ComparatorOptions) {
    return createComparator(options);
  },
};
