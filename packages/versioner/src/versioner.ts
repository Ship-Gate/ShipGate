// ============================================================================
// Semantic Versioner
// Computes the next version based on change analysis
// ============================================================================

import type { ChangeAnalysis } from './analyzer.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export type VersionBump = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease' | 'none';

export interface VersionOptions {
  prerelease?: string;  // e.g., 'alpha', 'beta', 'rc'
  build?: string;       // Build metadata
}

// ============================================================================
// VERSION PARSING
// ============================================================================

/**
 * Parse a semantic version string
 */
export function parseVersion(version: string): SemanticVersion {
  // Handle v prefix
  const normalized = version.startsWith('v') ? version.slice(1) : version;
  
  // Split on + for build metadata
  const [mainPart, build] = normalized.split('+');
  
  // Split on - for prerelease
  const [corePart, ...prereleaseparts] = mainPart.split('-');
  const prerelease = prereleaseparts.length > 0 ? prereleaseparts.join('-') : undefined;
  
  // Parse major.minor.patch
  const parts = corePart.split('.');
  
  return {
    major: parseInt(parts[0] ?? '0', 10) || 0,
    minor: parseInt(parts[1] ?? '0', 10) || 0,
    patch: parseInt(parts[2] ?? '0', 10) || 0,
    prerelease,
    build,
  };
}

/**
 * Format a semantic version to string
 */
export function formatVersion(version: SemanticVersion, prefix: boolean = false): string {
  let str = `${version.major}.${version.minor}.${version.patch}`;
  
  if (version.prerelease) {
    str += `-${version.prerelease}`;
  }
  
  if (version.build) {
    str += `+${version.build}`;
  }
  
  return prefix ? `v${str}` : str;
}

// ============================================================================
// VERSION COMPUTATION
// ============================================================================

/**
 * Compute the next version based on changes
 */
export function computeNextVersion(
  currentVersion: string | SemanticVersion,
  analysis: ChangeAnalysis,
  options: VersionOptions = {}
): SemanticVersion {
  const current = typeof currentVersion === 'string' 
    ? parseVersion(currentVersion) 
    : currentVersion;
  
  const bump = analysis.summary.suggestedBump;
  return bumpVersion(current, bump, options);
}

/**
 * Bump a version by the specified type
 */
export function bumpVersion(
  version: SemanticVersion,
  bump: VersionBump,
  options: VersionOptions = {}
): SemanticVersion {
  const result = { ...version };
  
  // Clear build metadata on bump (it's meant to be ephemeral)
  delete result.build;
  
  switch (bump) {
    case 'major':
      result.major += 1;
      result.minor = 0;
      result.patch = 0;
      delete result.prerelease;
      break;
      
    case 'minor':
      result.minor += 1;
      result.patch = 0;
      delete result.prerelease;
      break;
      
    case 'patch':
      result.patch += 1;
      delete result.prerelease;
      break;
      
    case 'premajor':
      result.major += 1;
      result.minor = 0;
      result.patch = 0;
      result.prerelease = formatPrerelease(options.prerelease ?? 'alpha', 0);
      break;
      
    case 'preminor':
      result.minor += 1;
      result.patch = 0;
      result.prerelease = formatPrerelease(options.prerelease ?? 'alpha', 0);
      break;
      
    case 'prepatch':
      result.patch += 1;
      result.prerelease = formatPrerelease(options.prerelease ?? 'alpha', 0);
      break;
      
    case 'prerelease':
      if (result.prerelease) {
        // Increment prerelease number
        result.prerelease = incrementPrerelease(result.prerelease);
      } else {
        // Start new prerelease
        result.patch += 1;
        result.prerelease = formatPrerelease(options.prerelease ?? 'alpha', 0);
      }
      break;
      
    case 'none':
    default:
      // No change
      break;
  }
  
  // Apply build metadata if provided
  if (options.build) {
    result.build = options.build;
  }
  
  return result;
}

