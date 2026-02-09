/**
 * Allowlist logic for mock detection
 * 
 * Files in test/mock/fixture folders should not be flagged.
 */

import * as path from 'node:path';

/**
 * Default allowlist patterns
 */
export const DEFAULT_ALLOWLIST_PATTERNS = [
  '**/tests/**',
  '**/test/**',
  '**/__tests__/**',
  '**/__test__/**',
  '**/mocks/**',
  '**/mock/**',
  '**/fixtures/**',
  '**/fixture/**',
  '**/stories/**',
  '**/storybook/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
  '**/*.mock.ts',
  '**/*.mock.tsx',
  '**/*.mock.js',
  '**/*.mock.jsx',
  '**/*.stub.ts',
  '**/*.stub.tsx',
  '**/*.stub.js',
  '**/*.stub.jsx',
];

/**
 * Dev-only build paths
 */
export const DEV_BUILD_PATTERNS = [
  '**/dev/**',
  '**/development/**',
  '**/demo/**',
  '**/demos/**',
  '**/examples/**',
  '**/example/**',
  '**/playground/**',
  '**/.dev/**',
  '**/dist-dev/**',
  '**/build-dev/**',
];

/**
 * Check if a file path matches any allowlist pattern
 */
export function isAllowlisted(
  filePath: string,
  customAllowlist: string[] = []
): boolean {
  const allPatterns = [
    ...DEFAULT_ALLOWLIST_PATTERNS,
    ...DEV_BUILD_PATTERNS,
    ...customAllowlist,
  ];

  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of allPatterns) {
    if (matchesPattern(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple glob pattern matching
 * Supports ** for recursive matching and * for single segment
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/**
 * Get allowlist reason for a file path
 */
export function getAllowlistReason(filePath: string): string | undefined {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check test patterns
  if (
    normalizedPath.includes('/tests/') ||
    normalizedPath.includes('/test/') ||
    normalizedPath.includes('/__tests__/') ||
    normalizedPath.includes('/__test__/') ||
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(normalizedPath)
  ) {
    return 'Test file';
  }

  // Check mock patterns
  if (
    normalizedPath.includes('/mocks/') ||
    normalizedPath.includes('/mock/') ||
    /\.mock\.(ts|tsx|js|jsx)$/.test(normalizedPath)
  ) {
    return 'Mock file';
  }

  // Check fixture patterns
  if (
    normalizedPath.includes('/fixtures/') ||
    normalizedPath.includes('/fixture/')
  ) {
    return 'Fixture file';
  }

  // Check story patterns
  if (
    normalizedPath.includes('/stories/') ||
    normalizedPath.includes('/storybook/')
  ) {
    return 'Story file';
  }

  // Check dev patterns
  if (
    normalizedPath.includes('/dev/') ||
    normalizedPath.includes('/development/') ||
    normalizedPath.includes('/demo/') ||
    normalizedPath.includes('/demos/') ||
    normalizedPath.includes('/examples/') ||
    normalizedPath.includes('/playground/')
  ) {
    return 'Development/demo file';
  }

  return undefined;
}
