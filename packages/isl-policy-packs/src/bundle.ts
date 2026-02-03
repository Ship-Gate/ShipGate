/**
 * ISL Policy Packs - Bundle Format
 * 
 * Policy bundles are versioned snapshots of policy pack configurations
 * that ensure stable, reproducible policy evaluation across environments.
 * 
 * @module @isl-lang/policy-packs/bundle
 */

import type { PolicyPack, PolicyPackConfig, PolicySeverity } from './types.js';

// ============================================================================
// Bundle Format Types
// ============================================================================

/**
 * Policy bundle format version
 */
export const BUNDLE_FORMAT_VERSION = '1.0.0';

/**
 * Policy bundle metadata
 */
export interface PolicyBundleMetadata {
  /** Bundle format version */
  formatVersion: string;
  /** When this bundle was created */
  createdAt: string;
  /** Tool that created this bundle */
  createdBy: string;
  /** Optional description */
  description?: string;
}

/**
 * Pack version specification in bundle
 */
export interface PackVersionSpec {
  /** Pack ID */
  packId: string;
  /** Exact pack version to use */
  version: string;
  /** Whether this pack is enabled */
  enabled: boolean;
  /** Minimum severity level to enable (rules below this severity are disabled) */
  minSeverity?: PolicySeverity;
  /** Rule-specific overrides */
  ruleOverrides?: Record<string, {
    enabled?: boolean;
    severity?: PolicySeverity;
    config?: Record<string, unknown>;
  }>;
}

/**
 * Policy bundle definition
 * 
 * A bundle locks specific pack versions and configurations to ensure
 * consistent policy evaluation across time and environments.
 */
export interface PolicyBundle {
  /** Bundle metadata */
  metadata: PolicyBundleMetadata;
  /** Pack versions and configurations */
  packs: PackVersionSpec[];
  /** Optional compatibility constraints */
  compatibility?: {
    /** Minimum bundle format version required */
    minFormatVersion?: string;
    /** Maximum bundle format version supported */
    maxFormatVersion?: string;
  };
}

/**
 * Bundle validation result
 */
export interface BundleValidationResult {
  /** Whether bundle is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Deprecation notices */
  deprecations: DeprecationNotice[];
}

/**
 * Deprecation notice for a rule or pack
 */
export interface DeprecationNotice {
  /** Type of deprecation */
  type: 'rule' | 'pack';
  /** ID of deprecated item */
  id: string;
  /** Version when deprecated */
  deprecatedSince: string;
  /** Replacement ID (if applicable) */
  replacementId?: string;
  /** Deprecation message */
  message: string;
}

// ============================================================================
// Bundle Creation
// ============================================================================

/**
 * Create a policy bundle from current pack registry state
 */
export function createBundle(
  packs: PolicyPack[],
  config?: Record<string, PolicyPackConfig>,
  options?: {
    description?: string;
    minSeverity?: PolicySeverity;
  }
): PolicyBundle {
  const packSpecs: PackVersionSpec[] = packs.map(pack => {
    const packConfig = config?.[pack.id];
    
    return {
      packId: pack.id,
      version: pack.version,
      enabled: packConfig?.enabled ?? true,
      minSeverity: options?.minSeverity ?? packConfig?.minSeverity,
      ruleOverrides: packConfig?.ruleOverrides,
    };
  });

  return {
    metadata: {
      formatVersion: BUNDLE_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      createdBy: '@isl-lang/policy-packs',
      description: options?.description,
    },
    packs: packSpecs,
    compatibility: {
      minFormatVersion: BUNDLE_FORMAT_VERSION,
    },
  };
}

// ============================================================================
// Bundle Validation
// ============================================================================

/**
 * Validate a policy bundle
 */
