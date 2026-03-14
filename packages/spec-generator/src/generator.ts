/**
 * Spec Generator
 *
 * Converts natural language prompts into validated ISL domain specs
 * via LLM. Supports multi-provider (Anthropic, OpenAI) and automatic
 * retry with repair prompt on validation failure.
 *
 * @module @isl-lang/spec-generator/generator
 */

import type {
  SpecGeneratorOptions,
  SpecGenerationResult,
  SpecRefinementOptions,
  SpecRefinementResult,
  LLMProvider,
} from './types.js';
import {
  buildGenerationPrompt,
  buildRefinementPrompt,
  buildValidationRepairPrompt,
} from './prompts.js';
import { parseGeneratedISL } from './parser.js';

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-opus-4-5',
  openai: 'gpt-4o',
};

function resolveApiKey(provider: LLMProvider, provided?: string): string | null {
  if (provided) return provided;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY ?? null;
  if (provider === 'openai') return process.env.OPENAI_API_KEY ?? null;
  return null;
}

function resolveProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'anthropic';
}

async function callAnthropic(
  prompt: string,
  model: string,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<{ text: string; tokensUsed: number }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });
  const content = response.content[0];
  const text = content?.type === 'text' ? content.text : '';
  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
  return { text, tokensUsed };
}

async function callOpenAI(
  prompt: string,
  model: string,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<{ text: string; tokensUsed: number }> {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.choices[0]?.message.content ?? '';
  const tokensUsed = response.usage?.total_tokens ?? 0;
  return { text, tokensUsed };
}

async function callLLM(
  prompt: string,
  provider: LLMProvider,
  model: string,
  apiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<{ text: string; tokensUsed: number }> {
  if (provider === 'anthropic') {
    return callAnthropic(prompt, model, apiKey, maxTokens, temperature);
  }
  return callOpenAI(prompt, model, apiKey, maxTokens, temperature);
}

export async function generateSpec(
  userPrompt: string,
  options: SpecGeneratorOptions = {},
): Promise<SpecGenerationResult> {
  const start = Date.now();
  const provider = options.provider ?? resolveProvider();
  const model = options.model ?? DEFAULT_MODELS[provider];
  const maxTokens = options.maxTokens ?? 4096;
  const temperature = options.temperature ?? 0.2;
  const apiKey = resolveApiKey(provider, options.apiKey);

  if (!apiKey) {
    return {
      success: false,
      spec: null,
      rawISL: '',
      errors: [`No API key for ${provider}. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'}`],
      model,
      durationMs: Date.now() - start,
    };
  }

  const prompt = buildGenerationPrompt(userPrompt, options.template);
  let totalTokens = 0;

  try {
    const { text, tokensUsed } = await callLLM(prompt, provider, model, apiKey, maxTokens, temperature);
    totalTokens += tokensUsed;

    let parsed = parseGeneratedISL(text, userPrompt, model);

    if (!parsed.isValid && parsed.validationErrors.length > 0) {
      const repairPrompt = buildValidationRepairPrompt(parsed.rawISL, parsed.validationErrors);
      const { text: repaired, tokensUsed: repairTokens } = await callLLM(
        repairPrompt, provider, model, apiKey, maxTokens, temperature,
      );
      totalTokens += repairTokens;
      parsed = parseGeneratedISL(repaired, userPrompt, model);
    }

    return {
      success: parsed.isValid,
      spec: parsed,
      rawISL: parsed.rawISL,
      errors: parsed.validationErrors,
      tokensUsed: totalTokens,
      model,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      spec: null,
      rawISL: '',
      errors: [err instanceof Error ? err.message : String(err)],
      tokensUsed: totalTokens,
      model,
      durationMs: Date.now() - start,
    };
  }
}

export async function refineSpec(
  options: SpecRefinementOptions,
): Promise<SpecRefinementResult> {
  const start = Date.now();
  const provider = options.provider ?? resolveProvider();
  const model = options.model ?? DEFAULT_MODELS[provider];
  const maxTokens = options.maxTokens ?? 4096;
  const temperature = options.temperature ?? 0.2;
  const apiKey = resolveApiKey(provider, options.apiKey);

  if (!apiKey) {
    return {
      success: false,
      updatedSpec: null,
      rawISL: '',
      changeSummary: '',
      errors: [`No API key for ${provider}`],
      durationMs: Date.now() - start,
    };
  }

  const prompt = buildRefinementPrompt(options.existingSpec, options.changeRequest);

  try {
    const { text } = await callLLM(prompt, provider, model, apiKey, maxTokens, temperature);
    const parsed = parseGeneratedISL(text, options.changeRequest, model);

    const summaryMatch = text.match(/^\/\/\s*Changes:\s*(.+)/m);
    const changeSummary = summaryMatch?.[1]?.trim() ?? options.changeRequest.slice(0, 100);

    return {
      success: parsed.isValid,
      updatedSpec: parsed,
      rawISL: parsed.rawISL,
      changeSummary,
      errors: parsed.validationErrors,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      updatedSpec: null,
      rawISL: '',
      changeSummary: '',
      errors: [err instanceof Error ? err.message : String(err)],
      durationMs: Date.now() - start,
    };
  }
}
