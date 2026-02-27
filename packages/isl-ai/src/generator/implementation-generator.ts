/**
 * AI Implementation Generator
 * 
 * Generates TypeScript implementations from ISL specs using Claude.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import { generateSystemPrompt, generateImplementationPrompt, generateTypesFromDomain, type PromptContext } from '../prompts/templates.js';

export interface GenerationResult {
  behaviorName: string;
  implementation: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

export interface GeneratorOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ImplementationGenerator {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: GeneratorOptions = {}) {
    const apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env['ANTHROPIC_API_KEY'] : undefined);
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required. Set it via options or environment variable.');
    }

    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? 'claude-sonnet-4-20250514';
    this.maxTokens = options.maxTokens ?? 4096;
    this.temperature = options.temperature ?? 0;
  }

  /**
   * Generate implementation for a single behavior
   */
  async generateBehavior(
    domain: DomainDeclaration,
    behavior: BehaviorDeclaration
  ): Promise<GenerationResult> {
    // Generate TypeScript types for context
    const generatedTypes = generateTypesFromDomain(domain);

    // Build prompt context
    const ctx: PromptContext = {
      domain,
      behavior,
      generatedTypes,
      existingEntities: domain.entities,
    };

    // Generate prompts
    const systemPrompt = generateSystemPrompt();
    const userPrompt = generateImplementationPrompt(ctx);

    // Call Claude
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract implementation from response
    const implementation = this.extractCode(response);

    return {
      behaviorName: behavior.name.name,
      implementation,
      model: this.model,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }

  /**
   * Generate implementations for all behaviors in a domain
   */
  async generateDomain(domain: DomainDeclaration): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const behavior of domain.behaviors) {
      const result = await this.generateBehavior(domain, behavior);
      results.push(result);
    }

    return results;
  }

  /**
   * Extract code from Claude response
   */
  private extractCode(response: Anthropic.Message): string {
    const content = response.content[0];
    if (content?.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    const text = content.text;

    // Try to extract code from markdown code blocks
    const codeBlockMatch = text.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1]!.trim();
    }

    // If no code block, return the whole text (assume it's code)
    return text.trim();
  }
}

/**
 * Generate implementation for a behavior
 */
export async function generateImplementation(
  domain: DomainDeclaration,
  behavior: BehaviorDeclaration,
  options?: GeneratorOptions
): Promise<GenerationResult> {
  const generator = new ImplementationGenerator(options);
  return generator.generateBehavior(domain, behavior);
}

/**
 * Generate implementations for all behaviors in a domain
 */
export async function generateAllImplementations(
  domain: DomainDeclaration,
  options?: GeneratorOptions
): Promise<GenerationResult[]> {
  const generator = new ImplementationGenerator(options);
  return generator.generateDomain(domain);
}
