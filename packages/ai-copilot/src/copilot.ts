/**
 * AI Copilot - Main orchestrator for ISL AI assistance
 */
import { getISLGrammarPrompt } from './grammar-prompt.js';
import type {
  CopilotConfig,
  ConversationContext,
  GenerationRequest,
  GenerationResult,
  NLToISLRequest,
  ISLToCodeRequest,
  CodeToISLRequest,
  ReviewRequest,
  ReviewResult,
  CompletionRequest,
  CompletionResult,
  ExplainRequest,
  RefactorRequest,
  TestGenerationRequest,
  ConversationMessage,
} from './types';
import { type AIProvider, AnthropicProvider, OpenAIProvider } from './providers';

export class ISLCopilot {
  private provider: AIProvider;
  private config: CopilotConfig;
  private conversationHistory: ConversationMessage[] = [];
  private cache: Map<string, GenerationResult> = new Map();

  constructor(config: CopilotConfig) {
    this.config = config;
    this.provider = this.createProvider(config.provider);
  }

  private createProvider(type: string): AIProvider {
    switch (type) {
      case 'anthropic':
        return new AnthropicProvider();
      case 'openai':
        return new OpenAIProvider();
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }

  async initialize(): Promise<void> {
    await this.provider.initialize(this.config);
  }

  /**
   * Convert natural language to ISL specification.
   * Includes a retry+repair loop (up to maxAttempts) with confidence scoring.
   */
  async naturalLanguageToISL(
    request: NLToISLRequest,
    options?: { maxAttempts?: number },
  ): Promise<GenerationResult> {
    const maxAttempts = options?.maxAttempts ?? 3;
    let lastResult: GenerationResult | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const prompt = attempt === 1
        ? this.buildNLToISLPrompt(request)
        : this.buildRepairPrompt(lastResult?.content ?? '', lastError ?? 'Parse failed');

      const result = await this.generate({
        type: 'isl',
        prompt,
        options: { style: 'detailed', includeExamples: true },
      });

      // Strip markdown fences
      let islContent = result.content;
      const fenceMatch = islContent.match(/```(?:isl)?\n([\s\S]*?)```/);
      if (fenceMatch) islContent = fenceMatch[1]!.trim();

      // Score confidence based on structural analysis
      const confidence = this.scoreISLConfidence(islContent);
      result.confidence = confidence;

      // Quick parse check: does it look like valid ISL?
      const hasDomain = /domain\s+\w+/.test(islContent);
      const hasEntity = /entity\s+\w+/.test(islContent);
      const hasBehavior = /behavior\s+\w+/.test(islContent);
      const hasBalancedBraces = (islContent.match(/\{/g) ?? []).length === (islContent.match(/\}/g) ?? []).length;

      if (hasDomain && hasBalancedBraces && (hasEntity || hasBehavior)) {
        return {
          ...result,
          content: islContent,
          suggestions: this.extractSuggestions(islContent),
        };
      }

      lastResult = result;
      lastError = !hasDomain ? 'Missing domain declaration'
        : !hasBalancedBraces ? 'Unbalanced braces'
        : 'No entities or behaviors found';
    }

    // Return best-effort result after all attempts
    if (!lastResult) {
      // Should only happen if maxAttempts <= 0; fall back to a single attempt
      const prompt = this.buildNLToISLPrompt(request);
      lastResult = await this.generate({
        type: 'isl',
        prompt,
        options: { style: 'detailed', includeExamples: true },
      });
    }
    return {
      ...lastResult,
      suggestions: this.extractSuggestions(lastResult.content),
    };
  }

  private buildRepairPrompt(rawOutput: string, error: string): string {
    return `The following ISL specification has errors. Fix them and return a valid ISL spec.

Error: ${error}

Raw output:
\`\`\`
${rawOutput.slice(0, 3000)}
\`\`\`

Requirements:
- Must start with \`domain <Name> {\`
- Must have balanced braces
- Must include at least one entity or behavior
- Return ONLY the corrected ISL spec in a \`\`\`isl code fence.`;
  }

