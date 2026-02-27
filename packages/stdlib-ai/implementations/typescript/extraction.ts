// ============================================================================
// ISL Standard Library - AI Extraction
// @isl-lang/stdlib-ai
// ============================================================================

import {
  type ExtractInput,
  type ExtractOutput,
  type ClassifyInput,
  type ClassifyOutput,
  type SummarizeInput,
  type SummarizeOutput,
  type EvaluateOutputInput,
  type EvaluateOutputResult,
  type JsonSchema,
  type ProviderConfig,
  SummaryStyle,
  EvaluationCriterion,
  AIError,
  AIErrorCode,
} from './types';

// ============================================================================
// Structured Extraction
// ============================================================================

/**
 * Extract structured data from text
 */
export async function extract<T = unknown>(
  input: ExtractInput<T>,
  _config?: ProviderConfig
): Promise<ExtractOutput<T>> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.text) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Text is required');
  }

  if (!input.schema) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Schema is required');
  }

  // This is a stub - real implementation would call LLM with structured output
  // For now, return a placeholder that matches common schema patterns
  const placeholderData = generatePlaceholderFromSchema(input.schema) as T;

  return {
    data: placeholderData,
    confidence: 0.85,
  };
}

/**
 * Extract multiple entities from text
 */
export async function extractMany<T = unknown>(
  model: string,
  text: string,
  schema: JsonSchema,
  _config?: ProviderConfig
): Promise<T[]> {
  const result = await extract<T[]>({
    model,
    text,
    schema: { type: 'array', items: schema },
  });
  return result.data;
}

// ============================================================================
// Classification
// ============================================================================

/**
 * Classify text into categories
 */
export async function classify(
  input: ClassifyInput,
  _config?: ProviderConfig
): Promise<ClassifyOutput> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.text) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Text is required');
  }

  if (!input.categories || input.categories.length === 0) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Categories are required');
  }

  // This is a stub - real implementation would call LLM
  // Return placeholder classifications
  const classifications = input.categories.map((cat, index) => ({
    category: cat.name,
    confidence: Math.max(0.1, 1 - index * 0.2),
  }));

  // Sort by confidence
  classifications.sort((a, b) => b.confidence - a.confidence);

  // If not multi-label, only return top result
  if (!input.multi_label) {
    const top = classifications[0];
    if (!top) {
      throw new AIError(AIErrorCode.EXTRACTION_FAILED, 'No classifications generated');
    }
    return { classifications: [top] };
  }

  return { classifications };
}

/**
 * Binary classification (yes/no)
 */
export async function classifyBinary(
  model: string,
  text: string,
  question: string,
  _config?: ProviderConfig
): Promise<{ result: boolean; confidence: number }> {
  const output = await classify({
    model,
    text,
    categories: [
      { name: 'yes', description: question },
      { name: 'no', description: `Not: ${question}` },
    ],
    multi_label: false,
  });

  const topResult = output.classifications[0];
  if (!topResult) {
    throw new AIError(AIErrorCode.EXTRACTION_FAILED, 'No classification result');
  }
  return {
    result: topResult.category === 'yes',
    confidence: topResult.confidence,
  };
}

/**
 * Sentiment analysis
 */
export async function analyzeSentiment(
  model: string,
  text: string,
  _config?: ProviderConfig
): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
  const output = await classify({
    model,
    text,
    categories: [
      { name: 'positive', description: 'Positive sentiment' },
      { name: 'negative', description: 'Negative sentiment' },
      { name: 'neutral', description: 'Neutral sentiment' },
    ],
    multi_label: false,
  });

  const topResult = output.classifications[0];
  if (!topResult) {
    throw new AIError(AIErrorCode.EXTRACTION_FAILED, 'No sentiment result');
  }
  return {
    sentiment: topResult.category as 'positive' | 'negative' | 'neutral',
    confidence: topResult.confidence,
  };
}

// ============================================================================
// Summarization
// ============================================================================

/**
 * Summarize text
 */
