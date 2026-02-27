/**
 * ISL Spec Reviewer
 * 
 * AI-powered specification reviewer that provides suggestions and catches issues.
 * 
 * @packageDocumentation
 */

// Main exports
export { review, SpecReviewer } from './reviewer.js';
export type {
  ReviewOptions,
  ReviewCategory,
  ReviewResult,
  CategoryResult,
  Issue,
  Suggestion,
  SourceLocation,
} from './reviewer.js';

// Analyzers
export { analyzeCompleteness } from './analyzers/completeness.js';
export type { CompletenessResult, CompletenessIssue } from './analyzers/completeness.js';

export { analyzeConsistency } from './analyzers/consistency.js';
export type { ConsistencyResult, ConsistencyIssue } from './analyzers/consistency.js';

export { analyzeSecurity } from './analyzers/security.js';
export type { SecurityResult, SecurityIssue } from './analyzers/security.js';

export { analyzePerformance } from './analyzers/performance.js';
export type { PerformanceResult, PerformanceIssue } from './analyzers/performance.js';

export { analyzeNaming } from './analyzers/naming.js';
export type { NamingResult, NamingIssue } from './analyzers/naming.js';

export { analyzeBestPractices } from './analyzers/best-practices.js';
export type { BestPracticesResult, BestPracticeIssue } from './analyzers/best-practices.js';

// Suggestions
export { generateSuggestions } from './suggestions/generator.js';
export type { GeneratorOptions } from './suggestions/generator.js';

export { 
  findApplicableTemplates, 
  getTemplateById,
  allTemplates,
  entityTemplates,
  behaviorTemplates,
  errorTemplates,
  securityTemplates,
  validationTemplates,
} from './suggestions/templates.js';
export type { SuggestionTemplate, TemplateContext } from './suggestions/templates.js';

// AI
export { AIClient, createAIClient, createMockAIClient } from './ai/client.js';
export type { AIClientConfig, AIReviewRequest, AIReviewResponse, AIReviewResult } from './ai/client.js';

export { 
  getPromptById, 
  getPromptsByCategory, 
  fillPromptTemplate,
  createCustomPrompt,
  reviewPrompts,
  SYSTEM_PROMPT_BASE,
} from './ai/prompts.js';
export type { ReviewPrompt } from './ai/prompts.js';

// Reporters
export { formatConsole } from './reporters/console.js';
export type { ConsoleReporterOptions } from './reporters/console.js';

export { formatMarkdown, generateBadge } from './reporters/markdown.js';
export type { MarkdownReporterOptions } from './reporters/markdown.js';

export { formatSarif, formatForGitHub, mergeSarifReports } from './reporters/sarif.js';
export type { SarifReporterOptions } from './reporters/sarif.js';
