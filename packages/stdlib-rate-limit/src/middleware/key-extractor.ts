/**
 * Key extraction utilities for rate limiting middleware
 * 
 * This module provides various strategies for extracting rate limit keys
 * from HTTP requests, including IP-based, user-based, API key-based,
 * and custom extraction methods.
 */

import { RateLimitKey, IdentifierType } from '../types';
import { 
  KeyExtractor, 
  KeyExtractorType, 
  KeyExtractorConfig,
  MiddlewareContext,
  MiddlewareUtils 
} from './types';
import { KeyExtractionError } from '../errors';

/**
 * IP-based key extractor
 */
export class IpKeyExtractor implements KeyExtractor {
  private readonly config: KeyExtractorConfig['ip'];
  
  constructor(config: KeyExtractorConfig['ip'] = {}) {
    this.config = {
      trustProxy: false,
      headerNames: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
      fallbackToSocket: true,
      ...config,
    };
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      // Try proxy headers first if trusted
      if (this.config.trustProxy) {
        for (const headerName of this.config.headerNames!) {
          const value = context.request.headers[headerName.toLowerCase()];
          if (value) {
            // X-Forwarded-For can contain multiple IPs
            const ip = value.split(',')[0].trim();
            if (this.isValidIp(ip)) {
              return ip;
            }
          }
        }
      }
      
      // Fallback to direct IP
      if (this.config.fallbackToSocket && context.request.ip) {
        return context.request.ip;
      }
      
      return null;
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract IP: ${(error as Error).message}`,
        'ip'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'IP';
  }
  
  getPriority(): number {
    return 10;
  }
  
  private isValidIp(ip: string): boolean {
    // Basic IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      return ip.split('.').every(octet => {
        const num = parseInt(octet, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    // Basic IPv6 validation
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv6Regex.test(ip);
  }
}

/**
 * User ID-based key extractor
 */
export class UserIdKeyExtractor implements KeyExtractor {
  private readonly headerName: string;
  private readonly queryName: string;
  private readonly cookieName: string;
  
  constructor(config: KeyExtractorConfig = {}) {
    this.headerName = config.headerName || 'x-user-id';
    this.queryName = config.queryName || 'user_id';
    this.cookieName = config.cookieName || 'user_id';
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      // Try header first
      const headerValue = context.request.headers[this.headerName.toLowerCase()];
      if (headerValue) {
        return headerValue;
      }
      
      // Try query parameter
      const url = new URL(context.request.url);
      const queryValue = url.searchParams.get(this.queryName);
      if (queryValue) {
        return queryValue;
      }
      
      // Try cookie (if available in context)
      const cookieHeader = context.request.headers.cookie;
      if (cookieHeader) {
        const cookies = this.parseCookies(cookieHeader);
        const cookieValue = cookies[this.cookieName];
        if (cookieValue) {
          return cookieValue;
        }
      }
      
      return null;
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract user ID: ${(error as Error).message}`,
        'user-id'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'USER_ID';
  }
  
  getPriority(): number {
    return 50;
  }
  
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    
    return cookies;
  }
}

/**
 * API key-based extractor
 */
export class ApiKeyExtractor implements KeyExtractor {
  private readonly headerName: string;
  private readonly queryName: string;
  
  constructor(config: KeyExtractorConfig = {}) {
    this.headerName = config.headerName || 'x-api-key';
    this.queryName = config.queryName || 'api_key';
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      // Try header first (most common for API keys)
      const headerValue = context.request.headers[this.headerName.toLowerCase()];
      if (headerValue) {
        // Remove "Bearer " prefix if present
        if (headerValue.startsWith('Bearer ')) {
          return headerValue.substring(7);
        }
        return headerValue;
      }
      
      // Try query parameter
      const url = new URL(context.request.url);
      const queryValue = url.searchParams.get(this.queryName);
      if (queryValue) {
        return queryValue;
      }
      
      return null;
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract API key: ${(error as Error).message}`,
        'api-key'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'API_KEY';
  }
  
  getPriority(): number {
    return 40;
  }
}

/**
 * Session-based extractor
 */
export class SessionKeyExtractor implements KeyExtractor {
  private readonly headerName: string;
  private readonly cookieName: string;
  
  constructor(config: KeyExtractorConfig = {}) {
    this.headerName = config.headerName || 'x-session-id';
    this.cookieName = config.cookieName || 'session_id';
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      // Try header first
      const headerValue = context.request.headers[this.headerName.toLowerCase()];
      if (headerValue) {
        return headerValue;
      }
      
      // Try cookie
      const cookieHeader = context.request.headers.cookie;
      if (cookieHeader) {
        const cookies = this.parseCookies(cookieHeader);
        const cookieValue = cookies[this.cookieName];
        if (cookieValue) {
          return cookieValue;
        }
      }
      
      return null;
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract session ID: ${(error as Error).message}`,
        'session'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'SESSION';
  }
  
  getPriority(): number {
    return 30;
  }
  
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    
    return cookies;
  }
}

/**
 * Header-based extractor (custom header)
 */
export class HeaderKeyExtractor implements KeyExtractor {
  private readonly headerName: string;
  
