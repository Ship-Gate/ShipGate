/**
 * AI Model Clients
 * 
 * Integrations with Anthropic (Claude) and OpenAI (GPT) APIs.
 */

export {
  AnthropicClient,
  generateWithClaude,
  type AnthropicOptions,
  type AnthropicResponse,
} from './anthropic.js';

export {
  OpenAIClient,
  generateWithGPT,
  type OpenAIOptions,
  type OpenAIResponse,
} from './openai.js';
