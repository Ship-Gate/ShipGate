/**
 * ISL Standard Library - String Module
 * Provides string manipulation and validation operations
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 */

// ============================================
// Types
// ============================================

export type StringCase = 'LOWER' | 'UPPER' | 'TITLE' | 'SENTENCE' | 'CAMEL' | 'PASCAL' | 'SNAKE' | 'KEBAB';

export type TrimMode = 'BOTH' | 'START' | 'END';

export interface SplitResult {
  parts: string[];
  count: number;
}

export interface StringValidationResult {
  is_valid: boolean;
  error_message?: string;
  position?: number;
}

// ============================================
// Length Operations
// ============================================

export function length(value: string): number {
  return value.length;
}

export function isEmpty(value: string): boolean {
  return value.length === 0;
}

export function isBlank(value: string): boolean {
  return trim(value).length === 0;
}

// ============================================
// Case Operations
// ============================================

export function toLowerCase(value: string): string {
  return value.toLowerCase();
}

export function toUpperCase(value: string): string {
  return value.toUpperCase();
}

export function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

export function toCamelCase(value: string): string {
  return value
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

export function toPascalCase(value: string): string {
  const camel = toCamelCase(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function toSnakeCase(value: string): string {
  return value
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
    .replace(/^_/, '');
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z])/g, '-$1')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
    .replace(/^-/, '');
}

export function changeCase(value: string, targetCase: StringCase): string {
  switch (targetCase) {
    case 'LOWER': return toLowerCase(value);
    case 'UPPER': return toUpperCase(value);
    case 'TITLE': return toTitleCase(value);
    case 'SENTENCE': return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    case 'CAMEL': return toCamelCase(value);
    case 'PASCAL': return toPascalCase(value);
    case 'SNAKE': return toSnakeCase(value);
    case 'KEBAB': return toKebabCase(value);
    default: return value;
  }
}

// ============================================
// Trim Operations
// ============================================

export function trim(value: string): string {
  return value.trim();
}

export function trimStart(value: string): string {
  return value.trimStart();
}

export function trimEnd(value: string): string {
  return value.trimEnd();
}

export function trimChars(value: string, chars: string): string {
  const charSet = new Set(chars);
  let start = 0;
  let end = value.length;
  
  while (start < end && charSet.has(value.charAt(start))) start++;
  while (end > start && charSet.has(value.charAt(end - 1))) end--;
  
  return value.slice(start, end);
}

// ============================================
// Search Operations
// ============================================

export function contains(value: string, substring: string, caseSensitive = true): boolean {
  if (caseSensitive) {
    return value.includes(substring);
  }
  return value.toLowerCase().includes(substring.toLowerCase());
}

export function startsWith(value: string, prefix: string, caseSensitive = true): boolean {
  if (caseSensitive) {
    return value.startsWith(prefix);
  }
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}

export function endsWith(value: string, suffix: string, caseSensitive = true): boolean {
  if (caseSensitive) {
    return value.endsWith(suffix);
  }
  return value.toLowerCase().endsWith(suffix.toLowerCase());
}

export function indexOf(value: string, substring: string, startIndex = 0, caseSensitive = true): number {
  if (startIndex < 0 || startIndex > value.length) {
    throw new Error('INVALID_START_INDEX: Start index is out of bounds');
  }
  if (caseSensitive) {
    return value.indexOf(substring, startIndex);
  }
  return value.toLowerCase().indexOf(substring.toLowerCase(), startIndex);
}

export function lastIndexOf(value: string, substring: string, caseSensitive = true): number {
  if (caseSensitive) {
    return value.lastIndexOf(substring);
  }
  return value.toLowerCase().lastIndexOf(substring.toLowerCase());
}

// ============================================
// Manipulation Operations
// ============================================

export function substring(value: string, start: number, len?: number): string {
  if (start < 0 || start > value.length) {
    throw new Error('INDEX_OUT_OF_BOUNDS: Start index exceeds string length');
  }
  if (len !== undefined) {
    return value.substring(start, start + len);
  }
  return value.substring(start);
}

export function slice(value: string, start: number, end?: number): string {
  return value.slice(start, end);
}

export function replace(value: string, search: string, replacement: string): string {
  if (search.length === 0) {
    throw new Error('Search string cannot be empty');
  }
  return value.replace(search, replacement);
}

