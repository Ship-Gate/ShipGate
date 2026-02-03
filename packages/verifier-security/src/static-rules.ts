/**
 * Static Security Rules
 * 
 * Static analysis rules for verifying token generation uses
 * approved cryptographic sources with sufficient entropy.
 * 
 * These rules analyze source code WITHOUT executing it.
 */

import type {
  SecurityRule,
  SecurityViolation,
  SecurityRuleConfig,
} from './types.js';
import {
  APPROVED_TOKEN_SOURCES,
  INSECURE_PATTERNS,
  checkTokenSource,
  MIN_HEX_LENGTH_FOR_256_BIT,
  MIN_BASE64_LENGTH_FOR_256_BIT,
} from './approved-sources.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the line number for a match in code
 */
function findLineNumber(code: string, searchOrIndex: string | number): number {
  const idx = typeof searchOrIndex === 'number' 
    ? searchOrIndex 
    : code.indexOf(searchOrIndex);
  if (idx === -1) return 1;
  return code.slice(0, idx).split('\n').length;
}

/**
 * Get the content of a specific line
 */
function getLineContent(code: string, lineNum: number): string {
  const lines = code.split('\n');
  return lines[lineNum - 1] || '';
}

/**
 * Check if file should be skipped
 */
function shouldSkipFile(file: string, config?: SecurityRuleConfig): boolean {
  const defaultSkipPatterns = [
    '.test.',
    '.spec.',
    '.types.',
    '.schema.',
    '.d.ts',
    '__mocks__',
    '__fixtures__',
    '/mocks/',
    '/fixtures/',
    '/test-fixtures/',
  ];

  const skipPatterns = [
    ...defaultSkipPatterns,
    ...(config?.skipPatterns || []),
  ];

  return skipPatterns.some(pattern => file.includes(pattern));
}

// ============================================================================
// TOKEN SOURCE RULE
// ============================================================================

/**
 * Rule: security/token-approved-source
 * 
 * Verifies that session token generation uses an approved
 * cryptographic source (crypto.randomBytes or equivalent).
 */
const TOKEN_APPROVED_SOURCE_RULE: SecurityRule = {
  id: 'security/token-approved-source',
  description: 'Session tokens must use approved cryptographic sources (crypto.randomBytes(32) or equivalent)',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    // Detect token generation patterns
    const tokenGenerationPatterns = [
      // Direct token creation
      /(?:session|auth|access|refresh)?[Tt]oken\s*[=:]\s*/g,
      // Token generator function
      /(?:generate|create|make)(?:Session|Auth|Access|Refresh)?[Tt]oken\s*\(/gi,
      // Token property assignment
      /\.token\s*=\s*/g,
      // sessionId generation
      /session[Ii]d\s*[=:]\s*/g,
    ];

    let hasTokenGeneration = false;
    let tokenLineNum = 1;

    for (const pattern of tokenGenerationPatterns) {
      const match = code.match(pattern);
      if (match) {
        hasTokenGeneration = true;
        tokenLineNum = findLineNumber(code, match[0]);
        break;
      }
    }

    if (!hasTokenGeneration) {
      return []; // No token generation detected
    }

    // Check for insecure patterns FIRST
    for (const insecure of INSECURE_PATTERNS) {
      const matches = [...code.matchAll(insecure.pattern)];
      for (const match of matches) {
        // Check if this is near token generation
        const lineNum = findLineNumber(code, match.index!);
        const context = code.slice(
          Math.max(0, match.index! - 200),
          Math.min(code.length, match.index! + 200)
        );
        
        if (/token|session|secret|auth/i.test(context)) {
          violations.push({
            ruleId: 'security/token-approved-source',
            file,
            line: lineNum,
            message: `CRITICAL: ${insecure.reason}`,
            severity: insecure.severity,
            evidence: match[0],
            fix: 'Use crypto.randomBytes(32).toString("hex") for secure token generation',
          });
        }
      }
    }

    // Check for approved sources
    const sourceResult = checkTokenSource(code, config?.minEntropyBits || 256);
    
    if (!sourceResult.approved) {
      // Check if ANY crypto usage exists
      const hasCryptoImport = /import.*crypto|require.*crypto/i.test(code);
      const hasAnyCrypto = /crypto\./i.test(code);

      if (!hasAnyCrypto) {
        violations.push({
          ruleId: 'security/token-approved-source',
          file,
          line: tokenLineNum,
          message: 'No cryptographic source detected for token generation',
          severity: 'critical',
          evidence: getLineContent(code, tokenLineNum).trim().slice(0, 100),
          fix: 'Import crypto and use: crypto.randomBytes(32).toString("hex")',
          metadata: { sourceResult },
        });
      } else {
        violations.push({
          ruleId: 'security/token-approved-source',
          file,
          line: tokenLineNum,
          message: sourceResult.reason,
          severity: 'high',
          evidence: getLineContent(code, tokenLineNum).trim().slice(0, 100),
          fix: 'Use crypto.randomBytes(32) for 256-bit entropy',
          metadata: { sourceResult },
        });
      }
    }

    return violations;
  },
};