export function validateBundle(
  bundle: PolicyBundle,
  availablePacks: Map<string, PolicyPack[]>
): BundleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const deprecations: DeprecationNotice[] = [];

  // Check format version
  if (bundle.metadata.formatVersion !== BUNDLE_FORMAT_VERSION) {
    warnings.push(
      `Bundle format version ${bundle.metadata.formatVersion} differs from current ${BUNDLE_FORMAT_VERSION}`
    );
  }

  // Validate each pack specification
  for (const packSpec of bundle.packs) {
    const packVersions = availablePacks.get(packSpec.packId);
    
    if (!packVersions || packVersions.length === 0) {
      errors.push(`Pack "${packSpec.packId}" not found in registry`);
      continue;
    }

    // Check if exact version exists
    const exactVersion = packVersions.find(p => p.version === packSpec.version);
    if (!exactVersion) {
      // Check for newer compatible version
      const newerVersion = findNewerCompatibleVersion(
        packSpec.version,
        packVersions.map(p => p.version)
      );
      
      if (newerVersion) {
        warnings.push(
          `Pack "${packSpec.packId}" version ${packSpec.version} not found. ` +
          `Newer version ${newerVersion} available.`
        );
      } else {
        errors.push(
          `Pack "${packSpec.packId}" version ${packSpec.version} not found and no compatible version available`
        );
      }
    } else {
      // Check for deprecations
      checkDeprecations(exactVersion, packSpec, deprecations);
    }

    // Validate rule overrides
    if (packSpec.ruleOverrides) {
      const pack = exactVersion || packVersions[0];
      for (const ruleId of Object.keys(packSpec.ruleOverrides)) {
        const rule = pack.rules.find(r => r.id === ruleId);
        if (!rule) {
          warnings.push(
            `Rule "${ruleId}" in pack "${packSpec.packId}" not found (may have been removed or renamed)`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    deprecations,
  };
}

/**
 * Find a newer compatible version (same major version)
 */
function findNewerCompatibleVersion(
  requestedVersion: string,
  availableVersions: string[]
): string | null {
  const [major] = requestedVersion.split('.');
  
  const compatibleVersions = availableVersions
    .filter(v => v.startsWith(`${major}.`))
    .sort((a, b) => compareVersions(b, a));
  
  return compatibleVersions[0] || null;
}

/**
 * Compare semantic versions
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  
  return 0;
}

/**
 * Check for deprecations in pack or rules
 */
function checkDeprecations(
  pack: PolicyPack,
  packSpec: PackVersionSpec,
  deprecations: DeprecationNotice[]
): void {
  // Check pack-level deprecation (if we add this in the future)
  // For now, check rule-level deprecations
  
  for (const rule of pack.rules) {
    // Check if rule is referenced in bundle
    const isReferenced = packSpec.ruleOverrides?.[rule.id] !== undefined ||
                         packSpec.enabled !== false;
    
    if (isReferenced && (rule as any).deprecated) {
      deprecations.push({
        type: 'rule',
        id: rule.id,
        deprecatedSince: (rule as any).deprecatedSince || pack.version,
        replacementId: (rule as any).replacementRuleId,
        message: (rule as any).deprecationMessage || `Rule ${rule.id} is deprecated`,
      });
    }
  }
}

// ============================================================================
// Bundle Serialization
// ============================================================================

/**
 * Serialize bundle to JSON
 */
export function serializeBundle(bundle: PolicyBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Deserialize bundle from JSON
 */
export function deserializeBundle(json: string): PolicyBundle {
  const bundle = JSON.parse(json) as PolicyBundle;
  
  // Validate structure
  if (!bundle.metadata || !bundle.packs) {
    throw new Error('Invalid bundle format: missing required fields');
  }
  
  return bundle;
}

// ============================================================================
// Bundle Compatibility
// ============================================================================

/**
 * Check if a bundle is compatible with current packs
 */
export function checkBundleCompatibility(
  bundle: PolicyBundle,
  availablePacks: Map<string, PolicyPack[]>
): {
  compatible: boolean;
  missingPacks: string[];
  outdatedVersions: Array<{ packId: string; requested: string; available: string }>;
  deprecations: DeprecationNotice[];
} {
  const missingPacks: string[] = [];
  const outdatedVersions: Array<{ packId: string; requested: string; available: string }> = [];
  const deprecations: DeprecationNotice[] = [];

  for (const packSpec of bundle.packs) {
    const packVersions = availablePacks.get(packSpec.packId);
    
    if (!packVersions || packVersions.length === 0) {
      missingPacks.push(packSpec.packId);
      continue;
    }

    const exactVersion = packVersions.find(p => p.version === packSpec.version);
    if (!exactVersion) {
      const latest = packVersions.sort((a, b) => 
        compareVersions(b.version, a.version)
      )[0];
      
      outdatedVersions.push({
        packId: packSpec.packId,
        requested: packSpec.version,
        available: latest.version,
      });
    } else {
      checkDeprecations(exactVersion, packSpec, deprecations);
    }
  }

  return {
    compatible: missingPacks.length === 0 && outdatedVersions.length === 0,
    missingPacks,
    outdatedVersions,
    deprecations,
  };
}
