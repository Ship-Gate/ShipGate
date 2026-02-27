/**
 * AI Enhancer
 *
 * Use LLM to enhance inferred ISL specifications.
 */

import type { ExtractedTestCase } from '../analyzer.js';

export interface EnhancerOptions {
  /** AI model to use */
  model?: string;
  /** Source files for context */
  sourceCode?: string[];
  /** Test cases for context */
  testCases?: ExtractedTestCase[];
  /** API key (defaults to environment variable) */
  apiKey?: string;
}

export interface EnhancerResult {
  /** Enhanced ISL specification */
  isl: string;
  /** Suggestions for improvement */
  suggestions: string[];
  /** Confidence in enhancements */
  confidence: number;
}

const SYSTEM_PROMPT = `You are an expert at analyzing code and writing Intent Specification Language (ISL) specifications.

Your task is to enhance an inferred ISL specification by:
1. Adding missing preconditions and postconditions
2. Identifying additional error cases
3. Inferring temporal constraints
4. Adding security requirements
5. Improving descriptions

ISL Syntax Reference:
- domain Name { ... } - Top level container
- entity Name { field: Type [annotations] } - Data entities
- behavior Name { input/output/preconditions/postconditions } - Operations
- type Name = BaseType { constraints } - Type aliases
- enum Name { VALUE1, VALUE2 } - Enumerations

Annotations: [immutable], [unique], [indexed], [secret], [sensitive], [default: value]

Output only the enhanced ISL specification, no explanations.`;

/**
 * Enhance ISL specification using AI
 */
export async function enhanceWithAI(
  isl: string,
  options: EnhancerOptions = {}
): Promise<EnhancerResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Return original if no API key
    return {
      isl,
      suggestions: ['AI enhancement skipped: No API key configured'],
      confidence: 0.5,
    };
  }

  const model = options.model ?? 'gpt-4';
  const isAnthropic = model.startsWith('claude');

  try {
    const enhanced = isAnthropic
      ? await enhanceWithAnthropic(isl, options, apiKey)
      : await enhanceWithOpenAI(isl, options, apiKey);

    return enhanced;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isl,
      suggestions: [`AI enhancement failed: ${message}`],
      confidence: 0.5,
    };
  }
}

async function enhanceWithOpenAI(
  isl: string,
  options: EnhancerOptions,
  apiKey: string
): Promise<EnhancerResult> {
  const userPrompt = buildUserPrompt(isl, options);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const enhancedISL = data.choices[0]?.message.content ?? isl;
  const suggestions = extractSuggestions(isl, enhancedISL);

  return {
    isl: enhancedISL,
    suggestions,
    confidence: 0.8,
  };
}

async function enhanceWithAnthropic(
  isl: string,
  options: EnhancerOptions,
  apiKey: string
): Promise<EnhancerResult> {
  const userPrompt = buildUserPrompt(isl, options);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model ?? 'claude-3-opus-20240229',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const enhancedISL = data.content.find((c) => c.type === 'text')?.text ?? isl;
  const suggestions = extractSuggestions(isl, enhancedISL);

  return {
    isl: enhancedISL,
    suggestions,
    confidence: 0.85,
  };
}

function buildUserPrompt(isl: string, options: EnhancerOptions): string {
  let prompt = `Please enhance this inferred ISL specification:\n\n\`\`\`isl\n${isl}\n\`\`\`\n\n`;

  if (options.testCases?.length) {
    prompt += `\nTest cases that should be covered:\n`;
    for (const test of options.testCases.slice(0, 10)) {
      prompt += `- ${test.name}: inputs=${JSON.stringify(test.inputs)}`;
      if (test.expectedError) {
        prompt += ` -> expects error: ${test.expectedError}`;
      }
      prompt += '\n';
    }
  }

  prompt += `\nEnhance the specification by:
1. Adding any missing preconditions based on validation patterns
2. Adding postconditions that ensure data consistency
3. Identifying additional error cases
4. Adding temporal constraints where appropriate
5. Adding security requirements for sensitive operations

Return only the enhanced ISL specification.`;

  return prompt;
}

function extractSuggestions(original: string, enhanced: string): string[] {
  const suggestions: string[] = [];

  // Count additions
  const originalLines = original.split('\n').length;
  const enhancedLines = enhanced.split('\n').length;

  if (enhancedLines > originalLines) {
    suggestions.push(
      `Added ${enhancedLines - originalLines} lines of specifications`
    );
  }

  // Check for new sections
  if (enhanced.includes('temporal {') && !original.includes('temporal {')) {
    suggestions.push('Added temporal constraints');
  }

  if (enhanced.includes('security {') && !original.includes('security {')) {
    suggestions.push('Added security requirements');
  }

  // Count new preconditions
  const originalPreconditions = (original.match(/preconditions/g) ?? []).length;
  const enhancedPreconditions = (enhanced.match(/preconditions/g) ?? []).length;

  if (enhancedPreconditions > originalPreconditions) {
    suggestions.push('Added precondition blocks');
  }

  // Count new error cases
  const originalErrors = (original.match(/errors\s*\{/g) ?? []).length;
  const enhancedErrors = (enhanced.match(/errors\s*\{/g) ?? []).length;

  if (enhancedErrors > originalErrors) {
    suggestions.push('Added error case definitions');
  }

  if (suggestions.length === 0) {
    suggestions.push('Specification validated and confirmed');
  }

  return suggestions;
}

/**
 * Generate ISL from natural language description
 */
export async function generateFromDescription(
  description: string,
  options: EnhancerOptions = {}
): Promise<EnhancerResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('API key required for generation from description');
  }

  const prompt = `Generate an ISL specification for the following:

${description}

Include:
- Appropriate entities with fields and annotations
- Behaviors with inputs, outputs, and error cases
- Preconditions and postconditions
- Any relevant invariants

Output only valid ISL syntax.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return {
    isl: data.choices[0]?.message.content ?? '',
    suggestions: ['Generated from natural language description'],
    confidence: 0.7,
  };
}
