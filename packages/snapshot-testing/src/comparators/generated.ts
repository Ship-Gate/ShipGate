/**
 * Generated Code Comparator
 * 
 * Specialized comparison for generated TypeScript/JavaScript code.
 * Handles formatting differences and generated metadata.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Generated code comparison options */
export interface GeneratedCompareOptions {
  /** Ignore whitespace and formatting differences */
  ignoreFormatting?: boolean;
  /** Ignore generated metadata comments */
  ignoreGeneratedComments?: boolean;
  /** Ignore timestamps in comments */
  ignoreTimestamps?: boolean;
  /** Ignore import order */
  ignoreImportOrder?: boolean;
  /** Ignore trailing whitespace */
  ignoreTrailingWhitespace?: boolean;
  /** File extension for syntax-aware comparison */
  extension?: string;
  /** Custom normalization function */
  normalizer?: (content: string) => string;
}

/** Code difference */
export interface CodeDiff {
  type: 'added' | 'removed' | 'changed';
  lineNumber: number;
  expected?: string;
  actual?: string;
  context?: string;
}

/** Generated code comparison result */
export interface GeneratedCompareResult {
  match: boolean;
  differences: CodeDiff[];
  addedLines: number;
  removedLines: number;
  changedLines: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove generated metadata comments
 */
export function removeGeneratedComments(content: string): string {
  const patterns = [
    // Auto-generated headers
    /\/\*\*?\s*\n?\s*\*?\s*Auto-generated[\s\S]*?\*\//gi,
    /\/\*\*?\s*\n?\s*\*?\s*Generated[\s\S]*?\*\//gi,
    /\/\*\*?\s*\n?\s*\*?\s*DO NOT EDIT[\s\S]*?\*\//gi,
    // Single-line generated comments
    /\/\/\s*Auto-generated.*$/gm,
    /\/\/\s*Generated.*$/gm,
    /\/\/\s*DO NOT EDIT.*$/gm,
  ];

  let result = content;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * Remove timestamps from content
 */
export function removeTimestamps(content: string): string {
  const patterns = [
    // ISO timestamps
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g,
    // Date strings
    /Generated:\s*[A-Za-z]+\s+\d{1,2},?\s+\d{4}/gi,
    // Time strings
    /at\s+\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi,
  ];

  let result = content;
  for (const pattern of patterns) {
    result = result.replace(pattern, '[TIMESTAMP]');
  }
  return result;
}

/**
 * Normalize imports
 */
export function normalizeImports(content: string): string {
  // Extract import statements
  const importRegex = /^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm;
  const imports: string[] = [];
  let nonImportContent = content;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[0].trim());
  }
  
  nonImportContent = content.replace(importRegex, '').trim();

  // Sort imports
  imports.sort();

  // Reconstruct
  if (imports.length > 0) {
    return imports.join('\n') + '\n\n' + nonImportContent;
  }
  return nonImportContent;
}

/**
 * Normalize whitespace and formatting
 */
export function normalizeFormatting(content: string): string {
  return content
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove trailing whitespace
    .replace(/[ \t]+$/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Normalize indentation (convert tabs to 2 spaces)
    .replace(/\t/g, '  ')
    // Trim
    .trim();
}

/**
 * Normalize TypeScript code
 */
export function normalizeTypescript(content: string, options: GeneratedCompareOptions = {}): string {
  let normalized = content;

  if (options.ignoreGeneratedComments) {
    normalized = removeGeneratedComments(normalized);
  }

  if (options.ignoreTimestamps) {
    normalized = removeTimestamps(normalized);
  }

  if (options.ignoreImportOrder) {
    normalized = normalizeImports(normalized);
  }

  if (options.ignoreFormatting) {
    normalized = normalizeFormatting(normalized);
  }

  if (options.ignoreTrailingWhitespace) {
    normalized = normalized.replace(/[ \t]+$/gm, '');
  }

  if (options.normalizer) {
    normalized = options.normalizer(normalized);
  }

  return normalized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two code strings line by line
 */
export function compareLines(expected: string, actual: string): CodeDiff[] {
  const diffs: CodeDiff[] = [];
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  
  const maxLen = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < maxLen; i++) {
    const expectedLine = expectedLines[i];
    const actualLine = actualLines[i];

    if (expectedLine === undefined) {
      diffs.push({
        type: 'added',
        lineNumber: i + 1,
        actual: actualLine,
      });
    } else if (actualLine === undefined) {
      diffs.push({
        type: 'removed',
        lineNumber: i + 1,
        expected: expectedLine,
      });
    } else if (expectedLine !== actualLine) {
      diffs.push({
        type: 'changed',
        lineNumber: i + 1,
        expected: expectedLine,
        actual: actualLine,
      });
    }
  }

  return diffs;
}

/**
 * Compare generated code
 */
export function compareGenerated(
  expected: string,
  actual: string,
  options: GeneratedCompareOptions = {}
): GeneratedCompareResult {
  // Normalize both
  const normalizedExpected = normalizeTypescript(expected, options);
  const normalizedActual = normalizeTypescript(actual, options);

  // Compare
  const differences = compareLines(normalizedExpected, normalizedActual);

  return {
    match: differences.length === 0,
    differences,
    addedLines: differences.filter(d => d.type === 'added').length,
    removedLines: differences.filter(d => d.type === 'removed').length,
    changedLines: differences.filter(d => d.type === 'changed').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Serializers and Comparators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create generated code serializer
 */
export function createGeneratedSerializer(options: GeneratedCompareOptions = {}): (value: unknown) => string {
  return (value: unknown) => {
    if (typeof value !== 'string') {
      throw new Error('Generated code serializer expects string input');
    }
    return normalizeTypescript(value, options);
  };
}

/**
 * Create generated code comparator
 */
export function createGeneratedComparator(options: GeneratedCompareOptions = {}): (expected: string, actual: string) => boolean {
  return (expected: string, actual: string) => {
    const result = compareGenerated(expected, actual, options);
    return result.match;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// File Type Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect file type from extension
 */
export function detectFileType(filename: string): 'typescript' | 'javascript' | 'json' | 'other' {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
    return 'typescript';
  }
  if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.mjs')) {
    return 'javascript';
  }
  if (filename.endsWith('.json')) {
    return 'json';
  }
  return 'other';
}

/**
 * Get appropriate normalizer for file type
 */
export function getNormalizerForFile(
  filename: string,
  options: GeneratedCompareOptions = {}
): (content: string) => string {
  const type = detectFileType(filename);
  
  switch (type) {
    case 'typescript':
    case 'javascript':
      return (content: string) => normalizeTypescript(content, options);
    case 'json':
      return (content: string) => {
        try {
          return JSON.stringify(JSON.parse(content), null, 2);
        } catch {
          return content;
        }
      };
    default:
      return (content: string) => normalizeFormatting(content);
  }
}
