/**
 * Secrets Masker
 * 
 * Masks sensitive information in logs and output to prevent secrets leakage.
 */

export interface SecretsMaskerOptions {
  /** Custom patterns to mask */
  patterns?: RegExp[];
  /** Mask character (default: '***') */
  maskChar?: string;
}

/**
 * Default secret patterns to mask
 */
const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  // API keys
  /(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
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
  // Email addresses (optional - can be disabled)
  // /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
];

export class SecretsMasker {
  private patterns: RegExp[];
  private maskChar: string;

  constructor(options: SecretsMaskerOptions = {}) {
    this.patterns = [...DEFAULT_SECRET_PATTERNS, ...(options.patterns || [])];
    this.maskChar = options.maskChar || '***';
  }

  /**
   * Mask secrets in text
   */
  mask(text: string): string {
    let masked = text;
    
    for (const pattern of this.patterns) {
      masked = masked.replace(pattern, (match, ...groups) => {
        // For patterns with capture groups, mask the value part
        if (groups.length > 0 && groups[groups.length - 1]) {
          const value = groups[groups.length - 1];
          return match.replace(value, this.maskChar);
        }
        // Otherwise mask the entire match
        return this.maskChar;
      });
    }
    
    return masked;
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }
}
