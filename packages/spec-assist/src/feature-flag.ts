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
    const provider = getProviderFromEnv();
    return {
      enabled,
      source: 'env',
      provider,
    };
  }
  
  // Check config file
  const configResult = loadConfigFile();
  if (configResult !== null) {
    return {
      enabled: configResult.enabled,
      source: 'config',
      provider: configResult.provider,
    };
  }
  
  // Default: disabled
  return {
    enabled: false,
    source: 'default',
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
  
  return {
    provider: flag.provider ?? 'stub',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ISL_AI_MODEL,
    maxTokens: 4096,
    temperature: 0.3,
  };
}
