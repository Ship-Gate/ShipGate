/**
 * Security Pattern Detectors
 *
 * Pattern-based (no AI) fix generators for common security violations.
 * Each detector scans source code, identifies a known anti-pattern, and
 * returns a FixSuggestion with the concrete replacement.
 */

import {
  type FixSuggestion,
  type SecurityPatternId,
  type FixTag,
  type FixLocation,
  createFixSuggestion,
} from './fix-suggestion.js';
import { generateUnifiedDiff } from './diff-generator.js';

// ============================================================================
// Public API
// ============================================================================

export interface PatternDetectorOptions {
  /** File path to annotate in suggestions */
  file: string;
  /** Source code to scan */
  source: string;
}

export interface PatternDetector {
  id: SecurityPatternId;
  name: string;
  tags: FixTag[];
  /** Detect violations in source code and return suggestions */
  detect(opts: PatternDetectorOptions): FixSuggestion[];
}

/**
 * Run all pattern detectors against source code and collect suggestions.
 */
export function runAllPatternDetectors(
  file: string,
  source: string,
): FixSuggestion[] {
  const opts: PatternDetectorOptions = { file, source };
  const suggestions: FixSuggestion[] = [];

  for (const detector of ALL_DETECTORS) {
    suggestions.push(...detector.detect(opts));
  }

  return suggestions;
}

/**
 * Get a specific detector by id.
 */
export function getDetector(id: SecurityPatternId): PatternDetector | undefined {
  return ALL_DETECTORS.find((d) => d.id === id);
}

// ============================================================================
// 1. Different Error Messages  (information leakage)
// ============================================================================

const differentErrorMessagesDetector: PatternDetector = {
  id: 'different-error-messages',
  name: 'Different error messages reveal user enumeration',
  tags: ['security', 'auth', 'error-message'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Pairs of patterns that together leak info
    const leakyPairs: Array<{
      pattern1: RegExp;
      msg1Capture: number;
      pattern2: RegExp;
      msg2Capture: number;
      violationLabel: string;
    }> = [
      {
        pattern1: /(?:user|account)\s*(?:not\s*found|does\s*not\s*exist|doesn.t\s*exist)/i,
        msg1Capture: 0,
        pattern2: /(?:wrong|incorrect|invalid)\s*password/i,
        msg2Capture: 0,
        violationLabel: 'Error messages differ for wrong email vs wrong password',
      },
      {
        pattern1: /["'](?:User not found|No such user|Email not registered)["']/i,
        msg1Capture: 0,
        pattern2: /["'](?:Wrong password|Incorrect password|Password mismatch)["']/i,
        msg2Capture: 0,
        violationLabel: 'Error messages differ for missing user vs bad password',
      },
    ];

    for (const pair of leakyPairs) {
      let line1Idx = -1;
      let line2Idx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (pair.pattern1.test(lines[i]!)) line1Idx = i;
        if (pair.pattern2.test(lines[i]!)) line2Idx = i;
      }

      if (line1Idx >= 0 && line2Idx >= 0) {
        const startLine = Math.min(line1Idx, line2Idx);
        const endLine = Math.max(line1Idx, line2Idx);

        // Grab the full block between the two matches, expanding to include
        // enclosing if-statements.
        const blockStart = findBlockStart(lines, startLine);
        const blockEnd = findBlockEnd(lines, endLine);
        const currentCode = lines.slice(blockStart, blockEnd + 1).join('\n');

        // Build replacement: collapse into a single check
        const indent = detectIndent(lines[blockStart]!);
        const suggestedCode = [
          `${indent}if (!user || !validPassword) {`,
          `${indent}  return res.status(401).json({ error: "Invalid credentials" });`,
          `${indent}}`,
        ].join('\n');

        const diff = generateUnifiedDiff(file, currentCode, suggestedCode);
        const location: FixLocation = {
          line: blockStart + 1,
          column: 1,
          endLine: blockEnd + 1,
        };

        suggestions.push(
          createFixSuggestion(
            {
              violation: pair.violationLabel,
              file,
              location,
              currentCode,
              suggestedCode,
              explanation:
                'Returning different error messages for "user not found" and "wrong password" ' +
                'allows attackers to enumerate valid accounts. Use a single generic message.',
              confidence: 0.92,
              breaking: false,
              patternId: 'different-error-messages',
              tags: ['security', 'auth', 'error-message'],
            },
            diff,
          ),
        );
      }
    }

    return suggestions;
  },
};

// ============================================================================
// 2. Missing Password Hashing
// ============================================================================

const missingPasswordHashingDetector: PatternDetector = {
  id: 'missing-password-hashing',
  name: 'Plaintext password stored without hashing',
  tags: ['security', 'crypto', 'auth'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Pattern: user.password = input.password  (direct assignment)
    const directAssignPattern =
      /(\w+)\.password\s*=\s*(?:input|req\.body|body|data|params|args)\.password/;

    // Pattern: password: input.password (in an object literal)
    const objectLiteralPattern =
      /password\s*:\s*(?:input|req\.body|body|data|params|args)\.password/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const matchDirect = directAssignPattern.exec(line);
      const matchLiteral = objectLiteralPattern.exec(line);
      const match = matchDirect ?? matchLiteral;

      if (match) {
        // Skip if hashing is already nearby (within 3 lines)
        const nearby = lines
          .slice(Math.max(0, i - 3), Math.min(lines.length, i + 4))
          .join('\n');
        if (/bcrypt|argon2|scrypt|hash/i.test(nearby)) continue;

        const indent = detectIndent(line);
        const currentCode = line.trimEnd();

        let suggestedCode: string;
        if (matchDirect) {
          suggestedCode = `${indent}${matchDirect[1]}.password = await bcrypt.hash(input.password, 12);`;
        } else {
          suggestedCode = `${indent}password: await bcrypt.hash(input.password, 12),`;
        }

        const diff = generateUnifiedDiff(file, currentCode, suggestedCode);

        suggestions.push(
          createFixSuggestion(
            {
              violation: 'Password stored in plaintext without hashing',
              file,
              location: { line: i + 1, column: (match.index ?? 0) + 1 },
              currentCode,
              suggestedCode,
              explanation:
                'Passwords must be hashed before storage using bcrypt (or argon2/scrypt). ' +
                'Storing plaintext passwords is a critical security vulnerability.',
              confidence: 0.95,
              breaking: false,
              patternId: 'missing-password-hashing',
              tags: ['security', 'crypto', 'auth'],
            },
            diff,
          ),
        );
      }
    }

    return suggestions;
  },
};

