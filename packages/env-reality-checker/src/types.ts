/**
 * Agent 29 - Env Reality Owner
 * 
 * Types for environment variable reality checking
 */

/**
 * Environment variable definition source
 */
export interface EnvDefinition {
  /** Variable name */
  name: string;
  /** Source file path */
  file: string;
  /** Line number */
  line: number;
  /** Source type */
  source: 'env-file' | 'zod-schema' | 'joi-schema' | 'kubernetes' | 'dockerfile' | 'terraform' | 'helm';
  /** Whether required */
  required: boolean;
  /** Default value if present */
  defaultValue?: string;
  /** Type hint */
  typeHint?: 'string' | 'number' | 'boolean' | 'url' | 'enum';
  /** Enum values if typeHint is 'enum' */
  enumValues?: string[];
  /** Whether sensitive */
  sensitive: boolean;
  /** Description/documentation */
  description?: string;
}

/**
 * Environment variable usage
 */
export interface EnvUsage {
  /** Variable name */
  name: string;
  /** Source file path */
  file: string;
  /** Line number */
  line: number;
  /** Usage type */
  source: 'process.env' | 'Deno.env.get' | 'import.meta.env' | 'Bun.env' | 'config';
  /** Whether has default value fallback */
  hasDefault: boolean;
  /** Default value if present */
  defaultValue?: string;
  /** Context (function/class name) */
  context?: string;
}

/**
 * Mismatch types
 */
export type MismatchType = 
  | 'used-but-undefined'      // Variable used in code but not defined anywhere
  | 'defined-but-unused'      // Variable defined but never used
  | 'renamed-drift'           // Variable renamed but old name still used
  | 'type-mismatch'           // Type mismatch between definition and usage
  | 'required-missing-default'; // Required var has no default but usage has fallback

/**
 * Remediation action
 */
export type RemediationAction =
  | 'add-to-schema'           // Add to zod/joi schema
  | 'add-to-env-file'         // Add to .env.example
  | 'add-to-docs'             // Add to documentation
  | 'remove-usage'            // Remove unused code
  | 'add-default'             // Add default value
  | 'fix-type'                // Fix type mismatch
  | 'rename-usage';           // Update usage to new name

/**
 * Environment reality claim
 */
export interface EnvRealityClaim {
  /** Unique claim ID */
  id: string;
  /** Mismatch type */
  type: MismatchType;
  /** Variable name */
  variable: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Description */
  message: string;
  /** Usage location (if applicable) */
  usage?: EnvUsage;
  /** Definition location (if applicable) */
  definition?: EnvDefinition;
  /** Suggested remediation actions */
  remediation: RemediationAction[];
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Analysis result
 */
export interface EnvRealityResult {
  /** All definitions found */
  definitions: EnvDefinition[];
  /** All usages found */
  usages: EnvUsage[];
  /** All claims/issues found */
  claims: EnvRealityClaim[];
  /** Summary statistics */
  summary: {
    totalDefinitions: number;
    totalUsages: number;
    totalClaims: number;
    usedButUndefined: number;
    definedButUnused: number;
    renamedDrift: number;
    typeMismatches: number;
  };
}