// ============================================================================
// TOKEN LENGTH RULE
// ============================================================================

/**
 * Rule: security/token-min-length
 * 
 * Verifies that generated tokens meet minimum length requirements
 * for 256-bit entropy (64 hex chars or 43+ base64 chars).
 */
const TOKEN_MIN_LENGTH_RULE: SecurityRule = {
  id: 'security/token-min-length',
  description: 'Session tokens must be at least 64 hex characters (256 bits)',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    const minLength = config?.minTokenLength || MIN_HEX_LENGTH_FOR_256_BIT;

    // Check crypto.randomBytes byte count
    const randomBytesMatches = [...code.matchAll(/crypto\.randomBytes\s*\(\s*(\d+)\s*\)/g)];
    
    for (const match of randomBytesMatches) {
      const byteCount = parseInt(match[1], 10);
      const requiredBytes = Math.ceil(minLength / 2); // hex encoding
      
      if (byteCount < requiredBytes) {
        violations.push({
          ruleId: 'security/token-min-length',
          file,
          line: findLineNumber(code, match.index!),
          message: `Insufficient token length: ${byteCount} bytes = ${byteCount * 2} hex chars (minimum ${minLength} required)`,
          severity: 'critical',
          evidence: match[0],
          fix: `Use crypto.randomBytes(${requiredBytes}) for ${minLength} hex characters`,
        });
      }
    }

    // Check getRandomValues array size
    const getRandomValuesMatches = [...code.matchAll(/crypto\.getRandomValues\s*\(\s*new\s+Uint8Array\s*\(\s*(\d+)\s*\)\s*\)/g)];
    
    for (const match of getRandomValuesMatches) {
      const byteCount = parseInt(match[1], 10);
      const requiredBytes = Math.ceil(minLength / 2);
      
      if (byteCount < requiredBytes) {
        violations.push({
          ruleId: 'security/token-min-length',
          file,
          line: findLineNumber(code, match.index!),
          message: `Insufficient token length: ${byteCount} bytes (minimum ${requiredBytes} required for ${minLength} hex chars)`,
          severity: 'critical',
          evidence: match[0],
          fix: `Use new Uint8Array(${requiredBytes}) for sufficient entropy`,
        });
      }
    }

    // Check nanoid length
    const nanoidMatches = [...code.matchAll(/(?:nanoid|customAlphabet[^)]*\))\s*\(\s*(\d+)\s*\)/g)];
    
    for (const match of nanoidMatches) {
      const charCount = parseInt(match[1], 10);
      // nanoid uses base64url alphabet (64 chars), so 6 bits per char
      const entropyBits = charCount * 6;
      
      if (entropyBits < 256) {
        violations.push({
          ruleId: 'security/token-min-length',
          file,
          line: findLineNumber(code, match.index!),
          message: `Insufficient nanoid length: ${charCount} chars = ${entropyBits} bits (minimum 256 required)`,
          severity: 'high',
          evidence: match[0],
          fix: 'Use nanoid(43) or longer for 256+ bits of entropy',
        });
      }
    }

    // Check for hardcoded short tokens
    const hardcodedTokenMatches = [...code.matchAll(/(?:token|session|secret)\s*[=:]\s*['"]([a-zA-Z0-9+/=_-]+)['"]/gi)];
    
    for (const match of hardcodedTokenMatches) {
      const tokenValue = match[1];
      
      if (tokenValue.length < minLength) {
        violations.push({
          ruleId: 'security/token-min-length',
          file,
          line: findLineNumber(code, match.index!),
          message: `Hardcoded token too short: ${tokenValue.length} chars (minimum ${minLength} required)`,
          severity: 'critical',
          evidence: `${match[0].slice(0, 30)}...`,
          fix: 'Never hardcode tokens. Use crypto.randomBytes(32).toString("hex")',
        });
      }
    }

    return violations;
  },
};

// ============================================================================
// TOKEN ENTROPY VALIDATION RULE
// ============================================================================

/**
 * Rule: security/token-entropy-validation
 * 
 * Ensures tokens are validated for sufficient entropy at creation time.
 */
const TOKEN_ENTROPY_VALIDATION_RULE: SecurityRule = {
  id: 'security/token-entropy-validation',
  description: 'Token creation should include entropy validation',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    // Check if there's token generation
    const hasTokenGen = /(?:generate|create|make)(?:Session|Auth|Access|Refresh)?[Tt]oken/gi.test(code);
    
    if (!hasTokenGen) {
      return [];
    }

    // Check for entropy validation patterns
    const hasEntropyCheck = 
      /\.length\s*(?:>=?|>)\s*(?:64|32|MIN_TOKEN_LENGTH)/i.test(code) ||
      /validateTokenLength|checkEntropy|verifyTokenLength/i.test(code) ||
      /throw.*(?:entropy|length|too short)/i.test(code);

    if (!hasEntropyCheck) {
      violations.push({
        ruleId: 'security/token-entropy-validation',
        file,
        line: 1,
        message: 'Token generation should validate output length/entropy',
        severity: 'medium',
        evidence: 'Token generation function without length validation',
        fix: 'Add validation: if (token.length < 64) throw new Error("Insufficient token entropy")',
      });
    }

    return violations;
  },
};