  private scoreISLConfidence(content: string): number {
    let score = 0;
    const checks = [
      { test: /domain\s+\w+/, weight: 0.2 },
      { test: /entity\s+\w+/, weight: 0.15 },
      { test: /behavior\s+\w+/, weight: 0.15 },
      { test: /preconditions?\s*\{/, weight: 0.1 },
      { test: /postconditions?\s*\{/, weight: 0.1 },
      { test: /invariant\s+\w+/, weight: 0.1 },
      { test: /errors?\s*\{/, weight: 0.05 },
      { test: /api\s+\w+/, weight: 0.05 },
      { test: /storage\s+\w+/, weight: 0.05 },
      { test: /config\s*\{/, weight: 0.05 },
    ];

    for (const { test, weight } of checks) {
      if (test.test(content)) score += weight;
    }

    const braceBalance = (content.match(/\{/g) ?? []).length === (content.match(/\}/g) ?? []).length;
    if (!braceBalance) score *= 0.5;

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Generate code from ISL specification
   */
  async islToCode(request: ISLToCodeRequest): Promise<GenerationResult> {
    const prompt = this.buildISLToCodePrompt(request);
    return this.generate({
      type: 'code',
      prompt,
      options: {
        targetLanguage: request.targetLanguage,
        framework: request.framework,
      },
    });
  }

  /**
   * Infer ISL specification from existing code
   */
  async codeToISL(request: CodeToISLRequest): Promise<GenerationResult> {
    const prompt = this.buildCodeToISLPrompt(request);
    return this.generate({
      type: 'isl',
      prompt,
      options: { style: 'formal' },
    });
  }

  /**
   * Review ISL specification for issues
   */
  async review(request: ReviewRequest): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(request);
    const result = await this.generate({
      type: 'review',
      prompt,
    });

    return this.parseReviewResult(result.content);
  }

  /**
   * Get code completions
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    return this.provider.complete(request);
  }

  /**
   * Explain ISL specification in plain language
   */
  async explain(request: ExplainRequest): Promise<GenerationResult> {
    const prompt = this.buildExplainPrompt(request);
    return this.generate({
      type: 'documentation',
      prompt,
    });
  }

  /**
   * Refactor ISL specification
   */
  async refactor(request: RefactorRequest): Promise<GenerationResult> {
    const prompt = this.buildRefactorPrompt(request);
    return this.generate({
      type: 'isl',
      prompt,
    });
  }

  /**
   * Generate tests from ISL specification
   */
  async generateTests(request: TestGenerationRequest): Promise<GenerationResult> {
    const prompt = this.buildTestGenerationPrompt(request);
    return this.generate({
      type: 'test',
      prompt,
    });
  }

  /**
   * Interactive chat with context
   */
  async chat(message: string): Promise<GenerationResult> {
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    const context: ConversationContext = {
      messages: this.conversationHistory,
    };

    const result = await this.provider.generate(message, context);

    this.conversationHistory.push({
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Stream response for real-time display
   */
  async streamChat(message: string, onChunk: (chunk: string) => void): Promise<GenerationResult> {
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    const context: ConversationContext = {
      messages: this.conversationHistory,
    };

    const result = await this.provider.streamGenerate(message, context, onChunk);

    this.conversationHistory.push({
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Core generation method
   */
  private async generate(request: GenerationRequest): Promise<GenerationResult> {
    const cacheKey = this.getCacheKey(request);
    
    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = await this.provider.generate(request.prompt, request.context);
    
    if (this.config.cacheEnabled) {
      this.cache.set(cacheKey, result);
    }

    return {
      ...result,
      type: request.type,
    };
  }

  // Prompt builders
  private buildNLToISLPrompt(request: NLToISLRequest): string {
    let prompt = `You are an ISL (Intent Specification Language) expert. Convert the following natural language description into a valid ISL specification.

${getISLGrammarPrompt()}

---

Now convert the following natural language description into a valid ISL specification:

"${request.naturalLanguage}"

Additional requirements:
- Generate a COMPLETE specification using ALL relevant constructs above
- Include entities with fields, types, annotations, and invariants
- Include behaviors with input, output, errors, preconditions, postconditions
- Include API endpoints matching the behaviors
- Include storage definitions
- Include config block with environment variables
- Include at least one scenario`;

    if (request.domainHint) {
      prompt += `\n- Domain context: ${request.domainHint}`;
    }

    if (request.existingSpec) {
      prompt += `\n\nExisting specification to extend or integrate with:\n\`\`\`isl\n${request.existingSpec}\n\`\`\``;
    }

    if (request.examples && request.examples.length > 0) {
      prompt += '\n\nReference examples:';
      for (const example of request.examples) {
        prompt += `\n\nInput: "${example.input}"\nOutput:\n\`\`\`isl\n${example.output}\n\`\`\``;
      }
    }

    prompt += '\n\nReturn ONLY the ISL spec inside a ```isl code fence.';

    return prompt;
  }

  private buildISLToCodePrompt(request: ISLToCodeRequest): string {
    return `Generate ${request.targetLanguage} code from the following ISL specification:

\`\`\`isl
${request.islSpec}
\`\`\`

Requirements:
- Target language: ${request.targetLanguage}
${request.framework ? `- Framework: ${request.framework}` : ''}
${request.options?.includeTests ? '- Include unit tests' : ''}
${request.options?.includeValidation ? '- Include input validation' : ''}
- Code style: ${request.options?.style ?? 'hybrid'}
- Implement all entities, behaviors, and validations
- Handle all defined error cases
- Follow ${request.targetLanguage} best practices and idioms`;
  }

  private buildCodeToISLPrompt(request: CodeToISLRequest): string {
    return `Analyze the following ${request.language} code and generate an ISL specification that captures its intent, behaviors, and contracts.

${getISLGrammarPrompt()}

---

Source code:

\`\`\`${request.language}
${request.code}
\`\`\`

Extraction settings:
- Infer behaviors: ${request.inferBehaviors ?? true}
- Infer invariants: ${request.inferInvariants ?? true}
- Infer types: ${request.inferTypes ?? true}

Requirements:
- Extract entity definitions from data structures
- Identify behavior patterns and their contracts
- Infer preconditions from validation logic
- Infer postconditions from return values and state changes
- Capture error handling as ISL error types`;
  }

  private buildReviewPrompt(request: ReviewRequest): string {
    return `Review the following ISL specification for ${request.reviewType === 'all' ? 'all aspects' : request.reviewType}:

\`\`\`isl
${request.islSpec}
\`\`\`

Review criteria (${request.strictness ?? 'normal'} strictness):
${request.reviewType === 'security' || request.reviewType === 'all' ? '- Security vulnerabilities and data exposure risks' : ''}
${request.reviewType === 'completeness' || request.reviewType === 'all' ? '- Missing preconditions, postconditions, or error handling' : ''}
${request.reviewType === 'consistency' || request.reviewType === 'all' ? '- Naming conventions and structural consistency' : ''}
${request.reviewType === 'performance' || request.reviewType === 'all' ? '- Potential performance issues or anti-patterns' : ''}

Provide response as JSON:
{
  "score": <0-100>,
  "issues": [{"severity": "error|warning|info", "category": "...", "message": "...", "location": {"line": N}, "fix": "..."}],
  "suggestions": [{"type": "...", "message": "...", "priority": "low|medium|high"}],
  "summary": "..."
}`;
  }

  private buildExplainPrompt(request: ExplainRequest): string {
    const audienceMap = {
      developer: 'technical developers who understand programming concepts',
      business: 'business stakeholders without technical background',
      technical: 'technical architects and system designers',
    };

    const formatMap = {
      prose: 'flowing paragraphs',
      bullet: 'bullet points',
      diagram: 'ASCII diagrams and structured sections',
    };

    return `Explain the following ISL specification for ${audienceMap[request.targetAudience]}:

\`\`\`isl
${request.islSpec}
\`\`\`

Format: ${formatMap[request.format]}

Include:
- Overall purpose and domain context
- Entity relationships and data model
- Key behaviors and their business logic
- Important rules and constraints
- Error scenarios and handling`;
  }

  private buildRefactorPrompt(request: RefactorRequest): string {
    const refactorInstructions = {
      extract: `Extract the ${request.target} into a separate, reusable component`,
      inline: `Inline the ${request.target} where it's used`,
      rename: `Rename ${request.target} to ${request.newName} throughout the specification`,
      restructure: 'Reorganize the specification for better clarity and maintainability',
      optimize: 'Optimize the specification by removing redundancy and improving constraints',
    };

    return `Refactor the following ISL specification:

\`\`\`isl
${request.islSpec}
\`\`\`

Refactoring task: ${refactorInstructions[request.refactorType]}

Requirements:
- Maintain semantic equivalence
- Preserve all behaviors and constraints
- Follow ISL best practices
- Add comments explaining significant changes`;
  }

  private buildTestGenerationPrompt(request: TestGenerationRequest): string {
    return `Generate ${request.testType} tests for the following ISL specification:

\`\`\`isl
${request.islSpec}
\`\`\`

Test configuration:
- Test type: ${request.testType}
- Coverage level: ${request.coverage ?? 'standard'}
${request.framework ? `- Framework: ${request.framework}` : ''}

Requirements:
${request.testType === 'unit' ? '- Test each behavior in isolation' : ''}
${request.testType === 'integration' ? '- Test entity interactions and workflows' : ''}
${request.testType === 'property' ? '- Generate property-based tests for invariants' : ''}
${request.testType === 'contract' ? '- Generate consumer-driven contract tests' : ''}
- Cover all preconditions and postconditions
- Include error case testing
- Test edge cases and boundary conditions`;
  }

  // Helpers
  private getCacheKey(request: GenerationRequest): string {
    return `${request.type}:${request.prompt.slice(0, 100)}`;
  }

  private extractSuggestions(content: string): GenerationResult['suggestions'] {
    // Simple extraction of potential improvements
    const suggestions: GenerationResult['suggestions'] = [];

    if (!content.includes('invariant')) {
      suggestions.push({
        type: 'improvement',
        message: 'Consider adding invariants to enforce business rules',
        priority: 'medium',
      });
    }

    if (!content.includes('errors')) {
      suggestions.push({
        type: 'improvement',
        message: 'Consider defining explicit error types for behaviors',
        priority: 'high',
      });
    }

    return suggestions;
  }

  private parseReviewResult(content: string): ReviewResult {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back to default structure
    }

    return {
      score: 70,
      issues: [],
      suggestions: [],
      summary: content,
    };
  }
}
