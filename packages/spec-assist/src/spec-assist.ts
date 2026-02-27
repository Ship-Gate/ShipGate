/**
 * Spec Assist Service
 * 
 * Main service for AI-assisted ISL spec generation.
 * 
 * Flow:
 * 1. Check feature flag (AI must be explicitly enabled)
 * 2. Generate ISL from code using AI provider
 * 3. Validate output strictly (reject non-ISL "slop")
 * 4. Run validation pipeline (parse + semantic + verify)
 * 5. Return validated ISL or actionable diagnostics
 * 
 * KEY PRINCIPLE: AI cannot ship code. It can only produce specs
 * that are validated by the verification pipeline.
 */

import type {
  SpecAssistConfig,
  SpecAssistRequest,
  SpecAssistResponse,
  ChatMessage,
  Diagnostic,
} from './types.js';
import { isValidOutput } from './types.js';
import { createProvider, type AIProvider } from './providers/index.js';
import { validateISL, toDiagnostics } from './validator.js';
import { isAIEnabled, requireAIEnabled, getDefaultConfig } from './feature-flag.js';

/**
 * Spec Assist Service
 */
export class SpecAssistService {
  private provider: AIProvider;
  private config: SpecAssistConfig;
  private initialized = false;
  
  constructor(config?: Partial<SpecAssistConfig>) {
    const defaults = getDefaultConfig();
    this.config = { ...defaults, ...config };
    this.provider = createProvider(this.config);
  }
  
  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Check feature flag
    requireAIEnabled();
    