// ============================================================================
// CONSTANT-TIME COMPARISON RULE
// ============================================================================

/**
 * Approved constant-time comparison functions.
 * These are the ONLY functions that should be used for secret comparison.
 */
export const APPROVED_CONSTANT_TIME_HELPERS = [
  // Node.js crypto
  'timingSafeEqual',
  'crypto.timingSafeEqual',
  // Common wrappers
  'safeCompare',
  'constantTimeCompare',
  'secureCompare',
  'timingSafeCompare',
  // bcrypt (uses constant-time internally)
  'bcrypt.compare',
  'bcryptjs.compare',
  'bcrypt.compareSync',
  'bcryptjs.compareSync',
  // argon2 (uses constant-time internally)
  'argon2.verify',
  // scrypt-kdf
  'scrypt.verify',
];

/**
 * Patterns that indicate code is dealing with passwords or secrets.
 */
const PASSWORD_CONTEXT_PATTERNS = [
  /password/i,
  /passwd/i,
  /pwd(?![a-z])/i,
  /passphrase/i,
  /hash(?:ed)?(?:Password|Passwd|Pwd)/i,
  /storedHash/i,
  /userHash/i,
  /dbHash/i,
  /expectedHash/i,
  /actualHash/i,
  /inputPassword/i,
  /providedPassword/i,
  /userPassword/i,
  /attemptedPassword/i,
  /secret(?:Key|Token|Hash)?/i,
  /apiKey/i,
  /api_key/i,
  /authToken/i,
  /accessToken/i,
  /refreshToken/i,
  /hmac/i,
  /signature/i,
  /digest/i,
];

/**
 * Check if a line looks like it's comparing hash values
 */
function isLikelyHashComparison(line: string, context: string): boolean {
  const hashIndicators = [
    /hash/i,
    /digest/i,
    /bcrypt/i,
    /argon/i,
    /scrypt/i,
    /pbkdf/i,
    /sha\d+/i,
    /md5/i,
    /hmac/i,
    /\$2[aby]\$/,  // bcrypt hash prefix
    /^\$argon/,   // argon2 hash prefix
  ];

  return hashIndicators.some((pattern) =>
    pattern.test(line) || pattern.test(context)
  );
}

/**
 * Generate fix guidance for constant-time comparison
 */