// ============================================================================
// VERSION COMPARISON
// ============================================================================

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string | SemanticVersion, b: string | SemanticVersion): -1 | 0 | 1 {
  const va = typeof a === 'string' ? parseVersion(a) : a;
  const vb = typeof b === 'string' ? parseVersion(b) : b;
  
  // Compare major.minor.patch
  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
  
  // Compare prerelease
  if (!va.prerelease && vb.prerelease) return 1;  // No prerelease > prerelease
  if (va.prerelease && !vb.prerelease) return -1; // Prerelease < no prerelease
  if (va.prerelease && vb.prerelease) {
    return comparePrerelease(va.prerelease, vb.prerelease);
  }
  
  return 0;
}

function comparePrerelease(a: string, b: string): -1 | 0 | 1 {
  const partsA = a.split('.');
  const partsB = b.split('.');
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i];
    const partB = partsB[i];
    
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;
    
    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA < numB ? -1 : 1;
    } else if (!isNaN(numA)) {
      return -1; // Numbers sort before strings
    } else if (!isNaN(numB)) {
      return 1;
    } else {
      const cmp = partA.localeCompare(partB);
      if (cmp !== 0) return cmp < 0 ? -1 : 1;
    }
  }
  
  return 0;
}

/**
 * Check if version satisfies a range
 */
export function satisfiesRange(version: string | SemanticVersion, range: string): boolean {
  const v = typeof version === 'string' ? parseVersion(version) : version;
  
  // Parse range patterns
  range = range.trim();
  
  // Exact match
  if (!range.includes(' ') && !range.match(/[<>=^~]/)) {
    return compareVersions(v, range) === 0;
  }
  
  // Caret range: ^1.2.3 means >=1.2.3 <2.0.0
  if (range.startsWith('^')) {
    const base = parseVersion(range.slice(1));
    if (compareVersions(v, base) < 0) return false;
    if (v.major !== base.major) return false;
    return true;
  }
  
  // Tilde range: ~1.2.3 means >=1.2.3 <1.3.0
  if (range.startsWith('~')) {
    const base = parseVersion(range.slice(1));
    if (compareVersions(v, base) < 0) return false;
    if (v.major !== base.major || v.minor !== base.minor) return false;
    return true;
  }
  
  // Comparison operators
  const match = range.match(/^([<>=]+)\s*(.+)$/);
  if (match) {
    const [, op, ver] = match;
    const base = parseVersion(ver);
    const cmp = compareVersions(v, base);
    
    switch (op) {
      case '=':
      case '==':
        return cmp === 0;
      case '<':
        return cmp < 0;
      case '<=':
        return cmp <= 0;
      case '>':
        return cmp > 0;
      case '>=':
        return cmp >= 0;
    }
  }
  
  return false;
}

// ============================================================================
// PRERELEASE HELPERS
// ============================================================================

function formatPrerelease(label: string, number: number): string {
  return `${label}.${number}`;
}

function incrementPrerelease(prerelease: string): string {
  const parts = prerelease.split('.');
  const lastPart = parts[parts.length - 1];
  const num = parseInt(lastPart, 10);
  
  if (!isNaN(num)) {
    parts[parts.length - 1] = String(num + 1);
  } else {
    parts.push('0');
  }
  
  return parts.join('.');
}

// ============================================================================
// VERSION UTILITIES
// ============================================================================

/**
 * Get major version number
 */
export function getMajor(version: string | SemanticVersion): number {
  const v = typeof version === 'string' ? parseVersion(version) : version;
  return v.major;
}

/**
 * Get minor version number
 */
export function getMinor(version: string | SemanticVersion): number {
  const v = typeof version === 'string' ? parseVersion(version) : version;
  return v.minor;
}

/**
 * Get patch version number
 */
export function getPatch(version: string | SemanticVersion): number {
  const v = typeof version === 'string' ? parseVersion(version) : version;
  return v.patch;
}

/**
 * Check if version is a prerelease
 */
export function isPrerelease(version: string | SemanticVersion): boolean {
  const v = typeof version === 'string' ? parseVersion(version) : version;
  return !!v.prerelease;
}

/**
 * Validate a version string
 */
export function isValidVersion(version: string): boolean {
  const semverRegex = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}
