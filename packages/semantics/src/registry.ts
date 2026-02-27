// ============================================================================
// Semantics Version Registry
// ============================================================================

import type { SemanticVersion, VersionedSemantics } from './types.js';
import { parseVersion, compareVersions } from './types.js';
import { V1_SEMANTICS, V1_VERSION } from './v1/index.js';

/**
 * Registry of all available semantic versions
 */
const SEMANTICS_REGISTRY: Map<string, VersionedSemantics> = new Map([
  ['1.0.0', V1_SEMANTICS],
  // Future versions will be added here:
  // ['2.0.0', V2_SEMANTICS],
]);

/**
 * Map of major versions to their latest semantics
 */
const MAJOR_VERSION_MAP: Map<number, VersionedSemantics> = new Map([
  [1, V1_SEMANTICS],
]);

/**
 * Get semantics for a specific version string
 * 
 * @param version - Version string (e.g., "1.0.0")
 * @returns The semantics for that version, or undefined if not found
 * 
 * @example
 * const v1 = getSemantics("1.0.0");
 * const op = v1?.getBinaryOperator("==");
 */
export function getSemantics(version: string): VersionedSemantics | undefined {
  // Try exact match first
  const exact = SEMANTICS_REGISTRY.get(version);
  if (exact) return exact;

  // Parse and find best match
  const parsed = parseVersion(version);
  return getSemanticsForVersion(parsed);
}

/**
 * Get semantics for a parsed version
 * 
 * Follows semver compatibility rules:
 * - Patch versions within same minor are compatible
 * - Minor versions within same major are forward-compatible
 * 
 * @param version - Parsed semantic version
 * @returns The best matching semantics
 */
export function getSemanticsForVersion(version: SemanticVersion): VersionedSemantics | undefined {
  // Find the latest semantics for this major version
  const majorSemantics = MAJOR_VERSION_MAP.get(version.major);
  
  if (!majorSemantics) {
    return undefined;
  }

  // Check if the requested version is supported
  // We support all patch versions >= the base version
  if (compareVersions(version, majorSemantics.version) >= 0) {
    return majorSemantics;
  }

  // Version is older than our base - still use the same semantics
  // (semantics are frozen within a major version)
  return majorSemantics;
}

/**
 * Get the latest semantics for a major version
 * 
 * @param major - Major version number
 * @returns The latest semantics for that major version
 */
export function getLatestSemantics(major: number): VersionedSemantics | undefined {
  return MAJOR_VERSION_MAP.get(major);
}

/**
 * Get all available semantic versions
 */
export function getAvailableVersions(): string[] {
  return Array.from(SEMANTICS_REGISTRY.keys()).sort();
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  try {
    const parsed = parseVersion(version);
    return MAJOR_VERSION_MAP.has(parsed.major);
  } catch {
    return false;
  }
}

/**
 * The default/latest semantics version
 */
export const DEFAULT_VERSION = '1.0.0';

/**
 * Get the default semantics
 */
export function getDefaultSemantics(): VersionedSemantics {
  return V1_SEMANTICS;
}

// Re-export version utilities
export { parseVersion, formatVersion, compareVersions } from './types.js';

// Re-export V1 for direct access
export { V1_SEMANTICS, V1_VERSION };
