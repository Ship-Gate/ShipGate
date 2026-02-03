/**
 * @isl-lang/codegen-core - Deterministic Sorters
 *
 * Utilities for stable, deterministic sorting of imports and types.
 */

import type {
  ImportStatement,
  ImportGroupConfig,
  TypeDeclaration,
  TopologicalSortConfig,
  NamedImport,
} from './types.js';

// ============================================================================
// Import Sorting
// ============================================================================

/**
 * Import group types in order of output
 */
export type ImportGroup = 'external' | 'isl' | 'sibling' | 'parent' | 'unknown';

/**
 * Default import group patterns
 */
const DEFAULT_PATTERNS: Required<ImportGroupConfig['patterns']> = {
  external: /^[a-z@][^./]/,
  isl: /^@isl-lang\//,
  sibling: /^\.\//,
  parent: /^\.\.\//,
};

/**
 * Classify an import into a group
 */
export function classifyImport(
  moduleSpecifier: string,
  config?: ImportGroupConfig
): ImportGroup {
  const patterns = config?.patterns ?? DEFAULT_PATTERNS;

  if (patterns.isl?.test(moduleSpecifier)) return 'isl';
  if (patterns.sibling?.test(moduleSpecifier)) return 'sibling';
  if (patterns.parent?.test(moduleSpecifier)) return 'parent';
  if (patterns.external?.test(moduleSpecifier)) return 'external';

  return 'unknown';
}

/**
 * Sort imports deterministically
 *
 * Groups:
 * 1. External packages (alphabetical)
 * 2. ISL runtime packages (alphabetical)
 * 3. Parent imports (alphabetical)
 * 4. Sibling imports (alphabetical)
 *
 * Within each group, imports are sorted alphabetically by module specifier.
 * Named imports within each statement are also sorted alphabetically.
 */
export function sortImports(
  imports: ImportStatement[],
  config?: ImportGroupConfig
): ImportStatement[] {
  // Group imports
  const groups: Record<ImportGroup, ImportStatement[]> = {
    external: [],
    isl: [],
    parent: [],
    sibling: [],
    unknown: [],
  };

  for (const imp of imports) {
    const group = classifyImport(imp.moduleSpecifier, config);
    groups[group].push(imp);
  }

  // Sort within each group by module specifier
  const compareModuleSpecifier = (a: ImportStatement, b: ImportStatement) =>
    a.moduleSpecifier.localeCompare(b.moduleSpecifier);

  for (const group of Object.keys(groups) as ImportGroup[]) {
    groups[group].sort(compareModuleSpecifier);

    // Sort named imports within each statement
    for (const imp of groups[group]) {
      if (imp.namedImports) {
        imp.namedImports = sortNamedImports(imp.namedImports);
      }
    }
  }

  // Merge groups in order
  const result: ImportStatement[] = [];
  const groupOrder: ImportGroup[] = ['external', 'isl', 'parent', 'sibling', 'unknown'];

  for (const group of groupOrder) {
    result.push(...groups[group]);
  }

  return result;
}

/**
 * Sort named imports alphabetically
 */
