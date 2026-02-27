/**
 * Framework-agnostic HTTP middleware for rate limiting
 * 
 * This module provides a comprehensive HTTP middleware that can be adapted
 * to various web frameworks. It handles request parsing, key extraction,
 * rate limit checking, and response generation.
 */

import { RateLimitAction, CheckResult, RateLimitKey, IdentifierType } from '../types';
import { 
  MiddlewareContext, 
  MiddlewareResult, 
  HttpMiddlewareConfig,
  HttpHeaders,
  SkipCondition,
  MiddlewareEvents,
  MiddlewareMetrics,
  RateLimitMiddleware,
  MiddlewareChain,
  FrameworkAdapter
} from './types';
import { KeyExtractor, createDefaultKeyExtractor, KeyExtractorFactory } from './key-extractor';
import { MiddlewareError, KeyExtractionError } from '../errors';

/**
 * Core HTTP rate limit middleware
 */
export class HttpRateLimitMiddleware implements RateLimitMiddleware {
  readonly name = 'http-rate-limit';
  readonly priority = 100;
  
  private config: HttpMiddlewareConfig;
  private keyExtractor: KeyExtractor;
  private events: Partial<MiddlewareEvents> = {};
  private metrics: MiddlewareMetrics;
  
  constructor(
    private rateLimiter: (key: RateLimitKey, identifierType: IdentifierType, configName: string, weight?: number) => Promise<CheckResult>,
    config: HttpMiddlewareConfig = {}
  ) {
    this.config = {
      enabled: true,
      skipPaths: [],
      skipMethods: [],
      skipConditions: [],
      headers: {
        enabled: true,
        prefix: 'X-RateLimit',
        custom: {},
      },
      response: {
        includeHeaders: true,
        includeBody: false,
        bodyTemplate: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests',
          retryAfter: '{{retryAfter}}',
        }),
        statusCode: {
          [RateLimitAction.ALLOW]: 200,
          [RateLimitAction.WARN]: 200,
          [RateLimitAction.THROTTLE]: 429,
          [RateLimitAction.DENY]: 429,
          [RateLimitAction.CAPTCHA]: 429,
        },
      },
      keyExtraction: {
        primary: 'ip',
        fallback: ['api-key', 'user-id'],
      },
      logging: {
        enabled: false,
        level: 'info',
        includeMetadata: true,
      },
      ...config,
    };
    
    // Initialize key extractor
    this.initializeKeyExtractor();
    
    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      requestsByAction: {
        [RateLimitAction.ALLOW]: 0,
        [RateLimitAction.WARN]: 0,
        [RateLimitAction.THROTTLE]: 0,
        [RateLimitAction.DENY]: 0,
        [RateLimitAction.CAPTCHA]: 0,
      },
      requestsByStatusCode: {},
      averageProcessingTime: 0,
      lastRequestTime: new Date(),
      topLimitedKeys: [],
    };
  }
  
  async execute(context: MiddlewareContext, next: () => Promise<MiddlewareResult>): Promise<MiddlewareResult> {
    const startTime = Date.now();
    
    try {
      // Check if rate limiting is enabled
      if (!this.config.enabled) {
        return await next();
      }
      
      // Check skip conditions
      const skipReason = this.shouldSkip(context);
      if (skipReason) {
        this.events.skipped?.(context, skipReason);
        if (this.config.logging?.enabled) {
          this.log('debug', `Rate limiting skipped: ${skipReason}`, context);
        }
        return await next();
      }
      
      // Extract rate limit key
      const key = await this.extractKey(context);
      if (!key) {
        if (this.config.logging?.enabled) {
          this.log('warn', 'No rate limit key extracted', context);
        }
        return await next();
      }
      
      // Check rate limit
      const result = await this.rateLimiter(
        key,
        this.keyExtractor.getType(),
        'default', // TODO: Make configurable
        1 // TODO: Make weight configurable
      );
      
      // Update metrics
      this.updateMetrics(result, Date.now() - startTime);
      
      // Generate response
      const middlewareResult = this.generateResult(result, context);
      
      // Emit events
      this.emitEvent(result, context);
      
      // Log if enabled
      if (this.config.logging?.enabled) {
        this.log(
          result.allowed ? 'debug' : 'warn',
          `Rate limit ${result.action}: ${result.remaining}/${result.limit} remaining`,
          context,
          result
        );
      }
      
      // If allowed, continue to next middleware
      if (result.allowed) {
        const nextResult = await next();
        
        // Merge headers from rate limit check
        if (nextResult.headers && middlewareResult.headers) {
          nextResult.headers = { ...middlewareResult.headers, ...nextResult.headers };
        } else if (middlewareResult.headers) {
          nextResult.headers = middlewareResult.headers;
        }
        
        return nextResult;
      }
      
      // Return rate limit response
      return middlewareResult;
      
    } catch (error) {
      this.events.error?.(context, error as Error);
      
      if (this.config.logging?.enabled) {
        this.log('error', `Rate limit error: ${(error as Error).message}`, context);
      }
      
      // On error, allow request by default
      return await next();
    }
  }
  
  /**
   * Set event handlers
   */
  on(events: Partial<MiddlewareEvents>): void {
    this.events = { ...this.events, ...events };
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): MiddlewareMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      requestsByAction: {
        [RateLimitAction.ALLOW]: 0,
        [RateLimitAction.WARN]: 0,
        [RateLimitAction.THROTTLE]: 0,
        [RateLimitAction.DENY]: 0,
        [RateLimitAction.CAPTCHA]: 0,
      },
      requestsByStatusCode: {},
      averageProcessingTime: 0,
      lastRequestTime: new Date(),
      topLimitedKeys: [],
    };
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private initializeKeyExtractor(): void {
    if (this.config.keyExtraction?.primary) {
      const extractors: Array<{ type: any; config?: any }> = [
        { type: this.config.keyExtraction.primary },
      ];
      
      if (this.config.keyExtraction?.fallback) {
        extractors.push(...this.config.keyExtraction.fallback.map(type => ({ type })));
      }
      
      this.keyExtractor = KeyExtractorFactory.createComposite(extractors);
    } else {
      this.keyExtractor = createDefaultKeyExtractor();
    }
  }
  
  private shouldSkip(context: MiddlewareContext): string | null {
    // Check path skips
    if (this.config.skipPaths) {
      for (const pattern of this.config.skipPaths) {
        if (this.matchPath(context.request.url, pattern)) {
          return `Path matches skip pattern: ${pattern}`;
        }
      }
    }
    
    // Check method skips
    if (this.config.skipMethods?.includes(context.request.method)) {
      return `Method ${context.request.method} is skipped`;
    }
    
    // Check custom conditions
    if (this.config.skipConditions) {
      for (const condition of this.config.skipConditions) {
        if (this.evaluateSkipCondition(condition, context)) {
          return `Skip condition met: ${condition.type}`;
        }
      }
    }
    
    return null;
  }
  
  private matchPath(path: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(path);
  }
  
  private evaluateSkipCondition(condition: SkipCondition, context: MiddlewareContext): boolean {
    switch (condition.type) {
      case 'path':
        return condition.config.pattern 
          ? this.matchPath(context.request.url, condition.config.pattern)
          : false;
        
      case 'method':
        return context.request.method === condition.config.method;
        
      case 'header':
        if (!condition.config.header) return false;
        const headerValue = context.request.headers[condition.config.header.name.toLowerCase()];
        return condition.config.header.value 
          ? headerValue === condition.config.header.value
          : !!headerValue;
        
      case 'query':
        if (!condition.config.query) return false;
        const url = new URL(context.request.url);
        const queryValue = url.searchParams.get(condition.config.query.name);
        return condition.config.query.value 
          ? queryValue === condition.config.query.value
          : !!queryValue;
        
      case 'ip':
        // TODO: Implement IP matching with CIDR support
        return false;
        
      case 'custom':
        return condition.config.custom 
          ? condition.config.custom(context)
          : false;
        
      default:
        return false;
    }
  }
  
  private async extractKey(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      return await this.keyExtractor.extract(context);
    } catch (error) {
      if (error instanceof KeyExtractionError) {
        throw error;
      }
      throw new KeyExtractionError(
        `Key extraction failed: ${(error as Error).message}`,
        'unknown'
      );
    }
  }
  
  private generateResult(result: CheckResult, context: MiddlewareContext): MiddlewareResult {
    const statusCode = this.config.response?.statusCode?.[result.action] || 200;
    const headers = this.config.response?.includeHeaders 
      ? this.generateHeaders(result)
      : undefined;
    
    let body: any;
    if (this.config.response?.includeBody && !result.allowed) {
      const template = this.config.response.bodyTemplate || '';
      body = this.interpolateTemplate(template, {
        retryAfter: result.retryAfterMs?.toString() || '',
        limit: result.limit.toString(),
        remaining: result.remaining.toString(),
        resetAt: result.resetAt.toISOString(),
        action: result.action,
      });
      
      // Try to parse as JSON
      try {
        body = JSON.parse(body);
      } catch {
        // Keep as string if not valid JSON
      }
    }
    
    return {
      allowed: result.allowed,
      action: result.action,
      headers,
      retryAfter: result.retryAfterMs,
      body,
    };
  }
  
  private generateHeaders(result: CheckResult): HttpHeaders {
    const prefix = this.config.headers?.prefix || 'X-RateLimit';
    const headers: HttpHeaders = {
      [`${prefix}-Limit`]: result.limit.toString(),
      [`${prefix}-Remaining`]: result.remaining.toString(),
      [`${prefix}-Reset`]: Math.ceil(result.resetAt.getTime() / 1000).toString(),
    };
    
    if (result.retryAfterMs) {
      headers[`${prefix}-Retry-After`] = Math.ceil(result.retryAfterMs / 1000).toString();
    }
    
    if (result.configName) {
      headers[`${prefix}-Policy`] = result.configName;
    }
    
    // Add custom headers
    if (this.config.headers?.custom) {
      Object.assign(headers, this.config.headers.custom);
    }
    
    // Add headers from result
    if (result.headers) {
      Object.assign(headers, result.headers);
    }
    
    return headers;
  }
  
  private interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }
  
  private emitEvent(result: CheckResult, context: MiddlewareContext): void {
    switch (result.action) {
      case RateLimitAction.ALLOW:
        this.events.allowed?.(context, result);
        break;
      case RateLimitAction.WARN:
        this.events.warned?.(context, result);
        break;
      case RateLimitAction.THROTTLE:
        this.events.throttled?.(context, result);
        break;
      case RateLimitAction.DENY:
        this.events.denied?.(context, result);
        break;
      case RateLimitAction.CAPTCHA:
        this.events.captcha?.(context, result);
        break;
    }
  }
  
  private updateMetrics(result: CheckResult, processingTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.requestsByAction[result.action]++;
    this.metrics.lastRequestTime = new Date();
    
    // Update average processing time
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1) + processingTime) 
      / this.metrics.totalRequests;
    
    // Update top limited keys
    if (!result.allowed && result.bucketKey) {
      const existing = this.metrics.topLimitedKeys.find(k => k.key === result.bucketKey);
      if (existing) {
        existing.count++;
        existing.lastSeen = new Date();
      } else {
        this.metrics.topLimitedKeys.push({
          key: result.bucketKey,
          count: 1,
          lastSeen: new Date(),
        });
      }
      
      // Keep only top 10
      this.metrics.topLimitedKeys.sort((a, b) => b.count - a.count);
      this.metrics.topLimitedKeys = this.metrics.topLimitedKeys.slice(0, 10);
    }
  }
  
  private log(level: string, message: string, context: MiddlewareContext, result?: CheckResult): void {
    if (!this.config.logging?.enabled) return;
    
    const logData: any = {
      message,
      method: context.request.method,
      url: context.request.url,
      ip: context.request.ip,
      userAgent: context.request.userAgent,
    };
    
    if (this.config.logging.includeMetadata) {
      logData.metadata = context.metadata;
    }
    
    if (result) {
      logData.rateLimit = {
        action: result.action,
        allowed: result.allowed,
        remaining: result.remaining,
        limit: result.limit,
        retryAfter: result.retryAfterMs,
      };
    }
    
    // Use appropriate log level
    switch (level) {
      case 'debug':
        console.debug('[RateLimit]', logData);
        break;
      case 'info':
        console.info('[RateLimit]', logData);
        break;
      case 'warn':
        console.warn('[RateLimit]', logData);
        break;
      case 'error':
        console.error('[RateLimit]', logData);
        break;
    }
  }
}

