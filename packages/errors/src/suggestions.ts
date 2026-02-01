// ============================================================================
// ISL Error Suggestions
// ============================================================================
//
// Provides intelligent suggestions for common errors using string similarity
// and context-aware recommendations.
//
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits (insertions,
 * deletions, or substitutions) required to transform one string into another.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Handle edge cases
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create distance matrix
  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,      // deletion
        matrix[i]![j - 1]! + 1,      // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

/**
 * Calculate Damerau-Levenshtein distance (includes transpositions).
 * More accurate for detecting typos like "teh" -> "the".
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      
      let min = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );

      // Check for transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        min = Math.min(min, matrix[i - 2]![j - 2]! + cost);
      }

      matrix[i]![j] = min;
    }
  }

  return matrix[a.length]![b.length]!;
}

/**
 * Options for finding similar strings
 */
export interface SuggestionOptions {
  /** Maximum edit distance to consider (default: 3) */
  maxDistance?: number;
  /** Maximum number of suggestions to return (default: 3) */
  maxSuggestions?: number;
  /** Case-insensitive comparison (default: true) */
  caseInsensitive?: boolean;
  /** Use Damerau-Levenshtein (includes transpositions) (default: true) */
  includeTranspositions?: boolean;
}

const DEFAULT_OPTIONS: Required<SuggestionOptions> = {
  maxDistance: 3,
  maxSuggestions: 3,
  caseInsensitive: true,
  includeTranspositions: true,
};

/**
 * Suggestion result with distance information
 */
export interface Suggestion {
  /** The suggested value */
  value: string;
  /** Edit distance from the input */
  distance: number;
}

/**
 * Find similar strings from a list of candidates.
 * Returns suggestions sorted by edit distance (closest first).
 */
export function findSimilar(
  input: string,
  candidates: string[],
  options: SuggestionOptions = {}
): Suggestion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const distanceFn = opts.includeTranspositions 
    ? damerauLevenshteinDistance 
    : levenshteinDistance;

  const normalizedInput = opts.caseInsensitive ? input.toLowerCase() : input;
  
  const suggestions: Suggestion[] = [];
  
  for (const candidate of candidates) {
    const normalizedCandidate = opts.caseInsensitive 
      ? candidate.toLowerCase() 
      : candidate;
    
    const distance = distanceFn(normalizedInput, normalizedCandidate);
    
    if (distance <= opts.maxDistance && distance > 0) {
      suggestions.push({ value: candidate, distance });
    }
  }

  // Sort by distance, then alphabetically for ties
  suggestions.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.value.localeCompare(b.value);
  });

  return suggestions.slice(0, opts.maxSuggestions);
}

/**
 * Format a "Did you mean?" message for a single suggestion.
 */
export function formatDidYouMean(input: string, suggestion: string): string {
  return `Did you mean '${suggestion}'?`;
}

/**
 * Format a "Did you mean?" message for multiple suggestions.
 */
export function formatDidYouMeanMultiple(input: string, suggestions: string[]): string {
  if (suggestions.length === 0) {
    return '';
  }
  if (suggestions.length === 1) {
    return formatDidYouMean(input, suggestions[0]!);
  }
  const last = suggestions.pop();
  return `Did you mean ${suggestions.map(s => `'${s}'`).join(', ')} or '${last}'?`;
}

// ============================================================================
// ISL-SPECIFIC SUGGESTIONS
// ============================================================================

/**
 * ISL keywords for typo detection
 */
export const ISL_KEYWORDS = [
  'domain', 'entity', 'behavior', 'type', 'enum', 'view', 'policy',
  'input', 'output', 'preconditions', 'postconditions', 'invariants',
  'scenarios', 'chaos', 'temporal', 'security', 'lifecycle', 'fields',
  'effects', 'events', 'version', 'description', 'import', 'export',
  'from', 'as', 'extends', 'implements', 'where', 'with', 'for',
  'if', 'else', 'match', 'when', 'then', 'and', 'or', 'not',
  'true', 'false', 'null', 'old', 'result', 'forall', 'exists',
  'unique', 'some', 'none', 'all', 'any', 'let', 'in',
];

/**
 * ISL built-in types
 */
export const ISL_BUILTIN_TYPES = [
  'String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp', 'Duration',
  'Date', 'Time', 'DateTime', 'Email', 'URL', 'PhoneNumber',
  'List', 'Set', 'Map', 'Optional', 'Result', 'Either',
  'Void', 'Never', 'Unknown', 'Any',
];

/**
 * Find keyword suggestions for a mistyped keyword.
 */
export function suggestKeyword(input: string): Suggestion[] {
  return findSimilar(input, ISL_KEYWORDS, { caseInsensitive: true });
}

/**
 * Find type suggestions for a mistyped type name.
 */
export function suggestType(input: string, customTypes: string[] = []): Suggestion[] {
  return findSimilar(input, [...ISL_BUILTIN_TYPES, ...customTypes], { 
    caseInsensitive: false, // Types are case-sensitive
    maxDistance: 3,
  });
}

/**
 * Find field suggestions for a mistyped field name.
 */
export function suggestField(input: string, availableFields: string[]): Suggestion[] {
  return findSimilar(input, availableFields, { caseInsensitive: false });
}

/**
 * Find entity suggestions for a mistyped entity name.
 */
export function suggestEntity(input: string, availableEntities: string[]): Suggestion[] {
  return findSimilar(input, availableEntities, { caseInsensitive: false });
}

/**
 * Find behavior suggestions for a mistyped behavior name.
 */
export function suggestBehavior(input: string, availableBehaviors: string[]): Suggestion[] {
  return findSimilar(input, availableBehaviors, { caseInsensitive: false });
}

// ============================================================================
// CONTEXTUAL HELP SUGGESTIONS
// ============================================================================

/**
 * Common error patterns and their fixes
 */
export interface ErrorPattern {
  /** Pattern identifier */
  id: string;
  /** Condition to match */
  match: (errorCode: string, message: string, context: Record<string, unknown>) => boolean;
  /** Generate help message */
  help: (context: Record<string, unknown>) => string;
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: 'missing_colon',
    match: (code, message) => code === 'E0101' && message.includes("expected ':'"),
    help: () => 'Field declarations require a colon between the name and type: fieldName: Type',
  },
  {
    id: 'lowercase_type',
    match: (code, message, ctx) => {
      const typeName = ctx['typeName'] as string | undefined;
      return code === 'E0201' && !!typeName && /^[a-z]/.test(typeName);
    },
    help: (ctx) => {
      const typeName = ctx['typeName'] as string;
      const capitalized = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      return `Type names start with uppercase. Did you mean '${capitalized}'?`;
    },
  },
  {
    id: 'common_typos',
    match: (code) => code === 'E0100' || code === 'E0102',
    help: () => 'Check for typos in keywords. Common mistakes: entiy→entity, behaviur→behavior',
  },
  {
    id: 'old_in_precondition',
    match: (code) => code === 'E0304',
    help: () => 'old() captures pre-execution state and only makes sense in postconditions. In preconditions, just reference values directly.',
  },
  {
    id: 'unclosed_block',
    match: (code) => code === 'E0105' || code === 'E0118',
    help: () => 'Every { must have a matching }. Check for missing closing braces in nested blocks.',
  },
];

/**
 * Get contextual help for an error.
 */
export function getContextualHelp(
  errorCode: string,
  message: string,
  context: Record<string, unknown> = {}
): string[] {
  const helps: string[] = [];
  
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.match(errorCode, message, context)) {
      helps.push(pattern.help(context));
    }
  }
  
  return helps;
}
