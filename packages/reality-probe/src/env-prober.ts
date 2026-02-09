/**
 * Environment Variable Prober
 * 
 * Verifies that required environment variables exist and are not placeholders.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { EnvVarProbeResult, EnvVarEntry } from './types.js';

/**
 * Load environment variables from JSON file (truthpack env.json format)
 */
export async function loadEnvVars(path: string): Promise<EnvVarEntry[]> {
  if (!existsSync(path)) {
    throw new Error(`Env vars file not found: ${path}`);
  }

  const content = await readFile(path, 'utf-8');
  const data = JSON.parse(content);

  // Handle truthpack format: { env: [...] }
  if (data.env && Array.isArray(data.env)) {
    return data.env.map((e: any) => ({
      name: e.name,
      required: e.required || false,
      sensitive: e.sensitive || false,
      description: e.description,
    }));
  }

  // Handle direct array format
  if (Array.isArray(data)) {
    return data.map((e: any) => ({
      name: e.name,
      required: e.required || false,
      sensitive: e.sensitive || false,
      description: e.description,
    }));
  }

  throw new Error(`Invalid env vars format in ${path}`);
}

/**
 * Check if a value looks like a placeholder
 */
function isPlaceholder(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  
  const placeholderPatterns = [
    /^your[_-]?/i,
    /^changeme$/i,
    /^replace[_-]?me$/i,
    /^xxx+$/i,
    /^todo$/i,
    /^fixme$/i,
    /^placeholder$/i,
    /^example$/i,
    /^test$/i,
    /^dummy$/i,
    /^fake$/i,
    /^sample$/i,
    /^sk_test_/i,
    /^pk_test_/i,
    /^insert[_-]?here$/i,
    /^<.*>$/,
    /^\[.*\]$/,
    /^\{.*\}$/,
  ];

  return placeholderPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Probe a single environment variable
 */
export function probeEnvVar(
  envVar: EnvVarEntry,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): EnvVarProbeResult {
  const value = env[envVar.name];
  const exists = value !== undefined;
  const hasValue = exists && value.trim().length > 0;
  const isPlaceholderValue = hasValue ? isPlaceholder(value) : false;
  
  // A ghost env var is one that's required but missing or has placeholder value
  const isGhost = envVar.required && (!exists || !hasValue || isPlaceholderValue);

  return {
    name: envVar.name,
    exists,
    hasValue,
    isPlaceholder: isPlaceholderValue,
    isGhost,
    error: isGhost 
      ? envVar.required && !exists 
        ? 'Required but missing'
        : envVar.required && !hasValue
        ? 'Required but empty'
        : envVar.required && isPlaceholderValue
        ? 'Required but has placeholder value'
        : undefined
      : undefined,
  };
}

/**
 * Probe multiple environment variables
 */
export function probeEnvVars(
  envVars: EnvVarEntry[],
  env?: Record<string, string | undefined>
): EnvVarProbeResult[] {
  const runtimeEnv = env || (process.env as Record<string, string | undefined>);
  return envVars.map(envVar => probeEnvVar(envVar, runtimeEnv));
}

/**
 * Load and probe environment variables from file
 */
export async function probeEnvVarsFromSource(
  envVarsPath: string,
  env?: Record<string, string | undefined>
): Promise<EnvVarProbeResult[]> {
  const envVars = await loadEnvVars(envVarsPath);
  return probeEnvVars(envVars, env);
}