  constructor(config: KeyExtractorConfig) {
    if (!config.headerName) {
      throw new Error('Header name is required for header-based extraction');
    }
    this.headerName = config.headerName.toLowerCase();
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      const value = context.request.headers[this.headerName];
      return value || null;
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract header '${this.headerName}': ${(error as Error).message}`,
        'header'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'CUSTOM';
  }
  
  getPriority(): number {
    return 20;
  }
}

/**
 * Query parameter-based extractor
 */
export class QueryKeyExtractor implements KeyExtractor {
  private readonly queryName: string;
  
  constructor(config: KeyExtractorConfig) {
    if (!config.queryName) {
      throw new Error('Query name is required for query-based extraction');
    }
    this.queryName = config.queryName;
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      const url = new URL(context.request.url);
      return url.searchParams.get(this.queryName);
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract query parameter '${this.queryName}': ${(error as Error).message}`,
        'query'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'CUSTOM';
  }
  
  getPriority(): number {
    return 15;
  }
}

/**
 * Cookie-based extractor
 */
export class CookieKeyExtractor implements KeyExtractor {
  private readonly cookieName: string;
  
  constructor(config: KeyExtractorConfig) {
    if (!config.cookieName) {
      throw new Error('Cookie name is required for cookie-based extraction');
    }
    this.cookieName = config.cookieName;
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      const cookieHeader = context.request.headers.cookie;
      if (!cookieHeader) {
        return null;
      }
      
      const cookies = this.parseCookies(cookieHeader);
      return cookies[this.cookieName] || null;
    } catch (error) {
      throw new KeyExtractionError(
        `Failed to extract cookie '${this.cookieName}': ${(error as Error).message}`,
        'cookie'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'CUSTOM';
  }
  
  getPriority(): number {
    return 25;
  }
  
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    
    return cookies;
  }
}

/**
 * Custom function-based extractor
 */
export class CustomKeyExtractor implements KeyExtractor {
  private readonly extractor: (context: MiddlewareContext) => Promise<RateLimitKey | null>;
  
  constructor(config: KeyExtractorConfig) {
    if (!config.customExtractor) {
      throw new Error('Custom extractor function is required');
    }
    this.extractor = config.customExtractor;
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    try {
      return await this.extractor(context);
    } catch (error) {
      throw new KeyExtractionError(
        `Custom extractor failed: ${(error as Error).message}`,
        'custom'
      );
    }
  }
  
  getType(): IdentifierType {
    return 'CUSTOM';
  }
  
  getPriority(): number {
    return 5; // Lowest priority for custom extractors
  }
}

/**
 * Composite key extractor that tries multiple extractors in order
 */
export class CompositeKeyExtractor implements KeyExtractor {
  private readonly extractors: KeyExtractor[];
  
  constructor(extractors: KeyExtractor[]) {
    if (extractors.length === 0) {
      throw new Error('At least one extractor is required');
    }
    
    // Sort by priority (highest first)
    this.extractors = extractors.sort((a, b) => b.getPriority() - a.getPriority());
  }
  
  async extract(context: MiddlewareContext): Promise<RateLimitKey | null> {
    for (const extractor of this.extractors) {
      try {
        const key = await extractor.extract(context);
        if (key) {
          return key;
        }
      } catch (error) {
        // Log error but continue to next extractor
        console.warn(`Key extractor ${extractor.constructor.name} failed:`, error);
      }
    }
    
    return null;
  }
  
  getType(): IdentifierType {
    // Return the type of the highest priority extractor
    return this.extractors[0].getType();
  }
  
  getPriority(): number {
    // Return the priority of the highest priority extractor
    return this.extractors[0].getPriority();
  }
}

/**
 * Factory for creating key extractors
 */
export class KeyExtractorFactory {
  static create(type: KeyExtractorType, config?: KeyExtractorConfig): KeyExtractor {
    switch (type) {
      case 'ip':
        return new IpKeyExtractor(config?.ip);
      case 'user-id':
        return new UserIdKeyExtractor(config);
      case 'api-key':
        return new ApiKeyExtractor(config);
      case 'session':
        return new SessionKeyExtractor(config);
      case 'header':
        return new HeaderKeyExtractor(config!);
      case 'query':
        return new QueryKeyExtractor(config!);
      case 'cookie':
        return new CookieKeyExtractor(config!);
      case 'custom':
        return new CustomKeyExtractor(config!);
      default:
        throw new Error(`Unknown key extractor type: ${type}`);
    }
  }
  
  static createComposite(extractors: Array<{ type: KeyExtractorType; config?: KeyExtractorConfig }>): KeyExtractor {
    const instances = extractors.map(({ type, config }) => this.create(type, config));
    return new CompositeKeyExtractor(instances);
  }
}

/**
 * Default key extractor chain (IP -> API Key -> User ID -> Session)
 */
export function createDefaultKeyExtractor(): KeyExtractor {
  return KeyExtractorFactory.createComposite([
    { type: 'ip', config: { trustProxy: false } },
    { type: 'api-key' },
    { type: 'user-id' },
    { type: 'session' },
  ]);
}
