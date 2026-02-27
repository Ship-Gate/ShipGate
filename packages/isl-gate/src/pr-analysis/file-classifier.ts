/**
 * PR Analysis - File Classifier
 *
 * Classifies changed files as tests, types, config, or critical-path code.
 * Determines whether each file needs verification, specless check, or can
 * be skipped.
 *
 * @module @isl-lang/gate/pr-analysis
 */

import type { ResolvedPRAnalysisConfig } from './types.js';

// ============================================================================
// Default Patterns
// ============================================================================

/** Default patterns that identify test files */
const DEFAULT_TEST_PATTERNS: RegExp[] = [
  /\.(test|spec)\.[jt]sx?$/,
  /\/__tests__\//,
  /(^|\/)tests?\//,
  /(^|\/)test-utils\//,
  /\.stories\.[jt]sx?$/,
  /(^|\/)fixtures?\//,
  /(^|\/)mocks?\//,
  /\.mock\.[jt]sx?$/,
];

/** Default patterns that identify type-only files */
const DEFAULT_TYPE_PATTERNS: RegExp[] = [
  /\.d\.[cm]?ts$/,
  /\/types\.ts$/,
  /\/types\/index\.ts$/,
];

/** Default patterns that identify config files */
const DEFAULT_CONFIG_PATTERNS: RegExp[] = [
  /^\./, // dotfiles at repo root
  /\.(json|ya?ml|toml|ini|env.*)$/,
  /eslint/i,
  /prettier/i,
  /tsconfig/i,
  /vitest\.config/,
  /jest\.config/,
  /webpack\.config/,
  /vite\.config/,
  /tailwind\.config/,
  /postcss\.config/,
  /next\.config/,
  /package\.json$/,
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /Dockerfile/,
  /docker-compose/,
  /\.github\//,
  /\.vscode\//,
  /\.cursor\//,
  /Makefile$/,
  /README/i,
  /CHANGELOG/i,
  /LICENSE/i,
  /\.md$/,
];

/** Default patterns that identify critical paths */
const DEFAULT_CRITICAL_PATTERNS: RegExp[] = [
  /auth/i,
  /payment/i,
  /billing/i,
  /security/i,
  /crypto/i,
  /session/i,
  /token/i,
  /permission/i,
  /rbac/i,
  /oauth/i,
  /credential/i,
  /password/i,
  /secret/i,
  /webhook/i,
  /middleware/i,
  /gateway/i,
  /api\//i,
  /routes?\//i,
];

// ============================================================================
// Classification Functions
// ============================================================================

/**
 * Check if a file path is a test file.
 */
export function isTestFile(
  filePath: string,
  extraPatterns: RegExp[] = [],
): boolean {
  const patterns = [...DEFAULT_TEST_PATTERNS, ...extraPatterns];
  return patterns.some((p) => p.test(filePath));
}

/**
 * Check if a file path is type-only (declaration files, type modules).
 */
export function isTypeOnly(
  filePath: string,
  extraExtensions: string[] = [],
): boolean {
  if (DEFAULT_TYPE_PATTERNS.some((p) => p.test(filePath))) return true;
  return extraExtensions.some((ext) => filePath.endsWith(ext));
}

/**
 * Check if a file path is a config/infra file.
 */
export function isConfigFile(
  filePath: string,
  extraPatterns: RegExp[] = [],
): boolean {
  const patterns = [...DEFAULT_CONFIG_PATTERNS, ...extraPatterns];
  return patterns.some((p) => p.test(filePath));
}

/**
 * Check if a file path is on a critical code path.
 */
export function isCriticalPath(
  filePath: string,
  extraPatterns: RegExp[] = [],
): boolean {
  const patterns = [...DEFAULT_CRITICAL_PATTERNS, ...extraPatterns];
  return patterns.some((p) => p.test(filePath));
}

/**
 * Check if a file is an ISL spec.
 */
export function isISLSpec(filePath: string): boolean {
  return filePath.endsWith('.isl');
}

/**
 * Check if a file is source code (TS/JS/TSX/JSX).
 */
export function isSourceFile(filePath: string): boolean {
  return /\.[jt]sx?$/.test(filePath);
}

// ============================================================================
// Config Resolution
// ============================================================================

/**
 * Resolve partial user config into full defaults.
 */
export function resolveConfig(
  partial?: Partial<ResolvedPRAnalysisConfig>,
): ResolvedPRAnalysisConfig {
  return {
    specPatterns: partial?.specPatterns ?? ['**/*.isl'],
    specRoot: partial?.specRoot ?? '.',
    criticalPathPatterns: partial?.criticalPathPatterns ?? [],
    typeOnlyExtensions: partial?.typeOnlyExtensions ?? [],
    configPatterns: partial?.configPatterns ?? [],
    testPatterns: partial?.testPatterns ?? [],
  };
}
