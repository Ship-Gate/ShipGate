/**
 * Feature Flag for AI Assist
 * 
 * Controls whether AI-assisted spec generation is enabled.
 * Must be explicitly enabled - defaults to OFF.
 * 
 * Ways to enable:
 * 1. Environment variable: ISL_AI_ENABLED=true
 * 2. Config file: .islrc.json with { "ai": { "enabled": true } }
 * 3. CLI flag: --ai
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { FeatureFlagConfig, SpecAssistConfig } from './types.js';

/**
 * Environment variable name for enabling AI assist
 */
export const AI_ENABLED_ENV = 'ISL_AI_ENABLED';

/**
 * Environment variable for provider selection
 */
export const AI_PROVIDER_ENV = 'ISL_AI_PROVIDER';

/**
 * Config file name
 */
export const CONFIG_FILE = '.islrc.json';

/**
 * Check if AI assist is enabled
 */
export function isAIEnabled(): FeatureFlagConfig {
  // Check environment variable first
  const envEnabled = process.env[AI_ENABLED_ENV];
  if (envEnabled !== undefined) {
    const enabled = envEnabled.toLowerCase() === 'true' || envEnabled === '1';
    const provider = getProviderFromEnv() ?? inferProviderFromEnv();
    return {
      enabled,
      source: 'env',
      provider,
    };
  }

  // If an API key is set, treat AI as enabled (so shipgate go works with just .env)
  const inferred = inferProviderFromEnv();
  if (inferred !== 'stub') {
    return {
      enabled: true,
      source: 'default',
      provider: inferred,
    };
  }

  // Check config file
  const configResult = loadConfigFile();
  if (configResult !== null) {
    return {
      enabled: configResult.enabled,
      source: 'config',
      provider: configResult.provider ?? inferred,
    };
  }

  // Default: disabled
  return {
    enabled: false,
    source: 'default',
    provider: inferred,
  };
}

/**
 * Get provider from environment variable
 */
function getProviderFromEnv(): SpecAssistConfig['provider'] | undefined {
  const provider = process.env[AI_PROVIDER_ENV];
  if (provider === 'stub' || provider === 'anthropic' || provider === 'openai') {
    return provider;
  }
  return undefined;
}

/**
 * Load config from .islrc.json
 */
function loadConfigFile(): { enabled: boolean; provider?: SpecAssistConfig['provider'] } | null {
  const configPath = resolve(process.cwd(), CONFIG_FILE);
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as { ai?: { enabled?: boolean; provider?: string } };
    
    if (config.ai?.enabled !== undefined) {
      let provider: SpecAssistConfig['provider'] | undefined;
      if (config.ai.provider === 'stub' || config.ai.provider === 'anthropic' || config.ai.provider === 'openai') {
        provider = config.ai.provider;
      }
      return {
        enabled: Boolean(config.ai.enabled),
        provider,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Require AI to be enabled, throwing helpful error if not
 */
export function requireAIEnabled(): void {
  const flag = isAIEnabled();
  
  if (!flag.enabled) {
    throw new Error(
      `AI assist is not enabled. To enable, do one of:
  1. Set environment variable: ${AI_ENABLED_ENV}=true
  2. Add to ${CONFIG_FILE}: { "ai": { "enabled": true } }
  3. Use CLI flag: --ai

Note: AI-generated specs are ALWAYS validated by the ISL verifier.
AI cannot bypass verification gates.`
    );
  }
}

/**
 * Get default config based on feature flags
 */
export function getDefaultConfig(): SpecAssistConfig {
  const flag = isAIEnabled();
  const provider = flag.provider ?? inferProviderFromEnv();
  const apiKey =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;

  return {
    provider,
    apiKey,
    model: process.env.ISL_AI_MODEL,
    maxTokens: 2048,
    temperature: 0.3,
  };
}

/**
 * Infer provider from env when not explicitly set (OPENAI or ANTHROPIC key)
 */
function inferProviderFromEnv(): SpecAssistConfig['provider'] {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'stub';
}
