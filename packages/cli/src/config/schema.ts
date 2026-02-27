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

/**
 * Guardrails configuration — overrides strict defaults for AI safety.
 * Every override leaves a paper trail in CLI output and proof bundle metadata.
 */
export interface ShipGateGuardrailsConfig {
  /** Allow auto-generated specs to reach SHIP (default: false) */
  allowAutoSpecShip?: boolean;
  /** Allow shipping when no tests were executed (default: false) */
  allowNoTestExecution?: boolean;
  /** Allow empty verification categories without penalty (default: false) */
  allowEmptyCategories?: boolean;
  /** Allow AI-generated rules without evidence (default: false) */
  allowUnvalidatedAiRules?: boolean;
}

/** Spec discovery configuration (demo/ISL verified schema) */
export interface ShipGateSpecsConfig {
  /** Glob patterns for ISL spec files to include */
  include?: string[];
}

/** Policy toggle (demo schema: verify.policies.*) */
export interface ShipGatePolicyToggle {
  enabled?: boolean;
}

/** Verification configuration (demo/ISL verified schema) */
export interface ShipGateVerifyConfig {
  /** Strict mode: fail on any verification failure */
  strict?: boolean;
  /** Policy toggles by name (e.g. auth, rate-limit, pii) */
  policies?: Record<string, ShipGatePolicyToggle>;
}

/** Evidence output configuration (demo schema) */
export interface ShipGateEvidenceConfig {
  /** Output directory for evidence artifacts */
  output_dir?: string;
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
  /** AI safety guardrails overrides (strict by default) */
  guardrails?: ShipGateGuardrailsConfig;
  /** Spec discovery (demo schema: specs.include) */
  specs?: ShipGateSpecsConfig;
  /** Verification options (demo schema: verify.strict, verify.policies) */
  verify?: ShipGateVerifyConfig;
  /** Evidence output (demo schema: evidence.output_dir) */
  evidence?: ShipGateEvidenceConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sane default ignore patterns — applied even when user has no config.
 * User ci.ignore extends these (never replaces); use dot:true in glob matching
 * so .next/.turbo are matchable.
 */
export const DEFAULT_IGNORE: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.git/**',
  '**/*.map',
  '**/*.min.*',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/*.generated.*',
  '**/*.snap',
  '**/vibe-test/**',
  '**/vibe-test*/**',
  '**/.shipgate/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/tests/**',
  '**/__tests__/**',
  '**/test/**',
  '**/bench/**',
  '**/benchmarks/**',
  '**/scripts/**',
  '**/templates/**',
  '**/examples/**',
  '**/demos/**',
  '**/fixtures/**',
  '**/*.config.ts',
  '**/*.config.js',
  '**/*.config.mjs',
  '**/vitest.*.ts',
  '**/jest.config.*',
  '**/tsup.config.*',
  '**/tailwind.config.*',
  '**/postcss.config.*',
  '**/next.config.*',
  '**/.eslintrc.*',
  '**/generated/**',
  '**/proof/**',
  '**/samples/**',
];

/** @deprecated Use DEFAULT_IGNORE */
export const DEFAULT_CI_IGNORE = [...DEFAULT_IGNORE];

/** Default CI configuration values */
export const DEFAULT_CI_CONFIG: Required<ShipGateCIConfig> = {
  failOn: 'error',
  requireIsl: [],
  ignore: [...DEFAULT_CI_IGNORE],
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

/** Default guardrails: all guardrails enforced (strict) */
export const DEFAULT_GUARDRAILS_CONFIG: Required<ShipGateGuardrailsConfig> = {
  allowAutoSpecShip: false,
  allowNoTestExecution: false,
  allowEmptyCategories: false,
  allowUnvalidatedAiRules: false,
};

/** Full default config returned when no .shipgate.yml is found */
export const DEFAULT_SHIPGATE_CONFIG: ShipGateConfig = {
  version: 1,
  ci: { ...DEFAULT_CI_CONFIG },
  scanning: { ...DEFAULT_SCANNING_CONFIG },
  generate: { ...DEFAULT_GENERATE_CONFIG },
  guardrails: { ...DEFAULT_GUARDRAILS_CONFIG },
};

// ─────────────────────────────────────────────────────────────────────────────
// Merge helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge a partial config with defaults, producing a fully-resolved config.
 * User ci.ignore extends defaults (never replaces).
 */
export function applyDefaults(partial: Partial<ShipGateConfig>): ShipGateConfig {
  const userIgnore = partial.ci?.ignore ?? [];
  const mergedIgnore = [...DEFAULT_IGNORE, ...userIgnore];

  return {
    version: 1,
    ci: {
      ...DEFAULT_CI_CONFIG,
      ...partial.ci,
      ignore: mergedIgnore,
    },
    scanning: {
      ...DEFAULT_SCANNING_CONFIG,
      ...partial.scanning,
    },
    generate: {
      ...DEFAULT_GENERATE_CONFIG,
      ...partial.generate,
    },
    guardrails: {
      ...DEFAULT_GUARDRAILS_CONFIG,
      ...partial.guardrails,
    },
    ...(partial.specs != null && { specs: partial.specs }),
    ...(partial.verify != null && { verify: partial.verify }),
    ...(partial.evidence != null && { evidence: partial.evidence }),
  };
}