function getConstantTimeComparisonFix(left: string, right: string): string {
  return `Replace direct comparison with constant-time function:

// Option 1: Using Node.js crypto (recommended)
import { timingSafeEqual } from 'crypto';

const leftBuf = Buffer.from(${left});
const rightBuf = Buffer.from(${right});

if (leftBuf.length !== rightBuf.length) {
  return false;
}
const isMatch = timingSafeEqual(leftBuf, rightBuf);

// Option 2: For password hashes, use bcrypt.compare
import bcrypt from 'bcrypt';
const isMatch = await bcrypt.compare(inputPassword, storedHash);`;
}

/**
 * Extract relevant context lines for error reporting
 */
function extractRelevantContext(lines: string[], centerIdx: number): string {
  const start = Math.max(0, centerIdx - 2);
  const end = Math.min(lines.length, centerIdx + 3);
  return lines
    .slice(start, end)
    .map((line, idx) => `${start + idx + 1}: ${line}`)
    .join('\n');
}

/**
 * Rule: security/constant-time-compare
 * 
 * Verifies that password and secret comparisons use constant-time functions
 * to prevent timing attacks.
 * 
 * Invariant: password comparison is constant-time
 */
const CONSTANT_TIME_COMPARE_RULE: SecurityRule = {
  id: 'security/constant-time-compare',
  description: 'Password and secret comparison must use constant-time functions to prevent timing attacks',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    const lines = code.split('\n');

    // Phase 1: Find all equality comparisons of password/secret variables
    const equalityPatterns = [
      /(\w+)\s*===\s*(\w+)/g,
      /(\w+)\s*!==\s*(\w+)/g,
      /(\w+)\s*==\s*(\w+)/g,
      /(\w+)\s*!=\s*(\w+)/g,
      /(\w+)\.localeCompare\s*\(\s*(\w+)\s*\)/g,
    ];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';
      const lineNum = lineIdx + 1;

      // Skip comment lines
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }

      // Get context window (5 lines before and after)
      const contextStart = Math.max(0, lineIdx - 5);
      const contextEnd = Math.min(lines.length, lineIdx + 6);
      const contextWindow = lines.slice(contextStart, contextEnd).join('\n');

      for (const pattern of equalityPatterns) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(line)) !== null) {
          const leftOperand = match[1] ?? '';
          const rightOperand = match[2] ?? '';

          // Check if either operand involves a password/secret context
          const operands = [leftOperand, rightOperand];
          const isPasswordContext = operands.some((operand) =>
            operand && PASSWORD_CONTEXT_PATTERNS.some((ctxPattern) => ctxPattern.test(operand))
          );

          // Also check the surrounding context for password-related code
          const contextHasPasswordRef = PASSWORD_CONTEXT_PATTERNS.some((ctxPattern) =>
            ctxPattern.test(contextWindow)
          );

          // Only flag if this looks like a password/hash comparison
          if (isPasswordContext || (contextHasPasswordRef && isLikelyHashComparison(line, contextWindow))) {
            // Check if there's already an approved constant-time helper being used
            const hasApprovedHelper = APPROVED_CONSTANT_TIME_HELPERS.some((helper) =>
              contextWindow.includes(helper)
            );

            if (!hasApprovedHelper) {
              violations.push({
                ruleId: 'security/constant-time-compare',
                file,
                line: lineNum,
                message: `TIMING ATTACK: Direct equality comparison of password/hash detected. Use constant-time comparison.`,
                severity: 'critical',
                evidence: line.trim().slice(0, 100),
                fix: getConstantTimeComparisonFix(leftOperand, rightOperand),
                metadata: { context: extractRelevantContext(lines, lineIdx) },
              });
            }
          }
        }
      }
    }

    // Phase 2: Detect unsafe Buffer.equals for secrets (not constant-time)
    const bufferEqualsPattern = /(\w+)\.equals\s*\(\s*(\w+)\s*\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';
      const lineNum = lineIdx + 1;

      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }

      const contextStart = Math.max(0, lineIdx - 5);
      const contextEnd = Math.min(lines.length, lineIdx + 6);
      const contextWindow = lines.slice(contextStart, contextEnd).join('\n');

      let match;
      bufferEqualsPattern.lastIndex = 0;

      while ((match = bufferEqualsPattern.exec(line)) !== null) {
        const leftOperand = match[1] ?? '';
        const rightOperand = match[2] ?? '';

        const contextHasPasswordRef = PASSWORD_CONTEXT_PATTERNS.some((ctxPattern) =>
          ctxPattern.test(contextWindow)
        );

        if (
          contextHasPasswordRef &&
          (contextWindow.includes('Buffer') || contextWindow.includes('hash'))
        ) {
          const hasApprovedHelper = APPROVED_CONSTANT_TIME_HELPERS.some((helper) =>
            contextWindow.includes(helper)
          );

          if (!hasApprovedHelper) {
            violations.push({
              ruleId: 'security/constant-time-compare',
              file,
              line: lineNum,
              message: `TIMING ATTACK: Buffer.equals() is NOT constant-time. Use crypto.timingSafeEqual() instead.`,
              severity: 'critical',
              evidence: line.trim().slice(0, 100),
              fix: `Replace ${leftOperand}.equals(${rightOperand}) with:\ncrypto.timingSafeEqual(${leftOperand}, ${rightOperand})`,
            });
          }
        }
      }
    }

    // Phase 3: Detect string comparison methods for passwords
    const stringComparePatterns = [
      /(\w+)\s*\.startsWith\s*\(\s*(\w+)\s*\)/g,
      /(\w+)\s*\.endsWith\s*\(\s*(\w+)\s*\)/g,
      /(\w+)\s*\.includes\s*\(\s*(\w+)\s*\)/g,
      /(\w+)\s*\.indexOf\s*\(\s*(\w+)\s*\)/g,
    ];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';
      const lineNum = lineIdx + 1;

      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }

      const contextStart = Math.max(0, lineIdx - 5);
      const contextEnd = Math.min(lines.length, lineIdx + 6);
      const contextWindow = lines.slice(contextStart, contextEnd).join('\n');

      for (const pattern of stringComparePatterns) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(line)) !== null) {
          const fullMatch = match[0] ?? '';
          const leftOperand = match[1] ?? '';

          const isPasswordContext = PASSWORD_CONTEXT_PATTERNS.some((ctxPattern) =>
            leftOperand && (ctxPattern.test(leftOperand) || ctxPattern.test(contextWindow))
          );

          if (isPasswordContext) {
            const methodName = fullMatch.match(/\.(\w+)\s*\(/)?.[1] ?? 'method';

            violations.push({
              ruleId: 'security/constant-time-compare',
              file,
              line: lineNum,
              message: `TIMING ATTACK: String.${methodName}() leaks timing information. Use full constant-time comparison.`,
              severity: 'high',
              evidence: line.trim().slice(0, 100),
              fix: `Do not use partial string methods for password/secret comparison. Use crypto.timingSafeEqual() for full buffer comparison.`,
            });
          }
        }
      }
    }

    return violations;
  },
};

