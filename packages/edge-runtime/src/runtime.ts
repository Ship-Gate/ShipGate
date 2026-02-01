// ============================================================================
// Edge Runtime Core
// ============================================================================

import type {
  EdgeRuntimeOptions,
  EdgeRequestContext,
  EdgeResponse,
  EdgeBehaviorDefinition,
  EdgeBehaviorHandler,
  EdgeVerificationResult,
  EdgeCheckResult,
  EdgeKVStore,
} from './types';
import { DEFAULT_OPTIONS } from './types';

/**
 * ISL Edge Runtime
 *
 * Universal runtime for executing ISL specifications on edge platforms.
 */
export class ISLEdgeRuntime {
  private options: EdgeRuntimeOptions;
  private behaviors: Map<string, EdgeBehaviorDefinition> = new Map();
  private verificationCache: Map<string, EdgeVerificationResult> = new Map();

  constructor(options: Partial<EdgeRuntimeOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a behavior
   */
  registerBehavior(definition: EdgeBehaviorDefinition): void {
    const key = `${definition.domain}.${definition.behavior}`;
    this.behaviors.set(key, definition);
  }

  /**
   * Register multiple behaviors
   */
  registerBehaviors(definitions: EdgeBehaviorDefinition[]): void {
    for (const def of definitions) {
      this.registerBehavior(def);
    }
  }

  /**
   * Execute a behavior
   */
  async execute(
    domain: string,
    behavior: string,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<EdgeResponse> {
    const key = `${domain}.${behavior}`;
    const definition = this.behaviors.get(key);

    if (!definition) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: `Behavior not found: ${key}` },
      };
    }

    const startTime = Date.now();

    try {
      // Pre-execution verification
      if (this.options.enableVerification) {
        const preCheck = await this.verifyPreconditions(definition, input, context);
        
        if (!preCheck.passed && this.options.verificationMode === 'strict') {
          return {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'X-ISL-Verification': 'failed',
              'X-ISL-Score': preCheck.score.toString(),
            },
            body: {
              error: 'Precondition check failed',
              checks: preCheck.checks.filter((c) => !c.passed),
            },
          };
        }
      }

      // Execute the behavior
      const result = await definition.handler(input, context);

