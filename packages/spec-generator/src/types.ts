/**
 * Spec Generator Types
 *
 * Shared types for the prompt → ISL pipeline.
 * @module @isl-lang/spec-generator/types
 */

export type AppTemplate =
  | 'saas'
  | 'marketplace'
  | 'crm'
  | 'internal-tool'
  | 'booking'
  | 'ai-agent-app'
  | 'ecommerce'
  | 'custom';

export type LLMProvider = 'anthropic' | 'openai';

export interface SpecGeneratorOptions {
  provider?: LLMProvider;
  model?: string;
  apiKey?: string;
  template?: AppTemplate;
  language?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface EntityField {
  name: string;
  type: string;
  modifiers?: string[];
  optional?: boolean;
}

export interface EntitySpec {
  name: string;
  fields: EntityField[];
  invariants?: string[];
}

export interface ErrorCase {
  name: string;
  when: string;
}

export interface BehaviorSpec {
  name: string;
  input: EntityField[];
  output: {
    successType?: string;
    errors?: ErrorCase[];
  };
  preconditions?: string[];
  postconditions?: string[];
}

export interface GeneratedSpec {
  domainName: string;
  version: string;
  description: string;
  entities: EntitySpec[];
  enums?: Array<{ name: string; values: string[] }>;
  behaviors: BehaviorSpec[];
  roles?: string[];
  rawISL: string;
  isValid: boolean;
  validationErrors: string[];
  prompt: string;
  model: string;
  generatedAt: string;
}

export interface SpecGenerationResult {
  success: boolean;
  spec: GeneratedSpec | null;
  rawISL: string;
  errors: string[];
  tokensUsed?: number;
  model: string;
  durationMs: number;
}

export interface SpecRefinementOptions extends SpecGeneratorOptions {
  existingSpec: string;
  changeRequest: string;
}

export interface SpecRefinementResult {
  success: boolean;
  updatedSpec: GeneratedSpec | null;
  rawISL: string;
  changeSummary: string;
  errors: string[];
  durationMs: number;
}