/**
 * Rule: security/no-early-return-on-hash-mismatch
 * 
 * Prevents timing oracle attacks from early returns on hash comparison.
 * 
 * Invariant: hash comparison does not leak timing via early return
 */
const NO_EARLY_RETURN_ON_HASH_MISMATCH_RULE: SecurityRule = {
  id: 'security/no-early-return-on-hash-mismatch',
  description: 'Do not return early on hash comparison to prevent timing oracle',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    const lines = code.split('\n');

    // Pattern: if (hash !== expected) return false;
    const earlyReturnPatterns = [
      /if\s*\(\s*(\w*[Hh]ash\w*)\s*!==?\s*(\w+)\s*\)\s*(return|throw)/,
      /if\s*\(\s*(\w+)\s*!==?\s*(\w*[Hh]ash\w*)\s*\)\s*(return|throw)/,
      /if\s*\(\s*!?\s*(\w*[Pp]assword\w*)\s*===?\s*(\w+)\s*\)\s*(return|throw)/,
      /(\w*[Hh]ash\w*)\s*!==?\s*(\w+)\s*\?\s*(throw|return)/,
    ];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? '';
      const lineNum = lineIdx + 1;

      for (const pattern of earlyReturnPatterns) {
        const match = line.match(pattern);
        if (match) {
          violations.push({
            ruleId: 'security/no-early-return-on-hash-mismatch',
            file,
            line: lineNum,
            message: `TIMING ORACLE: Early return on hash mismatch leaks timing information`,
            severity: 'high',
            evidence: line.trim().slice(0, 100),
            fix: `Use constant-time comparison with crypto.timingSafeEqual(), then check result in a single branch`,
            metadata: { context: extractRelevantContext(lines, lineIdx) },
          });
        }
      }
    }

    return violations;
  },
};

