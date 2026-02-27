/**
 * Anthropic Claude API Integration
 * 
 * Handles code generation using Claude models.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0;

export class AnthropicClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: AnthropicOptions = {}) {
    const apiKey = options.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required. ' +
        'Set it via options.apiKey or ANTHROPIC_API_KEY environment variable.'
      );
    }

    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  }

  /**
   * Generate code using Claude
   */
  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<AnthropicOptions>
  ): Promise<AnthropicResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const temperature = options?.temperature ?? this.temperature;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = this.extractContent(response);

    return {
      content,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason ?? 'unknown',
    };
  }

  /**
   * Generate with retry on rate limit
   */
  async generateWithRetry(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<AnthropicOptions>,
    maxRetries: number = 3
  ): Promise<AnthropicResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generate(systemPrompt, userPrompt, options);
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError ?? new Error('Max retries exceeded');
  }

  /**
   * Generate with streaming (for long responses)
   */
  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    options?: Partial<AnthropicOptions>
  ): Promise<AnthropicResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const temperature = options?.temperature ?? this.temperature;

    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    let fullContent = '';
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullContent += text;
        onChunk(text);
      }
    }

    const finalMessage = await stream.finalMessage();

    return {
      content: fullContent,
      model: finalMessage.model,
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
      stopReason: finalMessage.stop_reason ?? 'unknown',
    };
  }

  private extractContent(response: Anthropic.Message): string {
    const content = response.content[0];
    if (content?.type !== 'text') {
      throw new Error('Unexpected response format from Claude: expected text content');
    }
    return content.text;
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Anthropic.RateLimitError) {
      return true;
    }
    if (error instanceof Error && error.message.includes('rate_limit')) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available models
   */
  static getAvailableModels(): string[] {
    return [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }

  /**
   * Check if a model is valid
   */
  static isValidModel(model: string): boolean {
    return AnthropicClient.getAvailableModels().includes(model) || 
           model.startsWith('claude-');
  }
}

/**
 * Create a simple generate function for one-off use
 */
export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: AnthropicOptions
): Promise<string> {
  const client = new AnthropicClient(options);
  const response = await client.generate(systemPrompt, userPrompt);
  return response.content;
}
