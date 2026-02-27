/**
 * Secrets Masker
 * 
 * Masks sensitive information in logs and output to prevent secrets leakage.
 * Enhanced version with environment variable filtering and deep object masking.
 */

import type { SecretsMaskerOptions, MaskResult } from './types.js';

/**
 * Default secret patterns to mask
 */
const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  // API keys (sk_live_, sk_test_, pk_live_, etc.)
  /(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  // Stripe keys
  /(sk_live_|sk_test_|pk_live_|pk_test_|rk_live_|rk_test_)[a-zA-Z0-9]{24,}/gi,
  // Tokens
  /(token|access[_-]?token|bearer)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  // Passwords
  /(password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{6,})['"]?/gi,
  // Secrets
  /(secret|secret[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi,
  // AWS keys
  /(AWS[_-]?SECRET[_-]?ACCESS[_-]?KEY|AWS[_-]?ACCESS[_-]?KEY[_-]?ID)\s*[:=]\s*['"]?([A-Z0-9]{20,})['"]?/gi,
  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Credit cards
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  // GitHub tokens
  /ghp_[a-zA-Z0-9]{36,}/g,
  // GitLab tokens
  /glpat-[a-zA-Z0-9_-]{20,}/g,
  // OAuth tokens
  /oauth[_-]?token\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  // Database connection strings with passwords
  /(postgres|mysql|mongodb|redis):\/\/[^:]+:([^@]+)@/gi,
];

/**
 * Secret type detection patterns
 */
const SECRET_TYPE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'api_key', pattern: /(api[_-]?key|apikey)\s*[:=]/i },
  { type: 'stripe_key', pattern: /(sk_live_|sk_test_|pk_live_|pk_test_)/i },
  { type: 'token', pattern: /(token|access[_-]?token|bearer)\s*[:=]/i },
  { type: 'password', pattern: /(password|passwd|pwd)\s*[:=]/i },
  { type: 'secret', pattern: /(secret|secret[_-]?key)\s*[:=]/i },
  { type: 'aws_key', pattern: /AWS[_-]?SECRET[_-]?ACCESS[_-]?KEY/i },
  { type: 'private_key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i },
  { type: 'jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\./ },
  { type: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/ },
  { type: 'github_token', pattern: /ghp_/ },
  { type: 'gitlab_token', pattern: /glpat-/ },
  { type: 'oauth_token', pattern: /oauth[_-]?token/i },
  { type: 'db_password', pattern: /(postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/i },
];

export class SecretsMasker {
  private patterns: RegExp[];
  private maskChar: string;
  private allowedEnvVars: Set<string>;
  private maskEnvVars: boolean;

  constructor(options: SecretsMaskerOptions = {}) {
    this.patterns = [...DEFAULT_SECRET_PATTERNS, ...(options.patterns || [])];
    this.maskChar = options.maskChar || '***';
    this.allowedEnvVars = new Set(
      options.allowedEnvVars || ['PATH', 'HOME', 'USER', 'SHELL', 'NODE_ENV', 'PWD']
    );
    this.maskEnvVars = options.maskEnvVars ?? true;
  }

  /**
   * Mask secrets in text
   */
  mask(text: string): string {
    const result = this.maskWithDetails(text);
    return result.masked;
  }

  /**
   * Mask secrets in text and return details about what was masked
   */
  maskWithDetails(text: string): MaskResult {
    let masked = text;
    const secretTypes = new Set<string>();

    // Apply pattern-based masking
    for (const pattern of this.patterns) {
      masked = masked.replace(pattern, (match, ...groups) => {
        // Detect secret type
        for (const { type, pattern: typePattern } of SECRET_TYPE_PATTERNS) {
          if (typePattern.test(match)) {
            secretTypes.add(type);
            break;
          }
        }

        // For patterns with capture groups, mask the value part
        if (groups.length > 0 && groups[groups.length - 1]) {
          const value = groups[groups.length - 1];
          return match.replace(value, this.maskChar);
        }
        // Otherwise mask the entire match
        return this.maskChar;
      });
    }

    // Mask environment variables not in allowlist
    if (this.maskEnvVars) {
      masked = this.maskEnvVarsInText(masked);
    }

    return {
      masked,
      secretsDetected: secretTypes.size,
      secretTypes: Array.from(secretTypes),
    };
  }

  /**
   * Mask environment variables in text that are not in allowlist
   */
  private maskEnvVarsInText(text: string): string {
    // Pattern: VAR_NAME=value or VAR_NAME: value or process.env.VAR_NAME
    const envVarPattern = /(?:^|\s)([A-Z_][A-Z0-9_]*)\s*[:=]\s*['"]?([^\s'"]+)['"]?/gm;
    
    return text.replace(envVarPattern, (match, varName, value) => {
      if (this.allowedEnvVars.has(varName)) {
        return match; // Keep allowed env vars unmasked
      }
      // Mask the value
      return match.replace(value, this.maskChar);
    });
  }

  /**
   * Mask secrets in a deep object structure (for JSON)
   */
  maskObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.mask(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Check if key suggests sensitive data
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('secret') ||
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('key') ||
          lowerKey.includes('credential') ||
          lowerKey.includes('api_key') ||
          lowerKey.includes('auth')
        ) {
          masked[key] = this.maskChar;
        } else {
          masked[key] = this.maskObject(value);
        }
      }
      return masked;
    }
    
    return obj;
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  /**
   * Add an environment variable to the allowlist
   */
  addAllowedEnvVar(varName: string): void {
    this.allowedEnvVars.add(varName);
  }

  /**
   * Remove an environment variable from the allowlist
   */
  removeAllowedEnvVar(varName: string): void {
    this.allowedEnvVars.delete(varName);
  }
}

/**
 * Default instance for convenience
 */
export const defaultMasker = new SecretsMasker();

/**
 * Create a masker with custom options
 */
export function createMasker(options?: SecretsMaskerOptions): SecretsMasker {
  return new SecretsMasker(options);
}
