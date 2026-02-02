/**
 * Anthropic Claude Provider
 */
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base';
import type {
  CopilotConfig,
  ConversationContext,
  GenerationResult,
  CompletionResult,
  CompletionRequest,
} from '../types';

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic';
  private client: Anthropic | null = null;
  private model = 'claude-sonnet-4-20250514';

  async initialize(config: CopilotConfig): Promise<void> {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model ?? 'claude-sonnet-4-20250514';
  }

  async generate(prompt: string, context?: ConversationContext): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error('Anthropic provider not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const contextStr = this.formatContext(context);
    const fullPrompt = contextStr ? `${contextStr}\n\nUser Request: ${prompt}` : prompt;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.config?.maxTokens ?? 4096,
      temperature: this.config?.temperature ?? 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';

    return {
      content: text,
      type: 'isl',
      confidence: 0.9,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.client) {
      throw new Error('Anthropic provider not initialized');
    }

    const prompt = `Complete the following ISL code. Return only the completion, no explanation.

Prefix:
\`\`\`isl
${request.prefix}
\`\`\`
${request.suffix ? `\nSuffix:\n\`\`\`isl\n${request.suffix}\n\`\`\`` : ''}

Provide ${request.maxCompletions ?? 3} possible completions as a JSON array.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      temperature: 0.3,
      system: this.buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '[]';

    try {
      const completions = JSON.parse(text);
      return {
        completions: completions.map((c: string, i: number) => ({
          text: c,
          displayText: c.split('\n')[0],
          kind: 'snippet' as const,
          score: 1 - i * 0.1,
        })),
      };
    } catch {
      return {
        completions: [
          {
            text: text.trim(),
            displayText: text.trim().split('\n')[0],
            kind: 'snippet',
            score: 0.8,
          },
        ],
      };
    }
  }

  async streamGenerate(
    prompt: string,
    context: ConversationContext | undefined,
    onChunk: (chunk: string) => void
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error('Anthropic provider not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const contextStr = this.formatContext(context);
    const fullPrompt = contextStr ? `${contextStr}\n\nUser Request: ${prompt}` : prompt;

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.config?.maxTokens ?? 4096,
      temperature: this.config?.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: fullPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if ('text' in delta) {
          fullContent += delta.text;
          onChunk(delta.text);
        }
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      }
    }

    return {
      content: fullContent,
      type: 'isl',
      confidence: 0.9,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
    };
  }

  countTokens(text: string): number {
    // Approximate token count (Claude uses ~4 chars per token on average)
    return Math.ceil(text.length / 4);
  }
}
