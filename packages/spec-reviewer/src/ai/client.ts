/**
 * AI Client
 * 
 * Interface for LLM-powered spec analysis.
 */

import { getPromptById, fillPromptTemplate } from './prompts.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AIClientConfig {
  provider: 'anthropic' | 'openai' | 'mock';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIReviewRequest {
  spec: string;
  promptId?: string;
  customPrompt?: {
    system: string;
    user: string;
  };
}

export interface AIReviewResponse {
  success: boolean;
  content?: string;
  parsed?: AIReviewResult;
  error?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export interface AIReviewResult {
  summary?: string;
  criticalIssues?: AIIssue[];
  warnings?: AIIssue[];
  suggestions?: AISuggestion[];
  score?: number;
  [key: string]: unknown;
}

export interface AIIssue {
  title: string;
  description: string;
  location?: string;
  severity?: string;
  fix?: string;
  cwe?: string;
}

export interface AISuggestion {
  title: string;
  description: string;
  rationale?: string;
  priority?: string;
  suggestedCode?: string;
}

// ============================================================================
// AI CLIENT
// ============================================================================

export class AIClient {
  private config: Required<AIClientConfig>;

  constructor(config: AIClientConfig) {
    this.config = {
      provider: config.provider,
      model: config.model ?? this.getDefaultModel(config.provider),
      apiKey: config.apiKey ?? '',
      baseUrl: config.baseUrl ?? this.getDefaultBaseUrl(config.provider),
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.3,
    };
  }

  /**
   * Perform AI review
   */
  async review(request: AIReviewRequest): Promise<AIReviewResponse> {
    const startTime = Date.now();

    try {
      // Get or create prompt
      let systemPrompt: string;
      let userPrompt: string;

      if (request.customPrompt) {
        systemPrompt = request.customPrompt.system;
        userPrompt = request.customPrompt.user;
      } else {
        const promptTemplate = getPromptById(request.promptId ?? 'comprehensive-review');
        if (!promptTemplate) {
          return {
            success: false,
            error: `Prompt not found: ${request.promptId}`,
          };
        }
        systemPrompt = promptTemplate.systemPrompt;
        userPrompt = fillPromptTemplate(promptTemplate, request.spec);
      }

      // Call provider
      let content: string;
      
      switch (this.config.provider) {
        case 'mock':
          content = await this.mockReview(request.spec);
          break;
        case 'anthropic':
          content = await this.callAnthropic(systemPrompt, userPrompt);
          break;
        case 'openai':
          content = await this.callOpenAI(systemPrompt, userPrompt);
          break;
        default:
          return {
            success: false,
            error: `Unknown provider: ${this.config.provider}`,
          };
      }

      // Parse response
      const parsed = this.parseResponse(content);

      return {
        success: true,
        content,
        parsed,
        latencyMs: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if AI client is configured
   */
  isConfigured(): boolean {
    if (this.config.provider === 'mock') return true;
    return !!this.config.apiKey;
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; provider: string; model: string } {
    return {
      configured: this.isConfigured(),
      provider: this.config.provider,
      model: this.config.model,
    };
  }

  // ============================================================================
  // PROVIDER IMPLEMENTATIONS
  // ============================================================================

  private async callAnthropic(system: string, user: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? '';
  }

  private async callOpenAI(system: string, user: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  private async mockReview(spec: string): Promise<string> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock review based on spec content
    const hasEntities = spec.includes('entity');
    const hasBehaviors = spec.includes('behavior');
    const hasSecurity = spec.includes('security');
    const hasInvariants = spec.includes('invariants');

    const criticalIssues: AIIssue[] = [];
    const warnings: AIIssue[] = [];
    const suggestions: AISuggestion[] = [];

    if (!hasSecurity) {
      warnings.push({
        title: 'Missing security specifications',
        description: 'Consider adding authentication and authorization requirements.',
        fix: 'Add security blocks to behaviors that modify state.',
      });
    }

    if (!hasInvariants && hasEntities) {
      suggestions.push({
        title: 'Add invariants',
        description: 'Entity invariants help ensure data integrity.',
        priority: 'medium',
        suggestedCode: 'invariants {\n  // Add your constraints here\n}',
      });
    }

    const score = Math.round(
      60 + 
      (hasEntities ? 10 : 0) + 
      (hasBehaviors ? 10 : 0) + 
      (hasSecurity ? 10 : 0) + 
      (hasInvariants ? 10 : 0)
    );

    return JSON.stringify({
      summary: 'Mock review of ISL specification',
      criticalIssues,
      warnings,
      suggestions,
      score,
    });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'anthropic': return 'claude-sonnet-4-20250514';
      case 'openai': return 'gpt-4';
      case 'mock': return 'mock-model';
      default: return 'unknown';
    }
  }

  private getDefaultBaseUrl(provider: string): string {
    switch (provider) {
      case 'anthropic': return 'https://api.anthropic.com';
      case 'openai': return 'https://api.openai.com';
      case 'mock': return 'mock://localhost';
      default: return '';
    }
  }

  private parseResponse(content: string): AIReviewResult | undefined {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create AI client from environment
 */
export function createAIClient(provider?: string): AIClient {
  const selectedProvider = provider ?? 'mock';

  return new AIClient({
    provider: selectedProvider as 'anthropic' | 'openai' | 'mock',
    apiKey: process.env[`${selectedProvider.toUpperCase()}_API_KEY`],
  });
}

/**
 * Create mock AI client for testing
 */
export function createMockAIClient(): AIClient {
  return new AIClient({ provider: 'mock' });
}