// ============================================================================
// LOGIN INVARIANT RULES (from login.isl)
// ============================================================================

/**
 * Rule: security/password-never-logged
 * 
 * Enforces: password never_logged
 * Detects patterns where input.password or derived values are logged.
 * 
 * CWE-532: Insertion of Sensitive Information into Log File
 */
const PASSWORD_NEVER_LOGGED_RULE: SecurityRule = {
  id: 'security/password-never-logged',
  description: 'Password must never appear in logs (input.password or derived values)',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    const lines = code.split('\n');
    
    // Logging patterns
    const loggingPatterns = [
      /console\.(log|info|warn|error|debug|trace)/,
      /logger\.(log|info|warn|error|debug|trace)/,
      /log\.(log|info|warn|error|debug|trace)/,
      /winston\.(log|info|warn|error|debug)/,
      /pino\.(log|info|warn|error|debug|trace)/,
    ];

    // Direct password patterns
    const directPasswordPatterns = [
      /input\.password/,
      /input\['password'\]/,
      /input\["password"\]/,
      /req\.body\.password/,
      /body\.password/,
      /data\.password/,
    ];

    // Track derived password variables
    const derivedPasswordVars = new Set<string>();

    // First pass: find derived password variables
    for (const line of lines) {
      const simpleAssign = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:input|req\.body|body|data)\.password/);
      if (simpleAssign?.[1]) {
        derivedPasswordVars.add(simpleAssign[1]);
      }
      if (/\{\s*password\s*\}\s*=\s*(?:input|req\.body)/.test(line)) {
        derivedPasswordVars.add('password');
      }
      const renameMatch = line.match(/password\s*:\s*(\w+)\s*\}\s*=/);
      if (renameMatch?.[1]) {
        derivedPasswordVars.add(renameMatch[1]);
      }
    }

    // Second pass: check for password in logging
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLogging = loggingPatterns.some(p => p.test(line));
      
      if (isLogging) {
        // Check direct password references
        for (const pattern of directPasswordPatterns) {
          if (pattern.test(line)) {
            violations.push({
              ruleId: 'security/password-never-logged',
              file,
              line: i + 1,
              message: 'PASSWORD_LOGGED: Direct password reference in log statement',
              severity: 'critical',
              evidence: line.trim().slice(0, 100),
              fix: 'Never log passwords. Remove password from log statement.',
            });
            break;
          }
        }
        
        // Check password keywords
        const passwordKws = ['password', 'passwd', 'pwd'];
        const hasKeyword = passwordKws.some(kw => 
          new RegExp(`\\b${kw}\\b`, 'i').test(line)
        );
        if (hasKeyword && !violations.some(v => v.line === i + 1)) {
          violations.push({
            ruleId: 'security/password-never-logged',
            file,
            line: i + 1,
            message: 'PASSWORD_LOGGED: Password keyword found in log statement',
            severity: 'critical',
            evidence: line.trim().slice(0, 100),
            fix: 'Never log password-related data.',
          });
        }
        
        // Check derived variables
        for (const varName of derivedPasswordVars) {
          const varPattern = new RegExp(`\\b${varName}\\b`);
          if (varPattern.test(line) && !violations.some(v => v.line === i + 1)) {
            violations.push({
              ruleId: 'security/password-never-logged',
              file,
              line: i + 1,
              message: `PASSWORD_LOGGED: Derived password variable "${varName}" in log`,
              severity: 'critical',
              evidence: line.trim().slice(0, 100),
              fix: `Variable "${varName}" was assigned from password. Remove from log.`,
            });
          }
        }
      }
    }

    return violations;
  },
};

/**
 * Rule: security/error-message-consistency
 * 
 * Enforces: same error for invalid email and password
 * Prevents user enumeration attacks.
 * 
 * CWE-203: Observable Discrepancy
 */