export function replaceAll(value: string, search: string, replacement: string): string {
  if (search.length === 0) {
    throw new Error('Search string cannot be empty');
  }
  return value.split(search).join(replacement);
}

export function split(value: string, delimiter: string, limit?: number): SplitResult {
  if (delimiter.length === 0) {
    throw new Error('Delimiter cannot be empty');
  }
  const parts = value.split(delimiter, limit);
  return { parts, count: parts.length };
}

export function join(parts: string[], delimiter = ''): string {
  return parts.join(delimiter);
}

export function concat(...parts: string[]): string {
  return parts.join('');
}

export function repeat(value: string, count: number): string {
  if (count < 0 || count > 10000) {
    throw new Error('Count must be between 0 and 10000');
  }
  return value.repeat(count);
}

export function padStart(value: string, targetLength: number, fill = ' '): string {
  if (fill.length === 0) {
    throw new Error('Fill string cannot be empty');
  }
  return value.padStart(targetLength, fill);
}

export function padEnd(value: string, targetLength: number, fill = ' '): string {
  if (fill.length === 0) {
    throw new Error('Fill string cannot be empty');
  }
  return value.padEnd(targetLength, fill);
}

export function reverse(value: string): string {
  return [...value].reverse().join('');
}

export function charAt(value: string, index: number): string {
  if (index < 0 || index >= value.length) {
    throw new Error('INDEX_OUT_OF_BOUNDS: Index exceeds string length');
  }
  return value.charAt(index);
}

export function charCodeAt(value: string, index: number): number {
  if (index < 0 || index >= value.length) {
    throw new Error('INDEX_OUT_OF_BOUNDS: Index exceeds string length');
  }
  return value.charCodeAt(index);
}

export function fromCharCode(codes: number[]): string {
  return String.fromCharCode(...codes);
}

// ============================================
// Validation Operations
// ============================================

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const URL_REGEX = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;
const PHONE_E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value) && value.length <= 254;
}

export function isValidUrl(value: string, requireHttps = false): boolean {
  if (requireHttps && !value.startsWith('https://')) {
    return false;
  }
  return URL_REGEX.test(value);
}

export function isValidPhone(value: string): boolean {
  return PHONE_E164_REGEX.test(value);
}

export function matchesPattern(value: string, pattern: string, flags = ''): boolean {
  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(value);
  } catch {
    throw new Error('INVALID_PATTERN: Regex pattern is invalid');
  }
}

export function isAlpha(value: string): boolean {
  return /^[a-zA-Z]*$/.test(value);
}

export function isAlphanumeric(value: string): boolean {
  return /^[a-zA-Z0-9]*$/.test(value);
}

export function isNumeric(value: string): boolean {
  return /^[0-9]*$/.test(value);
}

export function isHexadecimal(value: string): boolean {
  return /^[0-9a-fA-F]*$/.test(value);
}

export function isLowerCase(value: string): boolean {
  return value === value.toLowerCase();
}

export function isUpperCase(value: string): boolean {
  return value === value.toUpperCase();
}

// ============================================
// Constants
// ============================================

export const EMPTY = '';
export const SPACE = ' ';
export const NEWLINE = '\n';
export const TAB = '\t';
export const CRLF = '\r\n';

// ============================================
// Default Export
// ============================================

export const String = {
  length,
  isEmpty,
  isBlank,
  toLowerCase,
  toUpperCase,
  toTitleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toKebabCase,
  changeCase,
  trim,
  trimStart,
  trimEnd,
  trimChars,
  contains,
  startsWith,
  endsWith,
  indexOf,
  lastIndexOf,
  substring,
  slice,
  replace,
  replaceAll,
  split,
  join,
  concat,
  repeat,
  padStart,
  padEnd,
  reverse,
  charAt,
  charCodeAt,
  fromCharCode,
  isValidEmail,
  isValidUrl,
  isValidPhone,
  matchesPattern,
  isAlpha,
  isAlphanumeric,
  isNumeric,
  isHexadecimal,
  isLowerCase,
  isUpperCase,
  EMPTY,
  SPACE,
  NEWLINE,
  TAB,
  CRLF,
};

export default String;
