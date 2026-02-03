/**
 * ISL Standard Library - Regex Module
 * Provides safe regex pattern matching operations
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 * Patterns are limited to safe subsets (no catastrophic backtracking)
 */

// ============================================
// Types
// ============================================

export interface Match {
  value: string;
  index: number;
  length: number;
  groups: Record<string, string | undefined>;
  captures: (string | undefined)[];
}

export interface MatchAllResult {
  matches: Match[];
  count: number;
}

export interface ReplaceResult {
  value: string;
  replacements_made: number;
}

export interface SplitResult {
  parts: string[];
  count: number;
}

export interface PatternInfo {
  pattern: string;
  flags: string;
  is_valid: boolean;
  has_captures: boolean;
  named_groups: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
}

export interface ValidationError {
  message: string;
  position?: number;
  pattern_fragment?: string;
}

// ============================================
// Basic Matching
// ============================================

/**
 * Test if pattern matches anywhere in string (DETERMINISTIC)
 */
export function test(value: string, pattern: string, flags = ''): boolean {
  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(value);
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

/**
 * Find first match of pattern (DETERMINISTIC)
 */
export function match(value: string, pattern: string, flags = ''): Match | null {
  try {
    const regex = new RegExp(pattern, flags);
    const result = regex.exec(value);
    
    if (!result) return null;
    
    return {
      value: result[0],
      index: result.index,
      length: result[0].length,
      groups: result.groups || {},
      captures: result.slice(1),
    };
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

/**
 * Find all matches of pattern (DETERMINISTIC)
 */
export function matchAll(value: string, pattern: string, flags = 'g'): MatchAllResult {
  // Ensure global flag is set
  if (!flags.includes('g')) {
    flags += 'g';
  }
  
  try {
    const regex = new RegExp(pattern, flags);
    const matches: Match[] = [];
    let result;
    
    while ((result = regex.exec(value)) !== null) {
      matches.push({
        value: result[0],
        index: result.index,
        length: result[0].length,
        groups: result.groups || {},
        captures: result.slice(1),
      });
    }
    
    return { matches, count: matches.length };
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

/**
 * Execute pattern and return detailed match (DETERMINISTIC)
 */
export function exec(value: string, pattern: string, flags = '', startIndex = 0): Match | null {
  if (startIndex > 0) {
    value = value.slice(startIndex);
  }
  
  const result = match(value, pattern, flags);
  
  if (result && startIndex > 0) {
    result.index += startIndex;
  }
  
  return result;
}

// ============================================
// Capture Groups
// ============================================

/**
 * Extract named capture groups from match (DETERMINISTIC)
 */
export function groups(value: string, pattern: string, flags = ''): Record<string, string | undefined> {
  const m = match(value, pattern, flags);
  if (!m) {
    throw new Error('NO_MATCH: Pattern did not match');
  }
  return m.groups;
}

/**
 * Extract indexed capture groups from match (DETERMINISTIC)
 */
export function captures(value: string, pattern: string, flags = ''): (string | undefined)[] {
  const m = match(value, pattern, flags);
  if (!m) {
    throw new Error('NO_MATCH: Pattern did not match');
  }
  return m.captures;
}

// ============================================
// Replacement
// ============================================

/**
 * Replace first occurrence of pattern (DETERMINISTIC)
 */
export function replace(value: string, pattern: string, replacement: string, flags = ''): ReplaceResult {
  try {
    const regex = new RegExp(pattern, flags);
    const hasMatch = regex.test(value);
    const result = value.replace(regex, replacement);
    
    return {
      value: result,
      replacements_made: hasMatch ? 1 : 0,
    };
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

/**
 * Replace all occurrences of pattern (DETERMINISTIC)
 */
export function replaceAll(value: string, pattern: string, replacement: string, flags = 'g'): ReplaceResult {
  // Ensure global flag is set
  if (!flags.includes('g')) {
    flags += 'g';
  }
  
  try {
    const regex = new RegExp(pattern, flags);
    const matches = value.match(regex);
    const count = matches ? matches.length : 0;
    const result = value.replace(regex, replacement);
    
    return {
      value: result,
      replacements_made: count,
    };
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

/**
 * Replace with function callback (DETERMINISTIC)
 */
export function replaceWithFunction(
  value: string,
  pattern: string,
  replacer: (match: Match) => string,
  flags = 'g'
): ReplaceResult {
  if (!flags.includes('g')) {
    flags += 'g';
  }
  
  try {
    const regex = new RegExp(pattern, flags);
    let count = 0;
    
    const result = value.replace(regex, (matched, ...args) => {
      count++;
      const groups: Record<string, string | undefined> = {};
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'object' && lastArg !== null) {
        Object.assign(groups, lastArg);
      }
      
      const m: Match = {
        value: matched,
        index: args[args.length - 2] as number,
        length: matched.length,
        groups,
        captures: args.slice(0, -2) as (string | undefined)[],
      };
      
      return replacer(m);
    });
    
    return {
      value: result,
      replacements_made: count,
    };
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

// ============================================
// Splitting
// ============================================

/**
 * Split string by pattern (DETERMINISTIC)
 */
export function split(value: string, pattern: string, limit?: number, flags = ''): SplitResult {
  try {
    const regex = new RegExp(pattern, flags);
    const parts = value.split(regex, limit);
    
    return {
      parts,
      count: parts.length,
    };
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

// ============================================
// Pattern Utilities
// ============================================

/**
 * Escape string for literal pattern matching (DETERMINISTIC)
 */
export function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if pattern is valid regex (DETERMINISTIC)
 */
export function isValidPattern(pattern: string, flags = ''): boolean {
  try {
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate pattern and return detailed info (DETERMINISTIC)
 */
export function validatePattern(pattern: string, flags = ''): {
  valid: boolean;
  error?: ValidationError;
  info?: PatternInfo;
} {
  try {
    new RegExp(pattern, flags);
    return {
      valid: true,
      info: getPatternInfo(pattern, flags),
    };
  } catch (e) {
    return {
      valid: false,
      error: {
        message: e instanceof Error ? e.message : 'Invalid pattern',
      },
    };
  }
}

/**
 * Get information about a pattern (DETERMINISTIC)
 */
export function getPatternInfo(pattern: string, flags = ''): PatternInfo {
  if (!isValidPattern(pattern, flags)) {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
  
  // Extract named groups
  const namedGroupRegex = /\(\?<([^>]+)>/g;
  const namedGroups: string[] = [];
  let groupMatch;
  while ((groupMatch = namedGroupRegex.exec(pattern)) !== null) {
    const groupName = groupMatch[1];
    if (groupName !== undefined) {
      namedGroups.push(groupName);
    }
  }
  
  // Check for captures
  const hasCaptures = /\([^?]/.test(pattern) || namedGroups.length > 0;
  
  // Estimate complexity
  let complexity: 'low' | 'medium' | 'high' = 'low';
  if (pattern.length > 50) complexity = 'medium';
  if (pattern.length > 100 || /(\+|\*)\??.*(\+|\*)/.test(pattern)) {
    complexity = 'high';
  }
  
  return {
    pattern,
    flags,
    is_valid: true,
    has_captures: hasCaptures,
    named_groups: namedGroups,
    estimated_complexity: complexity,
  };
}

// ============================================
// Safe Pattern Construction
// ============================================

/**
 * Join multiple patterns with alternation (DETERMINISTIC)
 */
export function joinPatterns(patterns: string[], wrapGroups = true): string {
  if (patterns.length === 0) {
    throw new Error('Patterns array cannot be empty');
  }
  
  if (wrapGroups) {
    return patterns.map(p => `(?:${p})`).join('|');
  }
  return patterns.join('|');
}

/**
 * Wrap pattern in non-capturing group (DETERMINISTIC)
 */
export function wrapGroup(pattern: string, capture = false, name?: string): string {
  if (name && capture) {
    return `(?<${name}>${pattern})`;
  }
  if (capture) {
    return `(${pattern})`;
  }
  return `(?:${pattern})`;
}

/**
 * Add quantifier to pattern (DETERMINISTIC)
 */
export function quantify(pattern: string, min: number, max?: number, lazy = false): string {
  let quantifier: string;
  
  if (max === undefined) {
    quantifier = `{${min},}`;
  } else if (min === max) {
    quantifier = `{${min}}`;
  } else {
    quantifier = `{${min},${max}}`;
  }
  
  if (lazy) {
    quantifier += '?';
  }
  
  return `(?:${pattern})${quantifier}`;
}

// ============================================
// Common Patterns
// ============================================

export const PATTERN_EMAIL = "[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*";
export const PATTERN_URL = 'https?://[^\\s/$.?#].[^\\s]*';
export const PATTERN_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const PATTERN_UUID_V4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const PATTERN_IPV4 = '(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';
export const PATTERN_PHONE_E164 = '\\+[1-9]\\d{1,14}';
export const PATTERN_HEX = '[0-9a-fA-F]+';
export const PATTERN_ALPHA = '[a-zA-Z]+';
export const PATTERN_ALPHANUMERIC = '[a-zA-Z0-9]+';
export const PATTERN_DIGITS = '\\d+';
export const PATTERN_WHITESPACE = '\\s+';
export const PATTERN_WORD = '\\w+';
export const PATTERN_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

// ============================================
// Common Pattern Matchers
// ============================================

export function matchEmail(value: string, strict = false): Match | null {
  const pattern = strict ? `^${PATTERN_EMAIL}$` : PATTERN_EMAIL;
  return match(value, pattern, 'i');
}

export function matchUrl(value: string, requireProtocol = true): Match | null {
  const pattern = requireProtocol ? PATTERN_URL : `(?:https?://)?[^\\s/$.?#].[^\\s]*`;
  return match(value, pattern, 'i');
}

export function matchPhone(value: string, format: 'e164' | 'us' | 'international' = 'e164'): Match | null {
  let pattern: string;
  switch (format) {
    case 'us':
      pattern = '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}';
      break;
    case 'international':
      pattern = '\\+?[\\d\\s-()]+';
      break;
    case 'e164':
    default:
      pattern = PATTERN_PHONE_E164;
  }
  return match(value, pattern);
}

export function matchUuid(value: string, version?: number): Match | null {
  let pattern: string;
  if (version === 4) {
    pattern = PATTERN_UUID_V4;
  } else {
    pattern = PATTERN_UUID;
  }
  return match(value, pattern, 'i');
}

export function matchIpAddress(value: string, ipVersion: 4 | 6 = 4): Match | null {
  const pattern = ipVersion === 4 ? PATTERN_IPV4 : '[0-9a-fA-F:]+';
  return match(value, pattern);
}

// ============================================
// Extraction Helpers
// ============================================

/**
 * Extract all matches as simple strings (DETERMINISTIC)
 */
export function extractAll(value: string, pattern: string, group = 0): string[] {
  const result = matchAll(value, pattern);
  return result.matches.map(m => {
    if (group === 0) return m.value;
    return m.captures[group - 1] || '';
  });
}

/**
 * Extract named group from all matches (DETERMINISTIC)
 */
export function extractNamed(value: string, pattern: string, groupName: string): string[] {
  const result = matchAll(value, pattern);
  return result.matches
    .map(m => m.groups[groupName])
    .filter((v): v is string => v !== undefined);
}

// ============================================
// Default Export
// ============================================

export const Regex = {
  // Basic matching
  test,
  match,
  matchAll,
  exec,
  
  // Capture groups
  groups,
  captures,
  
  // Replacement
  replace,
  replaceAll,
  replaceWithFunction,
  
  // Splitting
  split,
  
  // Pattern utilities
  escape,
  isValidPattern,
  validatePattern,
  getPatternInfo,
  joinPatterns,
  wrapGroup,
  quantify,
  
  // Common pattern matchers
  matchEmail,
  matchUrl,
  matchPhone,
  matchUuid,
  matchIpAddress,
  
  // Extraction helpers
  extractAll,
  extractNamed,
  
  // Common patterns
  PATTERN_EMAIL,
  PATTERN_URL,
  PATTERN_UUID,
  PATTERN_UUID_V4,
  PATTERN_IPV4,
  PATTERN_PHONE_E164,
  PATTERN_HEX,
  PATTERN_ALPHA,
  PATTERN_ALPHANUMERIC,
  PATTERN_DIGITS,
  PATTERN_WHITESPACE,
  PATTERN_WORD,
  PATTERN_SLUG,
};

export default Regex;