/**
 * Generic framework adapter implementation
 */
export class GenericFrameworkAdapter<TRequest = any, TResponse = any> implements FrameworkAdapter<TRequest, TResponse> {
  constructor(
    private requestMapper: (req: TRequest) => MiddlewareContext['request'],
    private responseApplier: (result: MiddlewareResult, res: TResponse) => void
  ) {}
  
  toContext(req: TRequest, res?: TResponse): MiddlewareContext {
    return {
      request: this.requestMapper(req),
      response: res ? this.mapResponse(res) : undefined,
    };
  }
  
  applyResult(result: MiddlewareResult, res: TResponse): void {
    this.responseApplier(result, res);
  }
  
  getMiddleware(config: HttpMiddlewareConfig) {
    // This should be implemented by framework-specific adapters
    throw new Error('getMiddleware must be implemented by framework-specific adapter');
  }
  
  private mapResponse(res: TResponse): MiddlewareContext['response'] {
    // Generic response mapping - should be overridden
    return {
      statusCode: 200,
      headers: {},
    } as any;
  }
}

/**
 * Middleware chain implementation
 */
export class MiddlewareChainImpl implements MiddlewareChain {
  private middleware: RateLimitMiddleware[] = [];
  
  use(middleware: RateLimitMiddleware): void {
    this.middleware.push(middleware);
    // Sort by priority (highest first)
    this.middleware.sort((a, b) => b.priority - a.priority);
  }
  
  async execute(context: MiddlewareContext): Promise<MiddlewareResult> {
    let index = 0;
    
    const next = async (): Promise<MiddlewareResult> => {
      if (index >= this.middleware.length) {
        // No more middleware, return default result
        return {
          allowed: true,
          action: RateLimitAction.ALLOW,
        };
      }
      
      const current = this.middleware[index++];
      return current.execute(context, next);
    };
    
    return next();
  }
  
  getMiddleware(): RateLimitMiddleware[] {
    return [...this.middleware];
  }
}

/**
 * Create HTTP rate limit middleware
 */
export function createHttpRateLimitMiddleware(
  rateLimiter: (key: RateLimitKey, identifierType: IdentifierType, configName: string, weight?: number) => Promise<CheckResult>,
  config?: HttpMiddlewareConfig
): HttpRateLimitMiddleware {
  return new HttpRateLimitMiddleware(rateLimiter, config);
}