    // Initialize provider
    await this.provider.initialize(this.config);
    this.initialized = true;
  }
  
  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && this.provider.isReady();
  }
  
  /**
   * Generate ISL spec from code
   * 
   * @param request - Code and context to generate spec from
   * @returns Validated ISL or diagnostics
   */
  async generateSpec(request: SpecAssistRequest): Promise<SpecAssistResponse> {
    const startTime = Date.now();
    
    if (!this.isReady()) {
      await this.initialize();
    }
    
    // Build prompt
    const messages = this.buildPrompt(request);
    
    // Call provider
    let providerResponse;
    try {
      providerResponse = await this.provider.complete(messages, {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });
    } catch (err) {
      return this.errorResponse(
        `Provider error: ${err instanceof Error ? err.message : String(err)}`,
        startTime
      );
    }
    
    // Strict output validation - reject "slop"
    const outputCheck = isValidOutput(providerResponse.content);
    if (!outputCheck.valid) {
      return {
        success: false,
        validation: {
          parseOk: false,
          semanticOk: false,
          verifyOk: false,
          allPassed: false,
          parseErrors: [],
          semanticErrors: [],
          verifyIssues: [],
        },
        diagnostics: [{
          severity: 'error',
          message: outputCheck.reason ?? 'Invalid AI output format',
          fix: 'AI must output valid ISL code or JSON envelope with "isl" field. Retry or use --template flag.',
        }],
        metadata: {
          provider: this.provider.name,
          model: providerResponse.model,
          tokens: providerResponse.tokens,
          durationMs: Date.now() - startTime,
        },
      };
    }
    
    const isl = outputCheck.isl!;
    
    // Run validation pipeline
    const validation = await validateISL(isl);
    
    if (!validation.allPassed) {
      return {
        success: false,
        isl: isl, // Include ISL even on failure for debugging
        validation,
        diagnostics: toDiagnostics(validation),
        metadata: {
          provider: this.provider.name,
          model: providerResponse.model,
          tokens: providerResponse.tokens,
          durationMs: Date.now() - startTime,
        },
      };
    }
    
    // Success!
    return {
      success: true,
      isl,
      validation,
      diagnostics: [],
      metadata: {
        provider: this.provider.name,
        model: providerResponse.model,
        tokens: providerResponse.tokens,
        durationMs: Date.now() - startTime,
      },
    };
  }
  
  /**
   * Build prompt for spec generation
   */
  private buildPrompt(request: SpecAssistRequest): ChatMessage[] {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      {
        role: 'user',
        content: this.buildUserPrompt(request),
      },
    ];
    
    return messages;
  }
  
  /**
   * System prompt - constrains AI to ISL-only output
   */
  private getSystemPrompt(): string {
    return `You are an ISL (Intent Specification Language) expert. Your ONLY job is to generate valid ISL specifications from code.

CRITICAL OUTPUT RULES:
1. Output ONLY valid ISL code - no prose, no explanations, no markdown formatting.
2. Start directly with 'domain', 'behavior', 'entity', 'type', or 'enum'.
3. Do NOT include phrases like "Here is...", "The following...", or any explanatory text.
4. Do NOT wrap code in markdown code blocks.

ISL SYNTAX REFERENCE:
- domain DomainName { ... }
- entity EntityName { field: Type, ... }
- behavior BehaviorName { input {...}, output {...}, preconditions {...}, postconditions {...} }
- type TypeName = ...
- enum EnumName { VALUE1, VALUE2, ... }

BEHAVIOR STRUCTURE:
behavior BehaviorName {
  input {
    field: Type
  }
  
  output {
    field: Type
  }
  
  errors {
    ERROR_CODE: "Error message"
  }
  
  preconditions {
    require condition
  }
  
  postconditions {
    ensure condition
  }
}

IMPORTANT:
- Infer preconditions from validation logic in the code
- Infer postconditions from return values and state changes
- Define error types for error handling patterns
- Use appropriate ISL types (String, Int, Boolean, ID, DateTime, etc.)

Output ISL only. No explanations. No markdown. Just valid ISL code.`;
  }
  
  /**
   * Build user prompt from request
   */
  private buildUserPrompt(request: SpecAssistRequest): string {
    let prompt = `Generate an ISL specification from this ${request.language} code:\n\n`;
    prompt += '```' + request.language + '\n';
    prompt += request.code;
    prompt += '\n```\n\n';
    
    if (request.signature) {
      prompt += `Focus on this function/method: ${request.signature}\n\n`;
    }
    
    if (request.hints && request.hints.length > 0) {
      prompt += 'Hints about intent:\n';
      for (const hint of request.hints) {
        prompt += `- ${hint}\n`;
      }
      prompt += '\n';
    }
    
    if (request.domainContext) {
      prompt += 'Existing domain context:\n';
      prompt += '```isl\n';
      prompt += request.domainContext;
      prompt += '\n```\n\n';
    }
    
    prompt += 'Generate the ISL specification now. Output ISL code only.';
    
    return prompt;
  }
  
  /**
   * Create error response
   */
  private errorResponse(message: string, startTime: number): SpecAssistResponse {
    return {
      success: false,
      validation: {
        parseOk: false,
        semanticOk: false,
        verifyOk: false,
        allPassed: false,
        parseErrors: [],
        semanticErrors: [],
        verifyIssues: [],
      },
      diagnostics: [{
        severity: 'error',
        message,
      }],
      metadata: {
        provider: this.provider.name,
        durationMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Create a new SpecAssist service instance
 */
export function createSpecAssist(config?: Partial<SpecAssistConfig>): SpecAssistService {
  return new SpecAssistService(config);
}

/**
 * Quick helper to generate spec from code
 */
export async function generateSpecFromCode(
  code: string,
  language: SpecAssistRequest['language'],
  options?: {
    signature?: string;
    hints?: string[];
    config?: Partial<SpecAssistConfig>;
  }
): Promise<SpecAssistResponse> {
  const service = createSpecAssist(options?.config);
  await service.initialize();
  
  return service.generateSpec({
    code,
    language,
    signature: options?.signature,
    hints: options?.hints,
  });
}

/**
 * Check if AI assist is available (feature flag + provider)
 */
export function isSpecAssistAvailable(): boolean {
  const flag = isAIEnabled();
  return flag.enabled;
}
