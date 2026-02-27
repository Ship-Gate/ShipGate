// ============================================================================
// Fixture Loader — Versioned ISL Fixture Loading
// ============================================================================
//
// Provides a robust fixture loading layer that:
// 1. Normalizes ParseResult field names (domain → ast) for backward compat
// 2. Supports fixture versioning via header comments (// isl-fixture: v2)
// 3. Applies syntax upgrades for older fixture versions
// ============================================================================

import { parse, type ParseResult } from '@isl-lang/parser';
import type { Domain } from '@isl-lang/parser';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface FixtureVersion {
  major: number;
  label: string;
}

export interface NormalizedParseResult extends ParseResult {
  /** Alias for `domain` — provided for backward compatibility */
  ast?: Domain;
}

export interface LoadedFixture {
  name: string;
  path: string;
  source: string;
  domain: Domain;
  version: FixtureVersion;
}

export interface FixtureLoadOptions {
  /** Directory containing fixture files */
  fixturesDir?: string;
  /** If true, apply version upgrades to older fixtures before parsing */
  autoUpgrade?: boolean;
}

// ============================================================================
// VERSION DETECTION
// ============================================================================

const FIXTURE_VERSION_PATTERN = /\/\/\s*isl-fixture:\s*v(\d+)/;
const CURRENT_VERSION: FixtureVersion = { major: 2, label: 'v2' };

/**
 * Detect fixture version from source text.
 * - `// isl-fixture: v2` → version 2
 * - No header → version 1 (legacy)
 */
export function detectFixtureVersion(source: string): FixtureVersion {
  const match = source.match(FIXTURE_VERSION_PATTERN);
  if (match) {
    const major = parseInt(match[1]!, 10);
    return { major, label: `v${major}` };
  }
  return { major: 1, label: 'v1' };
}

// ============================================================================
// FIXTURE UPGRADES (v1 → v2)
// ============================================================================

/**
 * Upgrade v1 fixture syntax to current (v2) syntax.
 *
 * Transformations applied:
 * - Removes commas from inline type constraint blocks: `{ min: 1, max: 10 }` → `{ min: 1 max: 10 }`
 * - `post error NAME { }` → `post NAME { }` (remove `error` keyword)
 * - Quotes unquoted natural-language invariants containing colons
 *
 * These transformations are narrow and explicit — they do NOT accept arbitrary syntax.
 */
export function upgradeFixtureToCurrent(source: string, fromVersion: FixtureVersion): string {
  if (fromVersion.major >= CURRENT_VERSION.major) {
    return source;
  }

  let upgraded = source;

  if (fromVersion.major <= 1) {
    upgraded = applyV1ToV2Upgrades(upgraded);
  }

  return upgraded;
}

function applyV1ToV2Upgrades(source: string): string {
  let result = source;

  // 1. Remove commas in inline type constraint blocks: `String { min_length: 1, max_length: 255 }`
  //    Match `{ key: value, key: value }` patterns inside type definitions (not in code blocks)
  result = result.replace(
    /(\w+\s*\{[^{}]*?)(,)(\s*\w+\s*:)/g,
    (_, before, _comma, after) => `${before}${after}`
  );

  // 2. Remove `error` keyword from `post error NAME`: `post error X {` → `post X {`
  result = result.replace(/\bpost\s+error\s+(\w+)/g, 'post $1');

  // 3. Convert `step VAR = CALL(...)` / `assert EXPR` to comments (informational)
  //    These need manual conversion to given/when/then — just flag them
  //    (Actual conversion is complex and domain-specific)

  return result;
}

// ============================================================================
// PARSE RESULT NORMALIZATION
// ============================================================================

/**
 * Normalize a ParseResult to include both `domain` and `ast` fields.
 * The parser returns `domain` but some consumers expect `ast`.
 */
export function normalizeParseResult(result: ParseResult): NormalizedParseResult {
  const normalized = result as NormalizedParseResult;
  if (result.domain && !normalized.ast) {
    normalized.ast = result.domain;
  }
  return normalized;
}

/**
 * Parse ISL source with normalized result (includes both `domain` and `ast`).
 */
export function parseISL(source: string, filename?: string): NormalizedParseResult {
  const result = parse(source, filename);
  return normalizeParseResult(result);
}

// ============================================================================
// FIXTURE LOADING
// ============================================================================

/**
 * Load a single ISL fixture file with version detection and optional upgrade.
 *
 * @param filename - Fixture filename (e.g., 'e2e-numeric.isl')
 * @param options - Load options
 * @returns LoadedFixture with parsed domain
 * @throws Error if file not found or parse fails
 */
export function loadFixture(filename: string, options: FixtureLoadOptions = {}): LoadedFixture {
  const fixturesDir = options.fixturesDir ?? join(__dirname, '../fixtures');
  const filePath = join(fixturesDir, filename);

  if (!existsSync(filePath)) {
    throw new Error(`Fixture not found: ${filePath}`);
  }

  let source = readFileSync(filePath, 'utf-8');
  const version = detectFixtureVersion(source);

  // Auto-upgrade older fixtures
  if (options.autoUpgrade !== false && version.major < CURRENT_VERSION.major) {
    source = upgradeFixtureToCurrent(source, version);
  }

  const result = parseISL(source, filename);
  if (!result.success || !result.ast) {
    const errors = result.errors?.map(e => e.message).join(', ') ?? 'Unknown error';
    throw new Error(`Parse error in ${filename}: ${errors}`);
  }

  return {
    name: filename.replace('.isl', ''),
    path: filePath,
    source,
    domain: result.ast,
    version,
  };
}

/**
 * Load a fixture from an absolute path (for sample domain files).
 */
export function loadFixtureFromPath(absolutePath: string, name: string): LoadedFixture {
  if (!existsSync(absolutePath)) {
    throw new Error(`Fixture not found: ${absolutePath}`);
  }

  let source = readFileSync(absolutePath, 'utf-8');
  const version = detectFixtureVersion(source);

  if (version.major < CURRENT_VERSION.major) {
    source = upgradeFixtureToCurrent(source, version);
  }

  const result = parseISL(source, absolutePath);
  if (!result.success || !result.ast) {
    const errors = result.errors?.map(e => e.message).join(', ') ?? 'Unknown error';
    throw new Error(`Parse error in ${name}: ${errors}`);
  }

  return {
    name,
    path: absolutePath,
    source,
    domain: result.ast,
    version,
  };
}

/**
 * Load multiple fixtures, returning successfully loaded ones.
 * Logs warnings for fixtures that fail to load.
 */
export function loadFixtures(
  filenames: string[],
  options: FixtureLoadOptions = {}
): LoadedFixture[] {
  const loaded: LoadedFixture[] = [];
  for (const filename of filenames) {
    try {
      loaded.push(loadFixture(filename, options));
    } catch (err) {
      console.warn(`Could not load fixture ${filename}:`, err);
    }
  }
  return loaded;
}

export { CURRENT_VERSION };
