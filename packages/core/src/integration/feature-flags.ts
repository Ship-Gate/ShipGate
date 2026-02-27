/**
 * ISL Core Feature Flags
 * 
 * Provides defensive feature detection for optional modules.
 * Use these flags to check if features are available before using them.
 * 
 * Example:
 * ```typescript
 * import { features, tryImport } from '@isl-lang/core';
 * 
 * if (features.hasTranslatorTools) {
 *   const tools = await tryImport('@isl-lang/mcp-server/translator-tools');
 *   // use tools
 * }
 * ```
 */

// ============================================================================
// Feature Detection Results
// ============================================================================

/**
 * Result of a feature availability check
 */
export interface FeatureCheckResult {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * All detectable ISL features
 */
export interface ISLFeatures {
  /** Evidence module for verification reports */
  hasEvidence: boolean;
  /** Scoring module for tri-state clause evaluation */
  hasScoring: boolean;
  /** Cache module for fingerprint-based caching */
  hasCache: boolean;
  /** Logging types and utilities */
  hasLogging: boolean;
  /** MCP translator tools */
  hasTranslatorTools: boolean;
  /** Build orchestrator service */
  hasBuildOrchestrator: boolean;
  /** Evidence view components */
  hasEvidenceView: boolean;
}

// ============================================================================
// Module Detection Cache
// ============================================================================

const moduleCache = new Map<string, FeatureCheckResult>();

/**
 * Check if a module is available without throwing
 */
export async function checkModule(modulePath: string): Promise<FeatureCheckResult> {
  const cached = moduleCache.get(modulePath);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const mod = await import(modulePath);
    const result: FeatureCheckResult = {
      available: true,
      version: mod.VERSION ?? mod.version ?? undefined,
    };
    moduleCache.set(modulePath, result);
    return result;
  } catch (err) {
    const result: FeatureCheckResult = {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
    moduleCache.set(modulePath, result);
    return result;
  }
}

/**
 * Try to import a module, returning undefined if not available
 */
export async function tryImport<T = unknown>(modulePath: string): Promise<T | undefined> {
  try {
    return await import(modulePath);
  } catch {
    return undefined;
  }
}

/**
 * Try to import a module synchronously (for already-loaded modules)
 * This only works if the module was already loaded via dynamic import
 */
export function tryRequire<T = unknown>(modulePath: string): T | undefined {
  try {
    // Note: This is a fallback for environments that support require
    // In pure ESM, use tryImport instead
    return require(modulePath) as T;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Feature Detection
// ============================================================================

/**
 * Detect all available ISL features
 * Results are cached after first detection
 */
export async function detectFeatures(): Promise<ISLFeatures> {
  const [
    evidenceCheck,
    scoringCheck,
    cacheCheck,
    loggingCheck,
    translatorToolsCheck,
    buildOrchestratorCheck,
    evidenceViewCheck,
  ] = await Promise.all([
    checkModule('./evidence/index.js'),
    checkModule('./isl-agent/scoring/index.js'),
    checkModule('./cache/index.js'),
    checkModule('./logging/logTypes.js'),
    checkModule('@isl-lang/mcp-server/translator-tools'),
    checkModule('@isl-lang/core/build-orchestrator'),
    checkModule('@isl-lang/vscode/evidence-view'),
  ]);

  return {
    hasEvidence: evidenceCheck.available,
    hasScoring: scoringCheck.available,
    hasCache: cacheCheck.available,
    hasLogging: loggingCheck.available,
    hasTranslatorTools: translatorToolsCheck.available,
    hasBuildOrchestrator: buildOrchestratorCheck.available,
    hasEvidenceView: evidenceViewCheck.available,
  };
}

// ============================================================================
// Synchronous Feature Flags (best-effort detection)
// ============================================================================

/**
 * Synchronous feature flags based on known module structure
 * These are set to true when modules are known to exist in the codebase
 * Use detectFeatures() for runtime verification
 */
export const features: ISLFeatures = {
  // Core modules (always available in @isl-lang/core)
  hasEvidence: true,
  hasScoring: true,
  hasCache: true,
  hasLogging: true,
  
  // External modules (may not be installed)
  hasTranslatorTools: false,
  hasBuildOrchestrator: false,
  hasEvidenceView: false,
};

// ============================================================================
// Feature-Gated Utilities
// ============================================================================

/**
 * Execute a function only if a feature is available
 * Returns undefined if the feature is not available
 */
export async function withFeature<T>(
  featureKey: keyof ISLFeatures,
  fn: () => Promise<T>
): Promise<T | undefined> {
  const detected = await detectFeatures();
  if (!detected[featureKey]) {
    return undefined;
  }
  return fn();
}

/**
 * Create a feature-gated function that shows a friendly error if feature is missing
 */
export function createFeatureGate(
  featureName: string,
  installHint?: string
): () => never {
  return () => {
    const hint = installHint ? ` Install it with: ${installHint}` : '';
    throw new Error(`Feature "${featureName}" is not installed.${hint}`);
  };
}

/**
 * Common feature gates for missing functionality
 */
export const FeatureGates = {
  translatorTools: createFeatureGate(
    'MCP Translator Tools',
    'npm install @isl-lang/mcp-server'
  ),
  buildOrchestrator: createFeatureGate(
    'Build Orchestrator',
    'npm install @isl-lang/build-orchestrator'
  ),
  evidenceView: createFeatureGate(
    'Evidence View',
    'Install the ISL VS Code extension'
  ),
} as const;

// ============================================================================
// Version Info
// ============================================================================

export const VERSION = '0.1.0';
