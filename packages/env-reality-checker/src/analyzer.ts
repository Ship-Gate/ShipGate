/**
 * Analyze environment variable definitions vs usage
 * Detect mismatches and generate claims
 */

import * as crypto from 'crypto';
import type {
  EnvDefinition,
  EnvUsage,
  EnvRealityClaim,
  EnvRealityResult,
  MismatchType,
  RemediationAction,
} from './types.js';

/**
 * Analyze environment variable reality
 */
export function analyzeEnvReality(
  definitions: EnvDefinition[],
  usages: EnvUsage[]
): EnvRealityResult {
  const claims: EnvRealityClaim[] = [];

  // Create maps for efficient lookup
  const defMap = new Map<string, EnvDefinition[]>();
  const usageMap = new Map<string, EnvUsage[]>();

  for (const def of definitions) {
    if (!defMap.has(def.name)) {
      defMap.set(def.name, []);
    }
    defMap.get(def.name)!.push(def);
  }

  for (const usage of usages) {
    if (!usageMap.has(usage.name)) {
      usageMap.set(usage.name, []);
    }
    usageMap.get(usage.name)!.push(usage);
  }

  // 1. Check for used-but-undefined variables
  for (const [varName, usageList] of usageMap.entries()) {
    if (!defMap.has(varName)) {
      for (const usage of usageList) {
        claims.push(createClaim('used-but-undefined', varName, usage, undefined));
      }
    }
  }

  // 2. Check for defined-but-unused variables
  for (const [varName, defList] of defMap.entries()) {
    if (!usageMap.has(varName)) {
      // Skip common system/env vars that might be used by frameworks
      if (isCommonSystemVar(varName)) continue;

      for (const def of defList) {
        claims.push(createClaim('defined-but-unused', varName, undefined, def));
      }
    }
  }

  // 3. Check for type mismatches
  for (const [varName, usageList] of usageMap.entries()) {
    const defList = defMap.get(varName);
    if (!defList) continue;

    for (const def of defList) {
      for (const usage of usageList) {
        // Check if usage has default but definition requires it
        if (def.required && usage.hasDefault && !def.defaultValue) {
          claims.push(createClaim('required-missing-default', varName, usage, def));
        }

        // Check type hints if available
        if (def.typeHint && usage.defaultValue) {
          const typeMismatch = checkTypeMismatch(def.typeHint, usage.defaultValue);
          if (typeMismatch) {
            claims.push(createClaim('type-mismatch', varName, usage, def));
          }
        }
      }
    }
  }

  // 4. Check for renamed drift (similar names)
  checkRenamedDrift(defMap, usageMap, claims);

  // Calculate summary
  const summary = {
    totalDefinitions: definitions.length,
    totalUsages: usages.length,
    totalClaims: claims.length,
    usedButUndefined: claims.filter(c => c.type === 'used-but-undefined').length,
    definedButUnused: claims.filter(c => c.type === 'defined-but-unused').length,
    renamedDrift: claims.filter(c => c.type === 'renamed-drift').length,
    typeMismatches: claims.filter(c => c.type === 'type-mismatch').length,
  };

  return {
    definitions,
    usages,
    claims,
    summary,
  };
}

/**
 * Create a claim
 */
function createClaim(
  type: MismatchType,
  variable: string,
  usage: EnvUsage | undefined,
  definition: EnvDefinition | undefined
): EnvRealityClaim {
  const id = crypto.randomUUID();
  const remediation = getRemediationActions(type, definition);

  let severity: 'error' | 'warning' | 'info';
  let message: string;

  switch (type) {
    case 'used-but-undefined':
      severity = 'error';
      message = `Environment variable "${variable}" is used but not defined in any .env file, schema, or deployment manifest`;
      break;
    case 'defined-but-unused':
      severity = 'warning';
      message = `Environment variable "${variable}" is defined but never used in code`;
      break;
    case 'renamed-drift':
      severity = 'warning';
      message = `Environment variable "${variable}" may have been renamed (similar name found)`;
      break;
    case 'type-mismatch':
      severity = 'warning';
      message = `Type mismatch for "${variable}": definition expects ${definition?.typeHint} but usage suggests different type`;
      break;
    case 'required-missing-default':
      severity = 'info';
      message = `Required variable "${variable}" has no default in definition but usage provides fallback`;
      break;
    default:
      severity = 'warning';
      message = `Issue with environment variable "${variable}"`;
  }

  return {
    id,
    type,
    variable,
    severity,
    message,
    usage,
    definition,
    remediation,
  };
}

/**
 * Get remediation actions for a mismatch type
 */
function getRemediationActions(
  type: MismatchType,
  definition: EnvDefinition | undefined
): RemediationAction[] {
  switch (type) {
    case 'used-but-undefined':
      return ['add-to-schema', 'add-to-env-file', 'add-to-docs'];
    case 'defined-but-unused':
      return ['remove-usage', 'add-to-docs'];
    case 'renamed-drift':
      return ['rename-usage'];
    case 'type-mismatch':
      return ['fix-type', 'add-to-schema'];
    case 'required-missing-default':
      return ['add-default', 'add-to-schema'];
    default:
      return [];
  }
}

/**
 * Check for renamed drift (similar variable names)
 */
function checkRenamedDrift(
  defMap: Map<string, EnvDefinition[]>,
  usageMap: Map<string, EnvUsage[]>,
  claims: EnvRealityClaim[]
): void {
  // Find variables that are used but not defined, and check for similar names
  for (const [usedVar, usageList] of usageMap.entries()) {
    if (defMap.has(usedVar)) continue; // Already defined

    // Look for similar names in definitions
    for (const [defVar, defList] of defMap.entries()) {
      if (usageMap.has(defVar)) continue; // Already used

      const similarity = calculateSimilarity(usedVar, defVar);
      if (similarity > 0.8) {
        // High similarity suggests rename
        for (const usage of usageList) {
          for (const def of defList) {
            claims.push({
              id: crypto.randomUUID(),
              type: 'renamed-drift',
              variable: usedVar,
              severity: 'warning',
              message: `Variable "${usedVar}" is used but "${defVar}" is defined (possible rename)`,
              usage,
              definition: def,
              remediation: ['rename-usage'],
              context: {
                suggestedName: defVar,
                similarity,
              },
            });
          }
        }
      }
    }
  }
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check type mismatch
 */
function checkTypeMismatch(typeHint: string, value: string): boolean {
  switch (typeHint) {
    case 'number':
      return isNaN(Number(value));
    case 'boolean':
      return value !== 'true' && value !== 'false';
    case 'url':
      try {
        new URL(value);
        return false;
      } catch {
        return true;
      }
    default:
      return false;
  }
}

/**
 * Check if variable is a common system variable
 */
function isCommonSystemVar(varName: string): boolean {
  const commonVars = [
    'NODE_ENV',
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'TZ',
    'LANG',
    'LC_ALL',
    'CI',
    'GITHUB_ACTIONS',
    'VERCEL',
    'NETLIFY',
  ];

  return commonVars.includes(varName) || varName.startsWith('npm_') || varName.startsWith('NPM_');
}
