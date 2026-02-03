/**
 * Provider Exports
 * 
 * Central export point for all AI providers.
 */

export { BaseProvider, type AIProvider, type ProviderResponse } from './base.js';
export { StubProvider, createStubProvider, INVALID_OUTPUTS } from './stub.js';
export { AnthropicProvider, createAnthropicProvider } from './anthropic.js';

import type { SpecAssistConfig } from '../types.js';
import type { AIProvider } from './base.js';
import { StubProvider } from './stub.js';
import { AnthropicProvider } from './anthropic.js';

/**
 * Create a provider instance based on config
 */
export function createProvider(config: SpecAssistConfig): AIProvider {
  switch (config.provider) {
    case 'stub':
      return new StubProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
      // OpenAI not implemented yet - fall back to stub with warning
      console.warn('OpenAI provider not implemented. Falling back to stub provider.');
      return new StubProvider();
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