      // Post-execution verification
      if (this.options.enableVerification) {
        const postCheck = await this.verifyPostconditions(definition, input, result, context);
        
        if (!postCheck.passed && this.options.verificationMode === 'strict') {
          return {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'X-ISL-Verification': 'failed',
              'X-ISL-Score': postCheck.score.toString(),
            },
            body: {
              error: 'Postcondition check failed',
              result,
              checks: postCheck.checks.filter((c) => !c.passed),
            },
          };
        }
      }

      const duration = Date.now() - startTime;

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-ISL-Domain': domain,
          'X-ISL-Behavior': behavior,
          'X-ISL-Duration': duration.toString(),
        },
        body: result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-ISL-Domain': domain,
          'X-ISL-Behavior': behavior,
          'X-ISL-Duration': duration.toString(),
          'X-ISL-Error': 'true',
        },
        body: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Verify preconditions
   */
  private async verifyPreconditions(
    definition: EdgeBehaviorDefinition,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<EdgeVerificationResult> {
    const cacheKey = this.getCacheKey(definition, 'pre', input);

    if (this.options.cacheVerification) {
      const cached = this.verificationCache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const startTime = Date.now();
    const checks: EdgeCheckResult[] = [];
    let allPassed = true;

    for (const precondition of definition.preconditions || []) {
      const result = await this.evaluateExpression(precondition, { input, context });
      checks.push({
        type: 'precondition',
        expression: precondition,
        passed: result.passed,
        error: result.error,
      });
      if (!result.passed) {
        allPassed = false;
      }
    }

    const duration = Date.now() - startTime;
    const score = checks.length > 0
      ? (checks.filter((c) => c.passed).length / checks.length) * 100
      : 100;

    const result: EdgeVerificationResult = {
      passed: allPassed,
      score,
      checks,
      cached: false,
      duration,
    };

    if (this.options.cacheVerification) {
      this.verificationCache.set(cacheKey, result);
      // Auto-expire cache
      setTimeout(() => {
        this.verificationCache.delete(cacheKey);
      }, this.options.cacheTTL * 1000);
    }

    return result;
  }

  /**
   * Verify postconditions
   */
  private async verifyPostconditions(
    definition: EdgeBehaviorDefinition,
    input: unknown,
    output: unknown,
    context: EdgeRequestContext
  ): Promise<EdgeVerificationResult> {
    const startTime = Date.now();
    const checks: EdgeCheckResult[] = [];
    let allPassed = true;

    for (const postcondition of definition.postconditions || []) {
      const result = await this.evaluateExpression(postcondition, { input, output, context });
      checks.push({
        type: 'postcondition',
        expression: postcondition,
        passed: result.passed,
        error: result.error,
      });
      if (!result.passed) {
        allPassed = false;
      }
    }

    const duration = Date.now() - startTime;
    const score = checks.length > 0
      ? (checks.filter((c) => c.passed).length / checks.length) * 100
      : 100;

    return {
      passed: allPassed,
      score,
      checks,
      cached: false,
      duration,
    };
  }

  /**
   * Evaluate an expression
   */
  private async evaluateExpression(
    expression: string,
    context: Record<string, unknown>
  ): Promise<{ passed: boolean; error?: string }> {
    try {
      // Simple expression evaluation
      // In production, this would use a proper expression parser
      const fn = new Function(
        ...Object.keys(context),
        `return ${expression}`
      );
      const result = fn(...Object.values(context));
      return { passed: Boolean(result) };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : 'Expression evaluation failed',
      };
    }
  }

  /**
   * Get cache key for verification
   */
  private getCacheKey(
    definition: EdgeBehaviorDefinition,
    phase: 'pre' | 'post',
    input: unknown
  ): string {
    const inputHash = this.simpleHash(JSON.stringify(input));
    return `${definition.domain}.${definition.behavior}.${phase}.${inputHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Handle a request
   */
  async handleRequest(request: Request): Promise<Response> {
    const context = this.extractContext(request);

    // Extract domain and behavior from URL or headers
    const { domain, behavior, input } = await this.parseRequest(request, context);

    if (!domain || !behavior) {
      return new Response(
        JSON.stringify({ error: 'Missing domain or behavior' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await this.execute(domain, behavior, input, context);

    return new Response(
      JSON.stringify(result.body),
      {
        status: result.status,
        headers: result.headers,
      }
    );
  }

  /**
   * Extract context from request
   */
  private extractContext(request: Request): EdgeRequestContext {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      requestId: crypto.randomUUID(),
      method: request.method,
      url: request.url,
      headers,
      startTime: Date.now(),
      islDomain: headers['x-isl-domain'],
      islBehavior: headers['x-isl-behavior'],
    };
  }

  /**
   * Parse request for domain, behavior, and input
   */
  private async parseRequest(
    request: Request,
    context: EdgeRequestContext
  ): Promise<{ domain?: string; behavior?: string; input?: unknown }> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Try to extract from path: /api/{domain}/{behavior}
    let domain = context.islDomain;
    let behavior = context.islBehavior;

    if (pathParts.length >= 3 && pathParts[0] === 'api') {
      domain = domain || pathParts[1];
      behavior = behavior || pathParts[2];
    }

    // Parse input from body
    let input: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        input = await request.json();
      } catch {
        // Body might not be JSON
      }
    }

    // Parse query params as input for GET
    if (request.method === 'GET') {
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      input = Object.keys(params).length > 0 ? params : undefined;
    }

    return { domain, behavior, input };
  }

  /**
   * Create a fetch handler for the runtime
   */
  createFetchHandler(): (request: Request) => Promise<Response> {
    return (request: Request) => this.handleRequest(request);
  }

  /**
   * Get runtime statistics
   */
  getStats(): {
    behaviors: number;
    cachedVerifications: number;
    options: EdgeRuntimeOptions;
  } {
    return {
      behaviors: this.behaviors.size,
      cachedVerifications: this.verificationCache.size,
      options: this.options,
    };
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.verificationCache.clear();
  }
}

/**
 * Create edge runtime instance
 */
export function createEdgeRuntime(
  options?: Partial<EdgeRuntimeOptions>
): ISLEdgeRuntime {
  return new ISLEdgeRuntime(options);
}

/**
 * Create a behavior definition helper
 */
export function defineBehavior(
  domain: string,
  behavior: string,
  config: {
    preconditions?: string[];
    postconditions?: string[];
    invariants?: string[];
    handler: EdgeBehaviorHandler;
  }
): EdgeBehaviorDefinition {
  return {
    domain,
    behavior,
    ...config,
  };
}
