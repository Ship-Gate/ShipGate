/**
 * ShipGate Configuration Schema
 *
 * Defines the shape and defaults for .shipgate.yml configuration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Strictness level that controls when CI should fail */
export type FailOnLevel = 'error' | 'warning' | 'unspecced';

/** Controls specless verification mode */
export type SpeclessMode = 'on' | 'off' | 'warn-only';

/** CI pipeline configuration */
export interface ShipGateCIConfig {
  /** Strictness level: what severity triggers CI failure (default: 'error') */
  failOn?: FailOnLevel;
  /** Glob patterns for files that MUST have .isl specs */
  requireIsl?: string[];
  /** Glob patterns for files to skip entirely */
  ignore?: string[];
  /** Specless verification mode (default: 'on') */
  speclessMode?: SpeclessMode;
}

/** Scanning configuration for hallucination/secret/vulnerability detection */
export interface ShipGateScanningConfig {
  /** Detect hallucinated imports/routes (default: true) */
  hallucinations?: boolean;
  /** Detect fake/stub features (default: true) */
  fakeFeatures?: boolean;
  /** Detect hardcoded secrets (default: true) */
  secrets?: boolean;
  /** Detect common vulnerabilities (default: true) */
  vulnerabilities?: boolean;
}

/** Code generation configuration */
export interface ShipGateGenerateConfig {
  /** Output directory for generated ISL files */
  output?: string;
  /** Minimum confidence threshold for auto-generation (default: 0.3) */
  minConfidence?: number;
}

/** Root ShipGate configuration */
export interface ShipGateConfig {
  /** Config schema version (must be 1) */
  version: 1;
  /** CI pipeline configuration */
  ci?: ShipGateCIConfig;
  /** Scanning configuration */
  scanning?: ShipGateScanningConfig;
  /** Generation configuration */
  generate?: ShipGateGenerateConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

/** Default CI configuration values */
export const DEFAULT_CI_CONFIG: Required<ShipGateCIConfig> = {
  failOn: 'error',
  requireIsl: [],
  ignore: [],
  speclessMode: 'on',
};

/** Default scanning configuration values */
export const DEFAULT_SCANNING_CONFIG: Required<ShipGateScanningConfig> = {
  hallucinations: true,
  fakeFeatures: true,
  secrets: true,
  vulnerabilities: true,
};

/** Default generation configuration values */
export const DEFAULT_GENERATE_CONFIG: Required<ShipGateGenerateConfig> = {
  output: '.shipgate/specs',
  minConfidence: 0.3,
};

/** Full default config returned when no .shipgate.yml is found */
export const DEFAULT_SHIPGATE_CONFIG: ShipGateConfig = {
  version: 1,
  ci: { ...DEFAULT_CI_CONFIG },
  scanning: { ...DEFAULT_SCANNING_CONFIG },
  generate: { ...DEFAULT_GENERATE_CONFIG },
};

// ─────────────────────────────────────────────────────────────────────────────
// Merge helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge a partial config with defaults, producing a fully-resolved config.
 */
export function applyDefaults(partial: Partial<ShipGateConfig>): ShipGateConfig {
  return {
    version: 1,
    ci: {
      ...DEFAULT_CI_CONFIG,
      ...partial.ci,
    },
    scanning: {
      ...DEFAULT_SCANNING_CONFIG,
      ...partial.scanning,
    },
    generate: {
      ...DEFAULT_GENERATE_CONFIG,
      ...partial.generate,
    },
  };
}
