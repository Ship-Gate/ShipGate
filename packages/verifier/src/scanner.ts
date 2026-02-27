// ============================================================================
// Workspace Scanner - Scan codebase for evidence artifacts
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  WorkspaceScanArtifacts,
  TestFileInfo,
  BindingInfo,
  AssertionInfo,
} from './types';

/**
 * Default patterns for test files
 */
const DEFAULT_TEST_PATTERNS = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.test.js',
  '**/*.spec.js',
  '**/test/**/*.ts',
  '**/tests/**/*.ts',
  '**/__tests__/**/*.ts',
];

/**
 * Default patterns for implementation files
 */
const DEFAULT_IMPL_PATTERNS = [
  '**/src/**/*.ts',
  '**/lib/**/*.ts',
  '!**/*.test.ts',
  '!**/*.spec.ts',
  '!**/node_modules/**',
];

/**
 * Scanner options
 */
export interface ScannerOptions {
  workspaceRoot: string;
  testPatterns?: string[];
  implPatterns?: string[];
}

/**
 * Scan workspace for verification artifacts
 * Returns deterministic results (stable ordering)
 */
export function scanWorkspace(options: ScannerOptions): WorkspaceScanArtifacts {
  const { workspaceRoot } = options;
  const testPatterns = options.testPatterns ?? DEFAULT_TEST_PATTERNS;
  const implPatterns = options.implPatterns ?? DEFAULT_IMPL_PATTERNS;

  // Find test files
  const testFiles = findTestFiles(workspaceRoot, testPatterns);
  
  // Find implementation bindings
  const bindings = findBindings(workspaceRoot, implPatterns);
  
  // Extract assertions from test files
  const assertions = extractAssertions(workspaceRoot, testFiles);

  // Sort all arrays for deterministic output
  return {
    testFiles: sortByPath(testFiles),
    bindings: sortByFileAndLine(bindings),
    assertions: sortByFileAndLine(assertions),
  };
}

/**
 * Find test files matching patterns
 */
function findTestFiles(root: string, patterns: string[]): TestFileInfo[] {
  const testFiles: TestFileInfo[] = [];
  const files = findFiles(root, patterns);

  for (const filePath of files) {
    const relPath = path.relative(root, filePath);
    const content = safeReadFile(filePath);
    if (!content) continue;

    const framework = detectTestFramework(content);
    const { suites, tests } = extractTestNames(content);

    testFiles.push({
      path: normalizePathSeparators(relPath),
      framework,
      testCount: tests.length,
      suites,
      tests,
    });
  }

  return testFiles;
}

/**
 * Find implementation bindings
 */
function findBindings(root: string, patterns: string[]): BindingInfo[] {
  const bindings: BindingInfo[] = [];
  const files = findFiles(root, patterns);

  for (const filePath of files) {
    const relPath = path.relative(root, filePath);
    const content = safeReadFile(filePath);
    if (!content) continue;

    const fileBindings = extractBindings(content, relPath);
    bindings.push(...fileBindings);
  }

  return bindings;
}

/**
 * Extract assertions from test files
 */
function extractAssertions(root: string, testFiles: TestFileInfo[]): AssertionInfo[] {
  const assertions: AssertionInfo[] = [];

  for (const testFile of testFiles) {
    const fullPath = path.join(root, testFile.path);
    const content = safeReadFile(fullPath);
    if (!content) continue;

    const fileAssertions = extractAssertionsFromContent(content, testFile.path);
    assertions.push(...fileAssertions);
  }

  return assertions;
}

// ============================================================================
// FILE UTILITIES
// ============================================================================

/**
 * Find files matching patterns (simplified glob)
 */
function findFiles(root: string, patterns: string[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = path.relative(root, fullPath);
        if (matchesPatterns(relPath, patterns) && !seen.has(fullPath)) {
          seen.add(fullPath);
          results.push(fullPath);
        }
      }
    }
  }

  walk(root);
  
  // Sort for deterministic output
  return results.sort();
}

/**
 * Check if path matches any of the patterns
 */