// ============================================================================
// 3. No Rate Limiting
// ============================================================================

const noRateLimitingDetector: PatternDetector = {
  id: 'no-rate-limiting',
  name: 'Sensitive endpoint without rate limiting',
  tags: ['security', 'rate-limit', 'auth'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Sensitive route patterns
    const sensitiveRoutes =
      /router\.(post|put|patch)\s*\(\s*['"`](\/login|\/auth|\/register|\/signup|\/reset-password|\/forgot-password|\/verify|\/token|\/otp)['"`]\s*,/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = sensitiveRoutes.exec(line);

      if (match) {
        // Check if rateLimit is already applied
        const nearby = lines
          .slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
          .join('\n');
        if (/rateLimit|rateLimiter|throttle|slowDown/i.test(nearby)) continue;

        const indent = detectIndent(line);
        const currentCode = line.trimEnd();
        const method = match[1];
        const path = match[2];

        // Extract handler name from after the route path
        const handlerMatch = line.match(
          new RegExp(`['"\`]${escapeRegex(path!)}['"\`]\\s*,\\s*(\\w+)`),
        );
        const handler = handlerMatch?.[1] ?? 'handler';

        const suggestedCode = `${indent}router.${method}('${path}', rateLimit({ windowMs: 60 * 1000, max: 5 }), ${handler});`;

        const diff = generateUnifiedDiff(file, currentCode, suggestedCode);

        suggestions.push(
          createFixSuggestion(
            {
              violation: `Sensitive endpoint ${path} has no rate limiting`,
              file,
              location: { line: i + 1, column: (match.index ?? 0) + 1 },
              currentCode,
              suggestedCode,
              explanation:
                `The ${path} endpoint is vulnerable to brute-force attacks without rate limiting. ` +
                'Add rate limiting middleware to restrict the number of requests per time window.',
              confidence: 0.88,
              breaking: false,
              patternId: 'no-rate-limiting',
              tags: ['security', 'rate-limit', 'auth'],
            },
            diff,
          ),
        );
      }
    }

    return suggestions;
  },
};

// ============================================================================
// 4. Missing Input Validation
// ============================================================================

const missingInputValidationDetector: PatternDetector = {
  id: 'missing-input-validation',
  name: 'Request body destructured without validation',
  tags: ['security', 'validation', 'input'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Pattern: const { email, password } = req.body   (no prior validation)
    const destructurePattern =
      /const\s*\{([^}]+)\}\s*=\s*(?:req\.body|request\.body|ctx\.request\.body|body)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = destructurePattern.exec(line);

      if (match) {
        // Check if zod / joi / yup validation is nearby
        const lookback = lines
          .slice(Math.max(0, i - 5), i + 1)
          .join('\n');
        if (/\.parse\(|\.validate\(|\.safeParse\(|validateBody|zodSchema|joiSchema/i.test(lookback)) {
          continue;
        }

        const fields = match[1]!
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);

        const indent = detectIndent(line);
        const currentCode = line.trimEnd();

        // Build a zod schema from field names
        const schemaFields = fields
          .map((f) => {
            const name = f.includes(':') ? f.split(':')[0]!.trim() : f;
            if (/email/i.test(name)) return `  ${name}: z.string().email()`;
            if (/password/i.test(name)) return `  ${name}: z.string().min(8)`;
            if (/name|username/i.test(name)) return `  ${name}: z.string().min(1)`;
            if (/id/i.test(name)) return `  ${name}: z.string().uuid()`;
            if (/amount|price|quantity/i.test(name))
              return `  ${name}: z.number().positive()`;
            return `  ${name}: z.string()`;
          })
          .join(',\n');

        const fieldsStr = fields
          .map((f) => (f.includes(':') ? f.split(':')[0]!.trim() : f))
          .join(', ');

        const suggestedCode = [
          `${indent}const bodySchema = z.object({`,
          `${schemaFields}`,
          `${indent}});`,
          `${indent}const { ${fieldsStr} } = bodySchema.parse(req.body);`,
        ].join('\n');

        const diff = generateUnifiedDiff(file, currentCode, suggestedCode);

        suggestions.push(
          createFixSuggestion(
            {
              violation: 'Request body destructured without input validation',
              file,
              location: { line: i + 1, column: (match.index ?? 0) + 1 },
              currentCode,
              suggestedCode,
              explanation:
                'Destructuring request body without validation allows malformed or ' +
                'malicious input. Use a schema validator (e.g. zod) to parse and ' +
                'validate all fields before use.',
              confidence: 0.85,
              breaking: false,
              patternId: 'missing-input-validation',
              tags: ['security', 'validation', 'input'],
            },
            diff,
          ),
        );
      }
    }

    return suggestions;
  },
};

// ============================================================================
// 5. Token Without Expiry
// ============================================================================

const tokenWithoutExpiryDetector: PatternDetector = {
  id: 'token-without-expiry',
  name: 'JWT signed without expiration',
  tags: ['security', 'token', 'auth'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Pattern: jwt.sign(payload, secret)  without options or with options missing expiresIn
    const jwtSignPattern = /jwt\.sign\s*\(\s*(\w+)\s*,\s*(\w+|['"`][^'"`]+['"`])\s*\)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = jwtSignPattern.exec(line);

      if (match) {
        // Check that there's no expiresIn in the call already
        // (the regex only matches 2-arg calls without options object)
        const indent = detectIndent(line);
        const currentCode = line.trimEnd();
        const payload = match[1];
        const secret = match[2];

        const suggestedCode = `${indent}jwt.sign(${payload}, ${secret}, { expiresIn: '1h' });`;

        // Make sure we're not duplicating if the full 3-arg form is present
        if (/expiresIn|exp\s*:/i.test(line)) continue;

        const diff = generateUnifiedDiff(file, currentCode, suggestedCode);

        suggestions.push(
          createFixSuggestion(
            {
              violation: 'JWT signed without expiration time',
              file,
              location: { line: i + 1, column: (match.index ?? 0) + 1 },
              currentCode,
              suggestedCode,
              explanation:
                'JWTs without an expiry never become invalid, meaning a leaked token ' +
                'grants permanent access. Always set expiresIn (e.g. "1h") when signing.',
              confidence: 0.93,
              breaking: false,
              patternId: 'token-without-expiry',
              tags: ['security', 'token', 'auth'],
            },
            diff,
          ),
        );
      }
    }

    return suggestions;
  },
};

// ============================================================================
// 6. Plaintext Password Storage (password stored via ORM)
// ============================================================================

const plaintextPasswordStorageDetector: PatternDetector = {
  id: 'plaintext-password-storage',
  name: 'Password passed to create/update without hashing',
  tags: ['security', 'crypto', 'auth'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Pattern: .create({ ... password: password ... })
    // We look for a password field inside a create/update/insert call
    const createPattern = /\.(create|update|insert|upsert|save)\s*\(\s*\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!createPattern.test(line)) continue;

      // Look forward up to 10 lines for password field in the object
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const innerLine = lines[j]!;
        const pwMatch = /password\s*:\s*(?!.*(?:hash|bcrypt|argon|scrypt))(\w+(?:\.\w+)*)/.exec(innerLine);

        if (pwMatch) {
          // Ensure we're not already hashing
          const nearby = lines
            .slice(Math.max(0, j - 3), Math.min(lines.length, j + 2))
            .join('\n');
          if (/bcrypt|argon2|scrypt|hash/i.test(nearby)) break;

          const indent = detectIndent(innerLine);
          const currentCode = innerLine.trimEnd();
          const varName = pwMatch[1];
          const suggestedCode = `${indent}password: await bcrypt.hash(${varName}, 12),`;

          const diff = generateUnifiedDiff(file, currentCode, suggestedCode);

          suggestions.push(
            createFixSuggestion(
              {
                violation: 'Password passed to database operation without hashing',
                file,
                location: { line: j + 1, column: 1 },
                currentCode,
                suggestedCode,
                explanation:
                  'The password value is written directly to the database. ' +
                  'Hash it with bcrypt (cost factor >= 12) before persisting.',
                confidence: 0.90,
                breaking: false,
                patternId: 'plaintext-password-storage',
                tags: ['security', 'crypto', 'auth'],
              },
              diff,
            ),
          );
          break; // One suggestion per create call
        }
      }
    }

    return suggestions;
  },
};

// ============================================================================
// 7. Missing Auth Check
// ============================================================================

const missingAuthCheckDetector: PatternDetector = {
  id: 'missing-auth-check',
  name: 'Protected route without auth middleware',
  tags: ['security', 'auth'],

  detect({ file, source }: PatternDetectorOptions): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    const lines = source.split('\n');

    // Pattern: sensitive routes that need auth but don't have auth middleware
    const protectedRoutes =
      /router\.(get|post|put|patch|delete)\s*\(\s*['"`](\/users|\/account|\/profile|\/settings|\/admin|\/dashboard|\/billing|\/orders)(?:\/[^'"`]*)?\s*['"`]\s*,/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = protectedRoutes.exec(line);

      if (match) {
        // Check if auth middleware is present
        if (/auth|authenticate|requireAuth|isAuthenticated|protect|guard|middleware/i.test(line)) {
          continue;
        }

        const indent = detectIndent(line);
        const currentCode = line.trimEnd();
        const method = match[1];
        const path = match[2];

        // Extract handler
        const handlerMatch = line.match(
          new RegExp(`['"\`][^'"\`]+['"\`]\\s*,\\s*(\\w+)`),
        );
        const handler = handlerMatch?.[1] ?? 'handler';

        const suggestedCode = `${indent}router.${method}('${path}', requireAuth, ${handler});`;

        const diff = generateUnifiedDiff(file, currentCode, suggestedCode);

        suggestions.push(
          createFixSuggestion(
            {
              violation: `Protected route ${path} missing auth middleware`,
              file,
              location: { line: i + 1, column: (match.index ?? 0) + 1 },
              currentCode,
              suggestedCode,
              explanation:
                `The ${path} endpoint handles sensitive data but lacks authentication ` +
                'middleware. Add requireAuth (or equivalent) to prevent unauthorized access.',
              confidence: 0.75,
              breaking: true,
              patternId: 'missing-auth-check',
              tags: ['security', 'auth'],
            },
            diff,
          ),
        );
      }
    }

    return suggestions;
  },
};

// ============================================================================
// Registry
// ============================================================================

export const ALL_DETECTORS: PatternDetector[] = [
  differentErrorMessagesDetector,
  missingPasswordHashingDetector,
  noRateLimitingDetector,
  missingInputValidationDetector,
  tokenWithoutExpiryDetector,
  plaintextPasswordStorageDetector,
  missingAuthCheckDetector,
];

// ============================================================================
// Internal Helpers
// ============================================================================

function detectIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  return match?.[1] ?? '';
}

function findBlockStart(lines: string[], from: number): number {
  let idx = from;
  while (idx > 0) {
    const line = lines[idx - 1]!;
    if (/^\s*if\s*\(/.test(line) || /^\s*else\s/.test(line)) {
      idx--;
    } else {
      break;
    }
  }
  return idx;
}

function findBlockEnd(lines: string[], from: number): number {
  let idx = from;
  let braceDepth = 0;
  while (idx < lines.length - 1) {
    const line = lines[idx]!;
    braceDepth += (line.match(/{/g) ?? []).length;
    braceDepth -= (line.match(/}/g) ?? []).length;
    if (braceDepth <= 0 && idx > from) break;
    idx++;
  }
  return idx;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
