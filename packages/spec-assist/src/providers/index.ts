/**
 * Provider Exports
 * 
 * Central export point for all AI providers.
 */

export { BaseProvider, type AIProvider, type ProviderResponse } from './base.js';
export { StubProvider, createStubProvider, INVALID_OUTPUTS } from './stub.js';
export { AnthropicProvider, createAnthropicProvider } from './anthropic.js';
export { OpenAIProvider, createOpenAIProvider } from './openai.js';

import type { SpecAssistConfig } from '../types.js';
import type { AIProvider } from './base.js';
import { StubProvider } from './stub.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

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
      return new OpenAIProvider();
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
