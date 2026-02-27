/**
 * Grounded Spec Generation — Main Orchestrator
 *
 * End-to-end pipeline: Source Code → Code Facts → AI (constrained JSON) → ISL
 *
 * The trick: don't ask AI to "understand the business." Ask it to propose
 * constraints grounded in code facts you provide. If the AI can't cite
 * evidence, confidence drops and the rule is flagged "speculative."
 *
 * @module @isl-lang/ai-generator/grounded-spec
 */

import * as fs from 'node:fs';
import { extractCodeFacts } from './fact-extractor.js';
import { buildSystemPrompt, buildUserPrompt, parseAIResponse } from './prompt-builder.js';
import { behaviorsToISL } from './json-to-isl.js';
import { computeConfidenceBudget, formatBudgetReport } from './confidence-budget.js';
import { AnthropicClient } from '../models/anthropic.js';
import { OpenAIClient } from '../models/openai.js';
import type {
  GroundedSpecOptions,
  GroundedSpecResult,
  CodeFacts,
  GroundedSpecResponse,
  GroundedBehavior,
  SpecConfidenceBudget,
} from './types.js';

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate an evidence-grounded ISL spec from a source file.
 *
 * Pipeline:
 * 1. Extract code facts (signatures, control flow, schemas, call sites)
 * 2. Build a constrained prompt with those facts
 * 3. Call AI, forcing JSON output schema
 * 4. Parse + validate the structured response
 * 5. Compute confidence budget
 * 6. Convert to ISL with speculative annotations
 *
 * @example
 * ```typescript
 * const result = await generateGroundedSpec({
 *   filePath: './src/services/auth.ts',
 *   projectRoot: './src',
 *   provider: 'anthropic',
 * });
 *
 * console.log(result.isl);    // ISL spec string
 * console.log(result.budget); // Confidence budget
 * ```
 */
export async function generateGroundedSpec(
  options: GroundedSpecOptions,
): Promise<GroundedSpecResult> {
  const {
    filePath,
    sourceCode: providedSource,
    projectRoot,
    provider = 'anthropic',
    model,
    apiKey,
    maxCallSites = 3,
    minConfidence = 0.4,
    includeSpeculative = true,
  } = options;

  // Step 1: Read source if not provided
  const sourceCode = providedSource ?? fs.readFileSync(filePath, 'utf-8');

  // Step 2: Extract code facts
  const facts = await extractCodeFacts({
    filePath,
    sourceCode,
    projectRoot,
    maxCallSites,
  });

  if (facts.length === 0) {
    return {
      isl: `// No exported functions found in ${filePath}\ndomain Empty {\n}\n`,
      behaviors: [],
      budget: computeConfidenceBudget([]),
      facts: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  // Step 3: Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(facts);

  // Step 4: Call AI
  const aiResponse = await callAI(systemPrompt, userPrompt, { provider, model, apiKey });

  // Step 5: Parse structured response
  const parsed = parseAIResponse(aiResponse.content);

  // Step 6: Compute confidence budget
  const budget = computeConfidenceBudget(parsed.behaviors);

  // Step 7: Convert to ISL
  const isl = behaviorsToISL(parsed.behaviors, {
    minConfidence,
    includeSpeculative,
    includeConfidenceComments: true,
    budget,
  });

  return {
    isl,
    behaviors: parsed.behaviors,
    budget,
    facts,
    usage: {
      inputTokens: aiResponse.usage.inputTokens,
      outputTokens: aiResponse.usage.outputTokens,
    },
  };
}

/**
 * Generate grounded spec from source code string (no file read needed).
 */
export async function generateGroundedSpecFromSource(
  sourceCode: string,
  options: Omit<GroundedSpecOptions, 'sourceCode'> & { filePath?: string },
): Promise<GroundedSpecResult> {
  return generateGroundedSpec({
    ...options,
    filePath: options.filePath ?? 'inline.ts',
    sourceCode,
  });
}

/**
 * Extract code facts only (no AI call). Useful for inspection/debugging.
 */
export async function extractFacts(
  filePath: string,
  sourceCode?: string,
  projectRoot?: string,
): Promise<CodeFacts[]> {
  const code = sourceCode ?? fs.readFileSync(filePath, 'utf-8');
  return extractCodeFacts({ filePath, sourceCode: code, projectRoot });
}

// ============================================================================
// AI call abstraction
// ============================================================================

interface AICallOptions {
  provider: 'anthropic' | 'openai';
  model?: string;
  apiKey?: string;
}

interface AICallResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options: AICallOptions,
): Promise<AICallResult> {
  if (options.provider === 'openai') {
    const client = new OpenAIClient({
      apiKey: options.apiKey,
      model: options.model ?? 'gpt-4-turbo-preview',
      maxTokens: 8192,
      temperature: 0,
    });

    const response = await client.generateWithRetry(systemPrompt, userPrompt);
    return {
      content: response.content,
      usage: {
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
      },
    };
  }

  // Default: Anthropic
  const client = new AnthropicClient({
    apiKey: options.apiKey,
    model: options.model ?? 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    temperature: 0,
  });

  const response = await client.generateWithRetry(systemPrompt, userPrompt);
  return {
    content: response.content,
    usage: {
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    },
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { extractCodeFacts } from './fact-extractor.js';
export { detectSchemas } from './schema-detector.js';
export { findCallSites } from './call-site-finder.js';
export { buildSystemPrompt, buildUserPrompt, parseAIResponse } from './prompt-builder.js';
export { behaviorsToISL } from './json-to-isl.js';
export { computeConfidenceBudget, formatBudgetReport } from './confidence-budget.js';

export type {
  CodeFacts,
  FunctionSignature,
  ControlFlowIR,
  ThrowSite,
  ExternalCall,
  ReturnShape,
  DocstringInfo,
  SchemaInfo,
  SchemaField,
  CallSiteExample,
  GroundedBehavior,
  GroundedCondition,
  GroundedError,
  GroundedEffect,
  GroundedSpecResponse,
  GroundedSpecOptions,
  GroundedSpecResult,
  SpecConfidenceBudget,
  ConfidenceAssessment,
  EvidenceQuality,
} from './types.js';