const ERROR_MESSAGE_CONSISTENCY_RULE: SecurityRule = {
  id: 'security/error-message-consistency',
  description: 'Same error message for invalid email and password to prevent user enumeration',
  
  check(code: string, file: string, config?: SecurityRuleConfig): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    
    if (shouldSkipFile(file, config)) {
      return [];
    }

    const userNotFoundPatterns = [
      /['"`]user\s*not\s*found['"`]/i,
      /['"`]email\s*not\s*found['"`]/i,
      /['"`]account\s*not\s*found['"`]/i,
      /['"`]invalid\s*email['"`]/i,
      /USER_NOT_FOUND/,
      /EMAIL_NOT_FOUND/,
    ];

    const wrongPasswordPatterns = [
      /['"`]wrong\s*password['"`]/i,
      /['"`]incorrect\s*password['"`]/i,
      /['"`]invalid\s*password['"`]/i,
      /WRONG_PASSWORD/,
      /INCORRECT_PASSWORD/,
    ];

    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of userNotFoundPatterns) {
        if (pattern.test(line)) {
          violations.push({
            ruleId: 'security/error-message-consistency',
            file,
            line: i + 1,
            message: 'USER_ENUMERATION: Distinct error for user-not-found reveals account existence',
            severity: 'high',
            evidence: line.trim().slice(0, 100),
            fix: 'Use generic error like "Invalid credentials" for all auth failures.',
          });
          break;
        }
      }

      for (const pattern of wrongPasswordPatterns) {
        if (pattern.test(line)) {
          violations.push({
            ruleId: 'security/error-message-consistency',
            file,
            line: i + 1,
            message: 'USER_ENUMERATION: Distinct error for wrong-password reveals account existence',
            severity: 'high',
            evidence: line.trim().slice(0, 100),
            fix: 'Use generic error like "Invalid credentials" for all auth failures.',
          });
          break;
        }
      }
    }

    return violations;
  },
};

// ============================================================================
// EXPORTED RULES
// ============================================================================

/**
 * Token entropy rules
 */
export const TOKEN_RULES: SecurityRule[] = [
  TOKEN_APPROVED_SOURCE_RULE,
  TOKEN_MIN_LENGTH_RULE,
  TOKEN_ENTROPY_VALIDATION_RULE,
];

/**
 * Constant-time comparison rules
 */
export const TIMING_RULES: SecurityRule[] = [
  CONSTANT_TIME_COMPARE_RULE,
  NO_EARLY_RETURN_ON_HASH_MISMATCH_RULE,
];

/**
 * Login invariant rules
 */
export const LOGIN_INVARIANT_RULES: SecurityRule[] = [
  PASSWORD_NEVER_LOGGED_RULE,
  ERROR_MESSAGE_CONSISTENCY_RULE,
];

/**
 * All security rules for verification
 */
export const SECURITY_RULES: SecurityRule[] = [
  ...TOKEN_RULES,
  ...TIMING_RULES,
  ...LOGIN_INVARIANT_RULES,
];

/**
 * Run all security rules on code
 */
export function runSecurityRules(
  codeMap: Map<string, string>,
  config?: SecurityRuleConfig
): SecurityViolation[] {
  const violations: SecurityViolation[] = [];

  for (const [file, code] of codeMap) {
    for (const rule of SECURITY_RULES) {
      violations.push(...rule.check(code, file, config));
    }
  }

  return violations;
}

/**
 * Run a specific security rule
 */
export function runSecurityRule(
  ruleId: string,
  code: string,
  file: string,
  config?: SecurityRuleConfig
): SecurityViolation[] {
  const rule = SECURITY_RULES.find(r => r.id === ruleId);
  if (!rule) {
    throw new Error(`Unknown security rule: ${ruleId}`);
  }
  return rule.check(code, file, config);
}

/**
 * Get all available security rule IDs
 */
export function getSecurityRuleIds(): string[] {
  return SECURITY_RULES.map(r => r.id);
}

/**
 * Check if token generation code is secure
 * Convenience function that runs all token-related rules
 */
export function isTokenGenerationSecure(
  code: string,
  file: string,
  config?: SecurityRuleConfig
): { secure: boolean; violations: SecurityViolation[] } {
  const violations = SECURITY_RULES.flatMap(rule => 
    rule.check(code, file, config)
  );

  const hasCritical = violations.some(v => v.severity === 'critical');
  const hasHigh = violations.some(v => v.severity === 'high');

  return {
    secure: !hasCritical && !hasHigh,
    violations,
  };
}
