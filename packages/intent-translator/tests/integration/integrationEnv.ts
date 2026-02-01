/**
 * Integration Test Environment Configuration
 * 
 * Handles API key detection and provider selection for translator integration tests.
 */

export type AIProvider = 'openai' | 'anthropic' | 'none';

export interface IntegrationEnvConfig {
  /** Whether integration tests can run */
  canRunIntegrationTests: boolean;
  /** The selected AI provider */
  provider: AIProvider;
  /** The API key for the selected provider */
  apiKey: string | undefined;
  /** Skip reason if tests cannot run */
  skipReason: string | null;
}

/**
 * Detects available API keys and selects the best provider
 */
export function detectIntegrationEnv(): IntegrationEnvConfig {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  // Prefer Anthropic if available (matches translator default)
  if (anthropicKey) {
    return {
      canRunIntegrationTests: true,
      provider: 'anthropic',
      apiKey: anthropicKey,
      skipReason: null,
    };
  }
  
  // Fall back to OpenAI
  if (openaiKey) {
    return {
      canRunIntegrationTests: true,
      provider: 'openai',
      apiKey: openaiKey,
      skipReason: null,
    };
  }
  
  return {
    canRunIntegrationTests: false,
    provider: 'none',
    apiKey: undefined,
    skipReason: 'No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY to run integration tests.',
  };
}

/**
 * Gets the model name for the selected provider
 */
export function getModelForProvider(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514';
    case 'openai':
      return 'gpt-4o';
    default:
      return '';
  }
}

/**
 * Creates API call options for the translator
 */
export function getTranslatorOptions(env: IntegrationEnvConfig) {
  return {
    apiKey: env.apiKey,
    model: getModelForProvider(env.provider),
  };
}
