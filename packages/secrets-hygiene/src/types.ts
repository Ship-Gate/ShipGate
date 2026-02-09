/**
 * Types for secrets hygiene module
 */

export interface SecretsMaskerOptions {
  /** Custom patterns to mask */
  patterns?: RegExp[];
  /** Mask character (default: '***') */
  maskChar?: string;
  /** Environment variable allowlist (only these will be shown unmasked) */
  allowedEnvVars?: string[];
  /** Whether to mask environment variables not in allowlist */
  maskEnvVars?: boolean;
}

export interface MaskResult {
  /** Masked text */
  masked: string;
  /** Number of secrets detected */
  secretsDetected: number;
  /** Types of secrets detected */
  secretTypes: string[];
}

export interface EnvFilterOptions {
  /** Environment variables to allow (allowlist) */
  allowedEnvVars?: string[];
  /** Whether to mask disallowed env vars in output */
  maskDisallowed?: boolean;
}
