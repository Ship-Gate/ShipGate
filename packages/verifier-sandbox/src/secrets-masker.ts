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
 * Default secret patterns to mask.
 * Order matters: more specific (e.g. Bearer JWT) before generic.
 */
const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  // Bearer <token> (JWT or any token) - mask token part
  /(Bearer\s+)([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/gi,
  // JWT-like: xxxxx.yyyyy.zzzzz (base64-ish with two dots)
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
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
  // Credit cards
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
];

export class SecretsMasker {
  private patterns: RegExp[];
  private maskChar: string;

  constructor(options: SecretsMaskerOptions = {}) {
    this.patterns = [...DEFAULT_SECRET_PATTERNS, ...(options.patterns || [])];
    this.maskChar = options.maskChar || '***';
  }

  /**
   * Mask secrets in text.
   * Replace callback receives (match, ...captures, offset, entireString).
   * When there are capture groups, mask the last capture (value); else mask whole match.
   */
  mask(text: string): string {
    let masked = text;
    for (const pattern of this.patterns) {
      masked = masked.replace(pattern, (match, ...groups) => {
        // Last two args from String.replace are offset and entireString
        const captures = groups.slice(0, -2);
        const valueToMask =
          captures.length >= 1 && captures[captures.length - 1] !== undefined
            ? String(captures[captures.length - 1])
            : null;
        if (valueToMask !== null) {
          return match.replace(valueToMask, this.maskChar);
        }
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