export async function summarize(
  input: SummarizeInput,
  _config?: ProviderConfig
): Promise<SummarizeOutput> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.text) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Text is required');
  }

  const style = input.style ?? SummaryStyle.CONCISE;
  const originalLength = input.text.length;

  // This is a stub - real implementation would call LLM
  let summary: string;
  switch (style) {
    case SummaryStyle.BULLET_POINTS:
      summary = `• Key point 1 from the text\n• Key point 2 from the text\n• Key point 3 from the text`;
      break;
    case SummaryStyle.EXECUTIVE:
      summary = `Executive Summary: [Placeholder summary of the provided text for executive review]`;
      break;
    case SummaryStyle.TECHNICAL:
      summary = `Technical Summary: [Placeholder technical summary with key specifications and details]`;
      break;
    case SummaryStyle.DETAILED:
      summary = `Detailed Summary: [Placeholder comprehensive summary covering all major points from the text]`;
      break;
    case SummaryStyle.CONCISE:
    default:
      summary = `[Placeholder concise summary of the provided text]`;
  }

  // Apply max length if specified
  if (input.max_length && summary.length > input.max_length) {
    summary = summary.slice(0, input.max_length - 3) + '...';
  }

  return {
    summary,
    compression_ratio: summary.length / originalLength,
  };
}

// ============================================================================
// Evaluation
// ============================================================================

/**
 * Evaluate LLM output quality
 */
export async function evaluateOutput(
  input: EvaluateOutputInput,
  _config?: ProviderConfig
): Promise<EvaluateOutputResult> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.output) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Output to evaluate is required');
  }

  if (!input.criteria || input.criteria.length === 0) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Evaluation criteria are required');
  }

  // This is a stub - real implementation would call LLM
  const scores: Record<string, number> = {};
  for (const criterion of input.criteria) {
    scores[criterion] = 0.7 + Math.random() * 0.25; // Placeholder scores 0.7-0.95
  }

  const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;

  return {
    scores,
    overall_score: overall,
    feedback: '[Placeholder evaluation feedback - configure provider for real evaluations]',
  };
}

/**
 * Check if output is factually grounded in source
 */
export async function checkGroundedness(
  model: string,
  source: string,
  output: string,
  _config?: ProviderConfig
): Promise<{ grounded: boolean; score: number; unsupported_claims: string[] }> {
  const result = await evaluateOutput({
    model,
    prompt: source,
    output,
    criteria: [EvaluationCriterion.FACTUALITY],
    reference: source,
  });

  return {
    grounded: result.overall_score >= 0.8,
    score: result.scores[EvaluationCriterion.FACTUALITY] ?? result.overall_score,
    unsupported_claims: [], // Would be populated by real implementation
  };
}

// ============================================================================
// Entity Extraction
// ============================================================================

/**
 * Extract named entities from text
 */
export async function extractEntities(
  model: string,
  text: string,
  entityTypes?: string[],
  _config?: ProviderConfig
): Promise<Array<{ text: string; type: string; start: number; end: number }>> {
  const types = entityTypes || ['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'MONEY'];

  const schema: JsonSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        type: { type: 'string', enum: types },
        start: { type: 'number' },
        end: { type: 'number' },
      },
      required: ['text', 'type', 'start', 'end'],
    },
  };

  const result = await extract<Array<{ text: string; type: string; start: number; end: number }>>({
    model,
    text,
    schema,
  });

  return result.data;
}

/**
 * Extract key-value pairs from text
 */
export async function extractKeyValues(
  model: string,
  text: string,
  keys: string[],
  _config?: ProviderConfig
): Promise<Record<string, string | null>> {
  const schema: JsonSchema = {
    type: 'object',
    properties: Object.fromEntries(
      keys.map(key => [key, { type: ['string', 'null'] }])
    ),
  };

  const result = await extract<Record<string, string | null>>({
    model,
    text,
    schema,
  });

  return result.data;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate placeholder data from a JSON schema
 */
function generatePlaceholderFromSchema(schema: JsonSchema): unknown {
  const type = schema.type as string;

  switch (type) {
    case 'string':
      return '[placeholder]';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object': {
      const properties = schema.properties as Record<string, JsonSchema> | undefined;
      if (!properties) return {};
      const result: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        result[key] = generatePlaceholderFromSchema(propSchema);
      }
      return result;
    }
    default:
      return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  extract,
  extractMany,
  classify,
  classifyBinary,
  analyzeSentiment,
  summarize,
  evaluateOutput,
  checkGroundedness,
  extractEntities,
  extractKeyValues,
};
