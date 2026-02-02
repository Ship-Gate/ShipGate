/**
 * @isl-lang/ai-generator
 * 
 * Generate implementations from ISL specifications using Claude/GPT APIs.
 * 
 * @example
 * ```typescript
 * import { generate } from '@isl-lang/ai-generator';
 * 
 * const result = await generate(domain, 'Login', {
 *   model: 'claude-sonnet-4-20250514',
 *   language: 'typescript'
 * });
 * 
 * console.log(result.code);       // Generated implementation
 * console.log(result.confidence); // 0.0 - 1.0 confidence score
 * ```
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import {
  Generator,
  createGenerator,
  createAnthropicGenerator,
  createOpenAIGenerator,
  isModelSupported,
  getSupportedModels,
  type GeneratorOptions,
  type GenerationResult,
  type GenerationMetadata,
} from './generator.js';

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate an implementation for a behavior from an ISL domain.
 * 
 * This is the main entry point for the AI generator.
 * 
 * @param domain - The parsed ISL domain declaration
 * @param behaviorName - The name of the behavior to generate
 * @param options - Generation options including model and language
 * @returns Promise with the generated code and confidence score
 * 
 * @example
 * ```typescript
 * const result = await generate(domain, 'PlaceOrder', {
 *   model: 'claude-sonnet-4-20250514',
 *   language: 'typescript'
 * });
 * 
 * if (result.confidence > 0.8) {
 *   writeFileSync('place-order.ts', result.code);
 * }
 * ```
 */
export async function generate(
  domain: DomainDeclaration,
  behaviorName: string,
  options: GeneratorOptions
): Promise<{ code: string; confidence: number }> {
  // Find the behavior in the domain
  const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
  
  if (!behavior) {
    throw new Error(
      `Behavior "${behaviorName}" not found in domain "${domain.name.name}". ` +
      `Available behaviors: ${domain.behaviors.map(b => b.name.name).join(', ')}`
    );
  }

  // Create generator and generate
  const generator = createGenerator(options);
  const result = await generator.generateBehavior(domain, behavior);

  return {
    code: result.code,
    confidence: result.confidence,
  };
}

/**
 * Generate implementations for all behaviors in a domain.
 * 
 * @param domain - The parsed ISL domain declaration
 * @param options - Generation options including model and language
 * @returns Promise with array of generation results
 * 
 * @example
 * ```typescript
 * const results = await generateAll(domain, {
 *   model: 'gpt-4-turbo-preview',
 *   language: 'typescript'
 * });
 * 
 * for (const result of results) {
 *   console.log(`${result.metadata.behaviorName}: ${result.confidence}`);
 * }
 * ```
 */
export async function generateAll(
  domain: DomainDeclaration,
  options: GeneratorOptions
): Promise<GenerationResult[]> {
  const generator = createGenerator(options);
  return generator.generateDomain(domain);
}

/**
 * Generate with streaming output for real-time feedback.
 * 
 * @param domain - The parsed ISL domain declaration
 * @param behaviorName - The name of the behavior to generate
 * @param options - Generation options
 * @param onChunk - Callback for each chunk of output
 * @returns Promise with the final generation result
 * 
 * @example
 * ```typescript
 * const result = await generateStream(
 *   domain, 
 *   'CreatePayment',
 *   { model: 'claude-sonnet-4-20250514', language: 'typescript' },
 *   (chunk) => process.stdout.write(chunk)
 * );
 * ```
 */
export async function generateStream(
  domain: DomainDeclaration,
  behaviorName: string,
  options: GeneratorOptions,
  onChunk: (chunk: string) => void
): Promise<GenerationResult> {
  const behavior = domain.behaviors.find(b => b.name.name === behaviorName);
  
  if (!behavior) {
    throw new Error(`Behavior "${behaviorName}" not found in domain "${domain.name.name}"`);
  }

  const generator = createGenerator(options);
  return generator.generateBehaviorStream(domain, behavior, onChunk);
}

// ============================================================================
// Re-exports
// ============================================================================

// Generator class and factories
export {
  Generator,
  createGenerator,
  createAnthropicGenerator,
  createOpenAIGenerator,
  isModelSupported,
  getSupportedModels,
};

// Types
export type {
  GeneratorOptions,
  GenerationResult,
  GenerationMetadata,
};

// Model clients (for advanced usage)
export { AnthropicClient, type AnthropicOptions, type AnthropicResponse } from './models/anthropic.js';
export { OpenAIClient, type OpenAIOptions, type OpenAIResponse } from './models/openai.js';

// Prompt utilities (for customization)
export {
  getCompleteSystemPrompt,
  getSystemPrompt,
  getLanguageAdditions,
  type SystemPromptOptions,
} from './prompts/system.js';

export {
  generateBehaviorPrompt,
  generateTypesFromDomain,
  expressionToReadable,
  typeToString,
  type BehaviorPromptContext,
} from './prompts/behavior.js';

// Extraction utilities
export {
  extractCode,
  extractPrimaryCode,
  extractMultipleCodeBlocks,
  validateExtraction,
  ExtractionError,
  type ExtractedCode,
  type ExtractionOptions,
} from './extraction.js';

// Validation utilities
export {
  validateCode,
  quickValidate,
  formatValidationResult,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationOptions,
  type CodeMetrics,
} from './validation.js';
