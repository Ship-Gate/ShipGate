/**
 * Policy Loader and Validator
 * 
 * Loads and validates .shipgate.policy.yml files
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { PolicyConfig, PolicyException, EvidenceRequirement } from './policy-schema.js';
import { DEFAULT_POLICY_CONFIG } from './policy-schema.js';
// @ts-ignore - minimatch v3 lacks type definitions
import { Minimatch } from 'minimatch';

export interface LoadedPolicy {
  /** The loaded policy config */
  config: PolicyConfig;
  /** Path to the policy file */
  filePath: string;
  /** Whether this is the default policy */
  isDefault: boolean;
}

export class PolicyValidationError extends Error {
  validationErrors: Array<{ field: string; message: string }>;
  
  constructor(message: string, errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'PolicyValidationError';
    this.validationErrors = errors;
  }
}

/**
 * Find and load policy file from directory hierarchy
 */
export async function loadPolicy(rootDir: string = process.cwd()): Promise<LoadedPolicy> {
  const policyFileNames = [
    '.shipgate.policy.yml',
    '.shipgate.policy.yaml',
    'shipgate.policy.yml',
    'shipgate.policy.yaml',
  ];

  // Search from rootDir up to filesystem root
  let currentDir = resolve(rootDir);
  const root = resolve('/');

  while (currentDir !== root && currentDir !== resolve(currentDir, '..')) {
    for (const fileName of policyFileNames) {
      const filePath = join(currentDir, fileName);
      if (existsSync(filePath)) {
        const config = await loadPolicyFile(filePath);
        return {
          config,
          filePath,
          isDefault: false,
        };
      }
    }
    currentDir = resolve(currentDir, '..');
  }

  // No policy file found, return defaults
  return {
    config: DEFAULT_POLICY_CONFIG,
    filePath: '',
    isDefault: true,
  };
}

/**
 * Load policy from a specific file
 */