export function sortNamedImports(imports: NamedImport[]): NamedImport[] {
  return [...imports].sort((a, b) => {
    // Type-only imports come first
    if (a.isTypeOnly !== b.isTypeOnly) {
      return a.isTypeOnly ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Deduplicate imports by merging statements for the same module
 */
export function deduplicateImports(imports: ImportStatement[]): ImportStatement[] {
  const byModule = new Map<string, ImportStatement>();

  for (const imp of imports) {
    const existing = byModule.get(imp.moduleSpecifier);

    if (!existing) {
      byModule.set(imp.moduleSpecifier, { ...imp });
      continue;
    }

    // Merge default imports (keep first non-null)
    if (!existing.defaultImport && imp.defaultImport) {
      existing.defaultImport = imp.defaultImport;
    }

    // Merge namespace imports (keep first non-null)
    if (!existing.namespaceImport && imp.namespaceImport) {
      existing.namespaceImport = imp.namespaceImport;
    }

    // Merge named imports
    if (imp.namedImports) {
      const existingNames = new Set(
        (existing.namedImports ?? []).map((n) => n.name)
      );
      const newImports = imp.namedImports.filter(
        (n) => !existingNames.has(n.name)
      );
      existing.namedImports = [...(existing.namedImports ?? []), ...newImports];
    }

    // Type-only: if either is not type-only, result is not type-only
    if (imp.isTypeOnly === false) {
      existing.isTypeOnly = false;
    }
  }

  return Array.from(byModule.values());
}

/**
 * Format import statements to code
 */
export function formatImports(
  imports: ImportStatement[],
  options: { singleQuote?: boolean; semi?: boolean } = {}
): string {
  const quote = options.singleQuote ? "'" : '"';
  const semi = options.semi !== false ? ';' : '';

  const lines: string[] = [];
  let lastGroup: ImportGroup | null = null;

  for (const imp of imports) {
    const group = classifyImport(imp.moduleSpecifier);

    // Add blank line between groups
    if (lastGroup !== null && lastGroup !== group) {
      lines.push('');
    }
    lastGroup = group;

    const parts: string[] = [];

    // Type-only prefix
    const typePrefix = imp.isTypeOnly ? 'type ' : '';

    // Default import
    if (imp.defaultImport) {
      parts.push(imp.defaultImport);
    }

    // Namespace import
    if (imp.namespaceImport) {
      parts.push(`* as ${imp.namespaceImport}`);
    }

    // Named imports
    if (imp.namedImports && imp.namedImports.length > 0) {
      const names = imp.namedImports.map((n) => {
        const typeKeyword = n.isTypeOnly && !imp.isTypeOnly ? 'type ' : '';
        return n.alias ? `${typeKeyword}${n.name} as ${n.alias}` : `${typeKeyword}${n.name}`;
      });
      parts.push(`{ ${names.join(', ')} }`);
    }

    if (parts.length === 0) {
      // Side-effect import
      lines.push(`import ${quote}${imp.moduleSpecifier}${quote}${semi}`);
    } else {
      lines.push(
        `import ${typePrefix}${parts.join(', ')} from ${quote}${imp.moduleSpecifier}${quote}${semi}`
      );
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Type Sorting (Topological)
// ============================================================================

/**
 * Topologically sort types so dependencies come before dependents
 *
 * Uses Kahn's algorithm with deterministic tie-breaking.
 */
export function topologicalSortTypes(
  types: TypeDeclaration[],
  config: TopologicalSortConfig = {}
): TypeDeclaration[] {
  const { tieBreaker = 'alphabetical', groupByKind = true } = config;

  // Group by kind if requested
  if (groupByKind) {
    const groups: Record<TypeDeclaration['kind'], TypeDeclaration[]> = {
      utility: [],
      enum: [],
      alias: [],
      interface: [],
      behavior: [],
    };

    for (const type of types) {
      groups[type.kind].push(type);
    }

    // Sort each group independently and concatenate
    const kindOrder: TypeDeclaration['kind'][] = [
      'utility',
      'enum',
      'alias',
      'interface',
      'behavior',
    ];

    const result: TypeDeclaration[] = [];
    for (const kind of kindOrder) {
      result.push(...topologicalSortSingleGroup(groups[kind], tieBreaker));
    }

    return result;
  }

  return topologicalSortSingleGroup(types, tieBreaker);
}

/**
 * Topological sort for a single group of types
 */
function topologicalSortSingleGroup(
  types: TypeDeclaration[],
  tieBreaker: 'alphabetical' | 'declaration-order'
): TypeDeclaration[] {
  if (types.length === 0) return [];

  // Build adjacency list and in-degree map
  const typeMap = new Map(types.map((t) => [t.name, t]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const type of types) {
    inDegree.set(type.name, 0);
    dependents.set(type.name, []);
  }

  for (const type of types) {
    for (const dep of type.dependencies) {
      if (typeMap.has(dep)) {
        inDegree.set(type.name, (inDegree.get(type.name) ?? 0) + 1);
        dependents.get(dep)?.push(type.name);
      }
    }
  }

  // Priority queue (array sorted on each pop for simplicity)
  const comparator = (a: TypeDeclaration, b: TypeDeclaration): number => {
    if (tieBreaker === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }
    return a.declarationOrder - b.declarationOrder;
  };

  const queue: TypeDeclaration[] = types
    .filter((t) => inDegree.get(t.name) === 0)
    .sort(comparator);

  const result: TypeDeclaration[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const depName of dependents.get(current.name) ?? []) {
      const newDegree = (inDegree.get(depName) ?? 1) - 1;
      inDegree.set(depName, newDegree);

      if (newDegree === 0) {
        const dep = typeMap.get(depName);
        if (dep) {
          // Insert in sorted position
          const insertIdx = queue.findIndex((q) => comparator(dep, q) < 0);
          if (insertIdx === -1) {
            queue.push(dep);
          } else {
            queue.splice(insertIdx, 0, dep);
          }
        }
      }
    }
  }

  // Check for cycles
  if (result.length !== types.length) {
    const remaining = types.filter((t) => !result.includes(t));
    console.warn(
      `Cyclic dependencies detected among: ${remaining.map((t) => t.name).join(', ')}`
    );
    // Add remaining types in tie-breaker order
    result.push(...remaining.sort(comparator));
  }

  return result;
}

// ============================================================================
// Property Sorting
// ============================================================================

/**
 * Sort object properties deterministically
 *
 * Default order:
 * 1. 'id' fields first
 * 2. Required fields before optional
 * 3. Alphabetical within each group
 */
export function sortProperties<T extends { name: string; optional?: boolean }>(
  properties: T[],
  options: {
    idFirst?: boolean;
    requiredFirst?: boolean;
    alphabetical?: boolean;
    customOrder?: string[];
  } = {}
): T[] {
  const {
    idFirst = true,
    requiredFirst = true,
    alphabetical = true,
    customOrder,
  } = options;

  return [...properties].sort((a, b) => {
    // Custom order takes precedence
    if (customOrder) {
      const aIdx = customOrder.indexOf(a.name);
      const bIdx = customOrder.indexOf(b.name);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
    }

    // ID fields first
    if (idFirst) {
      const aIsId = a.name === 'id' || a.name.endsWith('_id') || a.name.endsWith('Id');
      const bIsId = b.name === 'id' || b.name.endsWith('_id') || b.name.endsWith('Id');
      if (aIsId !== bIsId) return aIsId ? -1 : 1;
    }

    // Required before optional
    if (requiredFirst && a.optional !== b.optional) {
      return a.optional ? 1 : -1;
    }

    // Alphabetical
    if (alphabetical) {
      return a.name.localeCompare(b.name);
    }

    return 0;
  });
}