function matchesPatterns(relPath: string, patterns: string[]): boolean {
  const normalized = normalizePathSeparators(relPath);
  
  for (const pattern of patterns) {
    // Handle negation patterns
    if (pattern.startsWith('!')) {
      const negPattern = pattern.slice(1);
      if (matchGlob(normalized, negPattern)) {
        return false;
      }
      continue;
    }
    
    if (matchGlob(normalized, pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Simple glob matching
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Convert glob to regex
  let regex = pattern
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLESTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  
  regex = `^${regex}$`;
  
  return new RegExp(regex).test(filePath);
}

/**
 * Safely read file content
 */
function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Normalize path separators to forward slashes
 */
function normalizePathSeparators(p: string): string {
  return p.replace(/\\/g, '/');
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/**
 * Detect test framework from content
 */
function detectTestFramework(content: string): string {
  if (content.includes("from 'vitest'") || content.includes('from "vitest"')) {
    return 'vitest';
  }
  if (content.includes("from '@jest") || content.includes("from 'jest'")) {
    return 'jest';
  }
  if (content.includes("from 'mocha'") || content.includes("require('mocha')")) {
    return 'mocha';
  }
  if (content.includes('describe(') || content.includes('it(') || content.includes('test(')) {
    return 'vitest'; // Default assumption
  }
  return 'unknown';
}

/**
 * Extract test suite and test names
 */
function extractTestNames(content: string): { suites: string[]; tests: string[] } {
  const suites: string[] = [];
  const tests: string[] = [];
  
  // Match describe('name' or describe("name" or describe(`name`
  const describeRegex = /describe\s*\(\s*(['"`])([^'"`]+)\1/g;
  let match: RegExpExecArray | null;
  
  while ((match = describeRegex.exec(content)) !== null) {
    if (match[2]) {
      suites.push(match[2]);
    }
  }
  
  // Match it('name' or test('name' etc
  const testRegex = /(?:it|test)\s*\(\s*(['"`])([^'"`]+)\1/g;
  while ((match = testRegex.exec(content)) !== null) {
    if (match[2]) {
      tests.push(match[2]);
    }
  }
  
  // Sort for deterministic output
  return {
    suites: [...new Set(suites)].sort(),
    tests: [...new Set(tests)].sort(),
  };
}

/**
 * Extract bindings from implementation file
 */
function extractBindings(content: string, relPath: string): BindingInfo[] {
  const bindings: BindingInfo[] = [];
  const lines = content.split('\n');
  
  // Match exported functions/classes
  const exportPatterns = [
    // export function name
    /^export\s+(?:async\s+)?function\s+(\w+)/,
    // export class name
    /^export\s+class\s+(\w+)/,
    // export const name = async/function
    /^export\s+const\s+(\w+)\s*=/,
    // export { name }
    /^export\s*\{\s*(\w+)(?:\s+as\s+\w+)?\s*\}/,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    
    for (const pattern of exportPatterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const exportName = match[1];
        const bindingType = determineBindingType(line, content, exportName);
        
        bindings.push({
          specRef: inferSpecRef(exportName),
          bindingType,
          file: normalizePathSeparators(relPath),
          line: i + 1,
          exportName,
        });
      }
    }
  }
  
  return bindings;
}

/**
 * Determine binding type from context
 */
function determineBindingType(
  line: string,
  _content: string,
  _name: string
): BindingInfo['bindingType'] {
  if (line.includes('class ')) return 'class';
  if (line.includes('function ')) return 'function';
  if (line.includes('async ')) return 'function';
  if (line.includes('Handler') || line.includes('handler')) return 'handler';
  if (line.includes('route') || line.includes('Route')) return 'route';
  return 'function';
}

/**
 * Infer what spec element this binding relates to
 */
function inferSpecRef(exportName: string): string {
  // Convert camelCase/PascalCase to spec reference
  // CreateUser -> CreateUser
  // createUser -> CreateUser
  return exportName.charAt(0).toUpperCase() + exportName.slice(1);
}

/**
 * Extract assertions from test content
 */
function extractAssertionsFromContent(content: string, filePath: string): AssertionInfo[] {
  const assertions: AssertionInfo[] = [];
  const lines = content.split('\n');
  
  // Patterns for common assertion functions
  const assertPatterns = [
    /\bexpect\s*\(/,
    /\bassert\s*\(/,
    /\bassertEqual\s*\(/,
    /\bassertStrictEqual\s*\(/,
    /\btoEqual\s*\(/,
    /\btoBe\s*\(/,
    /\btoThrow\s*\(/,
    /\btoHaveBeenCalled\s*\(/,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    
    for (const pattern of assertPatterns) {
      const match = line.match(pattern);
      if (match) {
        const assertFn = extractAssertFn(line);
        const column = (match.index ?? 0) + 1;
        
        assertions.push({
          file: normalizePathSeparators(filePath),
          line: i + 1,
          column,
          assertFn,
          text: line.trim(),
          possibleClauseRef: inferClauseRef(line, content, i),
        });
        break; // Only count one assertion per line
      }
    }
  }
  
  return assertions;
}

/**
 * Extract assertion function name
 */
function extractAssertFn(line: string): string {
  const match = line.match(/\b(expect|assert\w*|toBe|toEqual|toThrow|toHaveBeenCalled\w*)\s*\(/);
  return match?.[1] ?? 'expect';
}

/**
 * Infer what clause an assertion might relate to
 */
function inferClauseRef(line: string, content: string, lineIndex: number): string | undefined {
  // Look for nearby describe/it blocks for context
  const lines = content.split('\n');
  
  // Search backwards for test name
  for (let i = lineIndex; i >= 0 && i > lineIndex - 20; i--) {
    const prevLine = lines[i] ?? '';
    const testMatch = prevLine.match(/(?:it|test)\s*\(\s*(['"`])([^'"`]+)\1/);
    if (testMatch?.[2]) {
      return testMatch[2];
    }
  }
  
  // Try to extract meaning from the assertion itself
  const identMatch = line.match(/expect\s*\(\s*(\w+)/);
  if (identMatch?.[1]) {
    return identMatch[1];
  }
  
  return undefined;
}

// ============================================================================
// SORTING UTILITIES (for determinism)
// ============================================================================

function sortByPath<T extends { path: string }>(items: T[]): T[] {
  return [...items].filter(item => item && item.path).sort((a, b) => a.path.localeCompare(b.path));
}

function sortByFileAndLine<T extends { file: string; line: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file);
    if (fileCompare !== 0) return fileCompare;
    return a.line - b.line;
  });
}