export async function loadPolicyFile(filePath: string): Promise<PolicyConfig> {
  if (!existsSync(filePath)) {
    throw new Error(`Policy file not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  const parsed = parseYaml(content) as Partial<PolicyConfig>;

  // Validate and merge with defaults
  const config = validateAndMerge(parsed);

  return config;
}

/**
 * Validate and merge policy config with defaults
 */
function validateAndMerge(partial: Partial<PolicyConfig>): PolicyConfig {
  const errors: Array<{ field: string; message: string }> = [];

  // Validate version
  if (partial.version !== undefined && partial.version !== 1) {
    errors.push({
      field: 'version',
      message: `Unsupported version: ${partial.version}. Expected 1.`,
    });
  }

  // Validate profiles
  const profiles = partial.profiles ?? {};
  const defaultProfiles = DEFAULT_POLICY_CONFIG.profiles as any;
  const mergedProfiles = {
    strict: { ...defaultProfiles.strict, ...(profiles as any).strict },
    standard: { ...defaultProfiles.standard, ...(profiles as any).standard },
    lenient: { ...defaultProfiles.lenient, ...(profiles as any).lenient },
  };

  // Validate threshold ranges
  for (const [name, profile] of Object.entries(mergedProfiles)) {
    if (profile.minTrustScore < 0 || profile.minTrustScore > 100) {
      errors.push({
        field: `profiles.${name}.minTrustScore`,
        message: `minTrustScore must be between 0 and 100, got ${profile.minTrustScore}`,
      });
    }
    if (profile.minConfidence < 0 || profile.minConfidence > 100) {
      errors.push({
        field: `profiles.${name}.minConfidence`,
        message: `minConfidence must be between 0 and 100, got ${profile.minConfidence}`,
      });
    }
  }

  // Validate default profile
  const defaultProfile = partial.defaultProfile ?? DEFAULT_POLICY_CONFIG.defaultProfile;
  if (defaultProfile && !['strict', 'standard', 'lenient'].includes(defaultProfile)) {
    errors.push({
      field: 'defaultProfile',
      message: `defaultProfile must be one of: strict, standard, lenient. Got: ${defaultProfile}`,
    });
  }

  // Validate evidence requirements
  const requiredEvidence = partial.requiredEvidence ?? [];
  for (let i = 0; i < requiredEvidence.length; i++) {
    const req = requiredEvidence[i];
    if (!req.context || (!req.context.paths && !req.context.behaviors && !req.context.tags)) {
      errors.push({
        field: `requiredEvidence[${i}].context`,
        message: 'Evidence requirement must specify at least one context (paths, behaviors, or tags)',
      });
    }
    if (!req.evidenceTypes || req.evidenceTypes.length === 0) {
      errors.push({
        field: `requiredEvidence[${i}].evidenceTypes`,
        message: 'Evidence requirement must specify at least one evidence type',
      });
    }
    if (req.severity && !['error', 'warning'].includes(req.severity)) {
      errors.push({
        field: `requiredEvidence[${i}].severity`,
        message: `severity must be 'error' or 'warning', got: ${req.severity}`,
      });
    }
  }

  // Validate exceptions
  const exceptions = partial.exceptions ?? [];
  for (let i = 0; i < exceptions.length; i++) {
    const exc = exceptions[i];
    if (!exc.id) {
      errors.push({
        field: `exceptions[${i}].id`,
        message: 'Exception must have an id',
      });
    }
    if (!exc.expiresAt) {
      errors.push({
        field: `exceptions[${i}].expiresAt`,
        message: 'Exception must have an expiresAt date',
      });
    } else {
      const expiresDate = new Date(exc.expiresAt);
      if (isNaN(expiresDate.getTime())) {
        errors.push({
          field: `exceptions[${i}].expiresAt`,
          message: `Invalid date format: ${exc.expiresAt}`,
        });
      }
    }
    if (!exc.justification) {
      errors.push({
        field: `exceptions[${i}].justification`,
        message: 'Exception must have a justification',
      });
    }
  }

  if (errors.length > 0) {
    throw new PolicyValidationError(
      `Policy validation failed:\n${errors.map(e => `  ${e.field}: ${e.message}`).join('\n')}`,
      errors,
    );
  }

  return {
    version: partial.version ?? DEFAULT_POLICY_CONFIG.version,
    org: partial.org,
    profiles: mergedProfiles,
    defaultProfile: defaultProfile ?? DEFAULT_POLICY_CONFIG.defaultProfile,
    requiredEvidence: requiredEvidence.length > 0 ? requiredEvidence : DEFAULT_POLICY_CONFIG.requiredEvidence,
    exceptions: exceptions,
  };
}

/**
 * Check if an exception is still valid (not expired)
 */
export function isExceptionValid(exception: PolicyException): boolean {
  if (!exception.active) {
    return false;
  }

  const expiresAt = new Date(exception.expiresAt);
  const now = new Date();

  return now < expiresAt;
}

/**
 * Filter exceptions to only active, non-expired ones
 */
export function getActiveExceptions(exceptions: PolicyException[] = []): PolicyException[] {
  return exceptions.filter(isExceptionValid);
}

/**
 * Check if a path matches any exception scope
 */
export async function matchesExceptionScope(
  filePath: string,
  behaviorName: string | undefined,
  exception: PolicyException,
): Promise<boolean> {
  const scope = exception.scope;

  // Check path patterns
  if (scope.paths && scope.paths.length > 0) {
    try {
      // Try to use minimatch if available
      const minimatch = await import('minimatch').catch(() => null);
      if (minimatch) {
        for (const pattern of scope.paths) {
          if (minimatch.minimatch(filePath, pattern)) {
            return true;
          }
        }
      } else {
        // Fallback to simple regex matching
        for (const pattern of scope.paths) {
          const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(filePath)) {
            return true;
          }
        }
      }
    } catch {
      // Fallback to simple regex matching
      for (const pattern of scope.paths) {
        const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(filePath)) {
          return true;
        }
      }
    }
  }

  // Check behavior names
  if (scope.behaviors && behaviorName) {
    for (const pattern of scope.behaviors) {
      const regex = new RegExp(pattern);
      if (regex.test(behaviorName)) {
        return true;
      }
    }
  }

  return false;
}

