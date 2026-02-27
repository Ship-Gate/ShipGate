/**
 * Anthropic Provider - Real AI Provider using Claude
 * 
 * This is the real provider for production use.
 * Requires ANTHROPIC_API_KEY environment variable or config.
 */

import type { ChatMessage, CompletionOptions, SpecAssistConfig } from '../types.js';
import { BaseProvider, type ProviderResponse } from './base.js';

/**
 * Anthropic Provider Implementation
 * 
 * Note: We dynamically import the SDK to avoid issues when not available.
 * This allows the stub provider to work without the anthropic package installed.
 */
export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';
  private client: unknown = null;
  private defaultModel = 'claude-3-5-sonnet-20241022';
  
  async initialize(config: SpecAssistConfig): Promise<void> {
    this.config = config;
    
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Anthropic API key required. Set ANTHROPIC_API_KEY env var or pass apiKey in config.'
      );
    }
    
    try {
      // Dynamic import to avoid bundling issues
      const Anthropic = await import('@anthropic-ai/sdk').then(m => m.default);
      this.client = new Anthropic({ apiKey });
    } catch (err) {
      throw new Error(
        `Failed to initialize Anthropic SDK: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  
  isReady(): boolean {
    return this.client !== null;
  }
  
  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }
    
    const model = this.config?.model ?? this.defaultModel;
    const maxTokens = options?.maxTokens ?? this.config?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? this.config?.temperature ?? 0.3;
    
    // Separate system message from conversation
    const systemMessage = messages.find(m => m.role === 'system')?.content ?? this.getSystemPrompt();
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    
    try {
      // Use the Anthropic SDK
      const anthropic = this.client as { messages: { create: (params: unknown) => Promise<AnthropicResponse> } };
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMessage,
        messages: conversationMessages,
        stop_sequences: options?.stop,
      });
      
      // Extract text from response
      const content = response.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('');
      
      return {
        content,
        tokens: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
        model: response.model,
      };
    } catch (err) {
      throw new Error(
        `Anthropic API error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/**
 * Anthropic API response type (simplified)
 */
interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Create Anthropic provider
 */
export function createAnthropicProvider(): AnthropicProvider {
  return new AnthropicProvider();
}
