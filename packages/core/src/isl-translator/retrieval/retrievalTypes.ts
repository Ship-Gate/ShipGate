/**
 * Type definitions for ISL Template Retrieval
 *
 * Provides types for selecting best-matching ISL templates based on
 * prompt content and context using deterministic heuristics.
 */

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * An ISL template that can be selected
 */
export interface ISLTemplate {
  /** Unique identifier for the template */
  slug: string;
  /** Display name */
  name: string;
  /** Description of what the template does */
  description: string;
  /** Categories/tags for filtering */
  tags: string[];
  /** Optional keywords for better matching */
  keywords?: string[];
  /** The ISL source code content */
  content: string;
  /** Optional setup questions */
  questions?: TemplateQuestion[];
  /** Optional complexity level */
  complexity?: 'simple' | 'moderate' | 'complex';
}

/**
 * A setup question for template customization
 */
export interface TemplateQuestion {
  id: string;
  question: string;
  type: 'text' | 'boolean' | 'select';
  options?: string[];
  required?: boolean;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Context information about the user's environment
 */
export interface RetrievalContext {
  /** Detected tech stack */
  stack?: StackInfo;
  /** Existing entities in the project */
  existingEntities?: string[];
  /** Existing behaviors in the project */
  existingBehaviors?: string[];
  /** User's domain/industry */
  domain?: string;
  /** Specific requirements mentioned */
  requirements?: string[];
  /** User preferences */
  preferences?: UserPreferences;
}

/**
 * Detected technology stack
 */
export interface StackInfo {
  /** Programming language */
  language?: string;
  /** Web framework */
  framework?: string;
  /** Database type */
  database?: string;
  /** Authentication provider */
  authProvider?: string;
  /** Payment provider */
  paymentProvider?: string;
}

/**
 * User preferences for template selection
 */
export interface UserPreferences {
  /** Preferred complexity level */
  preferredComplexity?: 'simple' | 'moderate' | 'complex';
  /** Include audit logging */
  includeAuditLogging?: boolean;
  /** Include rate limiting */
  includeRateLimiting?: boolean;
  /** Include security features */
  includeSecurity?: boolean;
}

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Input to the template retrieval function
 */
export interface RetrieveTemplatesInput {
  /** The user's prompt/request */
  prompt: string;
  /** Optional context about the environment */
  context?: RetrievalContext;
  /** Available templates to select from */
  templates: ISLTemplate[];
  /** Maximum number of templates to return */
  maxResults?: number;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
}

/**
 * A selected template with selection metadata
 */
export interface SelectedTemplate {
  /** The selected template */
  template: ISLTemplate;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasons why this template was selected */
  reasons: SelectionReason[];
  /** Relevance score breakdown */
  scoreBreakdown: ScoreBreakdown;
}

/**
 * Reason for template selection
 */
export interface SelectionReason {
  /** Type of match */
  type: 'keyword' | 'tag' | 'context' | 'semantic' | 'preference';
  /** Description of the match */
  description: string;
  /** Weight/importance of this reason */
  weight: number;
}

/**
 * Breakdown of how the score was calculated
 */
export interface ScoreBreakdown {
  /** Score from keyword matching (0-1) */
  keywordScore: number;
  /** Score from tag matching (0-1) */
  tagScore: number;
  /** Score from context matching (0-1) */
  contextScore: number;
  /** Score from user preferences (0-1) */
  preferenceScore: number;
  /** Final weighted score (0-1) */
  totalScore: number;
}

/**
 * Output from the template retrieval function
 */
export interface RetrieveTemplatesOutput {
  /** Selected templates sorted by confidence */
  selected: SelectedTemplate[];
  /** Templates that were considered but not selected */
  considered: number;
  /** Total templates evaluated */
  totalEvaluated: number;
  /** Processing metadata */
  metadata: RetrievalMetadata;
}

/**
 * Metadata about the retrieval process
 */
export interface RetrievalMetadata {
  /** Time taken in milliseconds */
  processingTimeMs: number;
  /** Keywords extracted from prompt */
  extractedKeywords: string[];
  /** Tags identified from context */
  identifiedTags: string[];
  /** Any warnings during processing */
  warnings?: string[];
}

// ============================================================================
// SCORING CONFIGURATION
// ============================================================================

/**
 * Weights for different scoring components
 */
export interface ScoringWeights {
  /** Weight for keyword matching */
  keyword: number;
  /** Weight for tag matching */
  tag: number;
  /** Weight for context matching */
  context: number;
  /** Weight for preference matching */
  preference: number;
}

/**
 * Default scoring weights
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  keyword: 0.4,
  tag: 0.3,
  context: 0.2,
  preference: 0.1,
} as const;

/**
 * Default retrieval options
 */
export const DEFAULT_RETRIEVAL_OPTIONS = {
  maxResults: 3,
  minConfidence: 0.2,
} as const;
