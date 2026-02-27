/**
 * ISL Template Retrieval Module
 *
 * Provides functions for selecting best-matching ISL templates
 * based on prompt content and context using deterministic heuristics.
 */

// Main retrieval function
export {
  retrieveTemplates,
  findBestTemplate,
  hasHighConfidenceMatch,
  filterTemplatesByTags,
  explainSelection,
} from './retrieveTemplates.js';

// Scoring utilities
export {
  extractKeywords,
  identifyTags,
  scoreTemplate,
  calculateKeywordScore,
  calculateTagScore,
  calculateContextScore,
  calculatePreferenceScore,
  roundScore,
} from './scoring.js';

// Types
export type {
  ISLTemplate,
  TemplateQuestion,
  RetrievalContext,
  StackInfo,
  UserPreferences,
  RetrieveTemplatesInput,
  RetrieveTemplatesOutput,
  SelectedTemplate,
  SelectionReason,
  ScoreBreakdown,
  RetrievalMetadata,
  ScoringWeights,
} from './retrievalTypes.js';

// Constants
export {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_RETRIEVAL_OPTIONS,
} from './retrievalTypes.js';
