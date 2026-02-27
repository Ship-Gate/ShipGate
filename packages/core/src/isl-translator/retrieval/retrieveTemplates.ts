/**
 * ISL Template Retrieval
 *
 * Selects the best-matching ISL templates based on user prompt and context
 * using deterministic heuristics (keyword scoring, tag matching).
 */

import type {
  RetrieveTemplatesInput,
  RetrieveTemplatesOutput,
  SelectedTemplate,
  ScoringWeights,
} from './retrievalTypes.js';
import {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_RETRIEVAL_OPTIONS,
} from './retrievalTypes.js';
import {
  extractKeywords,
  identifyTags,
  scoreTemplate,
  roundScore,
} from './scoring.js';

// ============================================================================
// MAIN RETRIEVAL FUNCTION
// ============================================================================

/**
 * Retrieve the best-matching ISL templates for a given prompt and context
 *
 * @param input - The retrieval input containing prompt, context, and templates
 * @returns Selected templates with confidence scores and reasons
 *
 * @example
 * ```typescript
 * const result = retrieveTemplates({
 *   prompt: "Create a user authentication system with OAuth",
 *   context: { stack: { authProvider: 'auth0' } },
 *   templates: availableTemplates,
 * });
 *
 * result.selected.forEach(s => {
 *   console.log(`${s.template.name}: ${s.confidence} confidence`);
 *   s.reasons.forEach(r => console.log(`  - ${r.description}`));
 * });
 * ```
 */
export function retrieveTemplates(
  input: RetrieveTemplatesInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): RetrieveTemplatesOutput {
  const startTime = Date.now();
  const warnings: string[] = [];

  const {
    prompt,
    context,
    templates,
    maxResults = DEFAULT_RETRIEVAL_OPTIONS.maxResults,
    minConfidence = DEFAULT_RETRIEVAL_OPTIONS.minConfidence,
  } = input;

  // Validate input
  if (!prompt || prompt.trim().length === 0) {
    warnings.push('Empty prompt provided');
    return createEmptyResult(startTime, warnings);
  }

  if (!templates || templates.length === 0) {
    warnings.push('No templates provided');
    return createEmptyResult(startTime, warnings);
  }

  // Extract keywords from prompt
  const extractedKeywords = extractKeywords(prompt);
  if (extractedKeywords.length === 0) {
    warnings.push('No meaningful keywords extracted from prompt');
  }

  // Identify relevant tags from keywords
  const identifiedTags = identifyTags(extractedKeywords);

  // Score all templates
  const scoredTemplates: SelectedTemplate[] = [];

  for (const template of templates) {
    const { breakdown, reasons } = scoreTemplate(
      template,
      extractedKeywords,
      identifiedTags,
      context,
      weights
    );

    scoredTemplates.push({
      template,
      confidence: roundScore(breakdown.totalScore),
      reasons,
      scoreBreakdown: breakdown,
    });
  }

  // Sort by confidence (descending)
  scoredTemplates.sort((a, b) => b.confidence - a.confidence);

  // Filter by minimum confidence
  const qualifyingTemplates = scoredTemplates.filter(
    t => t.confidence >= minConfidence
  );

  // Take top N results
  const selected = qualifyingTemplates.slice(0, maxResults);

  // Count considered (above threshold but not selected)
  const considered = qualifyingTemplates.length - selected.length;

  return {
    selected,
    considered,
    totalEvaluated: templates.length,
    metadata: {
      processingTimeMs: Date.now() - startTime,
      extractedKeywords,
      identifiedTags,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}

/**
 * Create an empty result when retrieval cannot proceed
 */
function createEmptyResult(
  startTime: number,
  warnings: string[]
): RetrieveTemplatesOutput {
  return {
    selected: [],
    considered: 0,
    totalEvaluated: 0,
    metadata: {
      processingTimeMs: Date.now() - startTime,
      extractedKeywords: [],
      identifiedTags: [],
      warnings,
    },
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Find the single best matching template
 */
export function findBestTemplate(
  input: RetrieveTemplatesInput,
  weights?: ScoringWeights
): SelectedTemplate | null {
  const result = retrieveTemplates({ ...input, maxResults: 1 }, weights);
  return result.selected[0] ?? null;
}

/**
 * Check if any templates match with high confidence
 */
export function hasHighConfidenceMatch(
  input: RetrieveTemplatesInput,
  threshold: number = 0.7
): boolean {
  const result = retrieveTemplates(
    { ...input, maxResults: 1, minConfidence: threshold }
  );
  return result.selected.length > 0;
}

/**
 * Get templates by tag category
 */
export function filterTemplatesByTags(
  templates: RetrieveTemplatesInput['templates'],
  requiredTags: string[]
): RetrieveTemplatesInput['templates'] {
  if (requiredTags.length === 0) {
    return templates;
  }

  return templates.filter(template =>
    requiredTags.some(tag =>
      template.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    )
  );
}

/**
 * Explain why a template was selected (human-readable)
 */
export function explainSelection(selected: SelectedTemplate): string {
  const lines: string[] = [];

  lines.push(`Template: ${selected.template.name}`);
  lines.push(`Confidence: ${(selected.confidence * 100).toFixed(0)}%`);
  lines.push('');
  lines.push('Reasons:');

  if (selected.reasons.length === 0) {
    lines.push('  - No specific matches found (low baseline score)');
  } else {
    for (const reason of selected.reasons) {
      lines.push(`  - [${reason.type}] ${reason.description}`);
    }
  }

  lines.push('');
  lines.push('Score Breakdown:');
  lines.push(`  - Keyword: ${(selected.scoreBreakdown.keywordScore * 100).toFixed(0)}%`);
  lines.push(`  - Tag: ${(selected.scoreBreakdown.tagScore * 100).toFixed(0)}%`);
  lines.push(`  - Context: ${(selected.scoreBreakdown.contextScore * 100).toFixed(0)}%`);
  lines.push(`  - Preference: ${(selected.scoreBreakdown.preferenceScore * 100).toFixed(0)}%`);

  return lines.join('\n');
}
