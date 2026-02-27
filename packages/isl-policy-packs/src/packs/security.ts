/**
 * ISL Policy Packs - Security Policy Pack
 * 
 * Rules for login security invariants:
 * - password never appears in logs
 * - same error message for invalid email and password
 * - trace/log sink scanning for sensitive data
 * 
 * @module @isl-lang/policy-packs/security
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import { matchesAnyPattern, containsKeyword } from '../utils.js';

// ============================================================================
// PASSWORD LOGGING DETECTION
// ============================================================================

/**
 * Patterns that indicate logging operations
 */
const LOGGING_PATTERNS = [
  /console\.(log|info|warn|error|debug|trace)/,
  /logger\.(log|info|warn|error|debug|trace)/,
  /log\.(log|info|warn|error|debug|trace)/,
  /winston\.(log|info|warn|error|debug)/,
  /pino\.(log|info|warn|error|debug|trace)/,
  /bunyan\.(log|info|warn|error|debug|trace)/,
  /debug\s*\(/,
  /print\s*\(/,
  /printf?\s*\(/,
  /trace\s*\(/,
  /emit\s*\(\s*['"`]log/,
];

/**
 * Direct password references to detect
 */
const PASSWORD_KEYWORDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'credential',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
];

/**
 * Patterns for input.password or similar direct references
 */
const DIRECT_PASSWORD_PATTERNS = [
  /input\.password/,
  /input\['password'\]/,
  /input\["password"\]/,
  /req\.body\.password/,
  /request\.password/,
  /params\.password/,
  /body\.password/,
  /data\.password/,
  /credentials\.password/,
  /user\.password/,
  /form\.password/,
];

/**
 * Patterns that indicate password-derived variables
 */
const DERIVED_PASSWORD_PATTERNS = [
  // const/let/var password = ...
  /(?:const|let|var)\s+(password|passwd|pwd|secret|userPassword|userPwd)\s*=/,
  // password: input.password (destructuring or object)
  /password\s*:\s*input\.password/,
  /\{\s*password\s*\}\s*=\s*input/,
  /\{\s*password\s*\}\s*=\s*req\.body/,
];

// ============================================================================
// RULES
// ============================================================================

/**
 * Rule: Forbid logging input.password or derived values
 * 
 * This is a HARD BLOCK - logging passwords is a critical security violation.
 * 
 * CWE-532: Insertion of Sensitive Information into Log File
 * OWASP: A3:2017 Sensitive Data Exposure
 */
const passwordNeverLoggedRule: PolicyRule = {
  id: 'security/password-never-logged',
  name: 'Password Never Logged',
  description: 'Detects logging of passwords, input.password, or derived password values',
  severity: 'error',
  category: 'security',
  tags: ['login', 'password', 'logging', 'pii', 'cwe-532', 'owasp-a3'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const lines = ctx.content.split('\n');
    
    // Track derived password variables
    const derivedPasswordVars = new Set<string>();
    
    // First pass: find derived password variables
    for (const line of lines) {
      // Check for password assignment patterns
      for (const pattern of DERIVED_PASSWORD_PATTERNS) {
        const match = line.match(pattern);
        if (match && match[1]) {
          derivedPasswordVars.add(match[1]);
        }
      }
      
      // Check for simple assignment: const pw = input.password
      const simpleAssign = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:input|req\.body|body|data|params)\.password/);
      if (simpleAssign && simpleAssign[1]) {
        derivedPasswordVars.add(simpleAssign[1]);
      }
      
      // Destructuring: const { password: pw } = input
      const destructureRename = line.match(/password\s*:\s*(\w+)\s*\}\s*=/);
      if (destructureRename && destructureRename[1]) {
        derivedPasswordVars.add(destructureRename[1]);
      }
    }
    
    // Second pass: check for logging of password or derived values
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLogging = matchesAnyPattern(line, LOGGING_PATTERNS);
      
      if (isLogging) {
        // Check for direct input.password references
        for (const pattern of DIRECT_PASSWORD_PATTERNS) {
          if (pattern.test(line)) {
            return {
              ruleId: 'security/password-never-logged',
              ruleName: 'Password Never Logged',
              severity: 'error',
              tier: 'hard_block',
              message: `PASSWORD_LOGGED: Direct password reference detected in log statement`,
              location: { file: ctx.filePath, line: i + 1 },
              suggestion: 'Never log passwords. Remove the password from the log statement entirely.',
              metadata: {
                cweId: 'CWE-532',
                owaspId: 'A3:2017',
                pattern: pattern.toString(),
              },
            };
          }
        }
        
        // Check for password keyword in log
        const passwordKeyword = containsKeyword(line, PASSWORD_KEYWORDS);
        if (passwordKeyword) {
          return {
            ruleId: 'security/password-never-logged',
            ruleName: 'Password Never Logged',
            severity: 'error',
            tier: 'hard_block',
            message: `PASSWORD_LOGGED: "${passwordKeyword}" found in log statement`,
            location: { file: ctx.filePath, line: i + 1 },
            suggestion: 'Never log password-related data. Remove sensitive data from logs.',
            metadata: {
              cweId: 'CWE-532',
              owaspId: 'A3:2017',
              keyword: passwordKeyword,
            },
          };
        }
        
        // Check for derived password variables
        for (const varName of derivedPasswordVars) {
          // Create pattern to match variable usage in log
          const varPattern = new RegExp(`\\b${varName}\\b`);
          if (varPattern.test(line)) {
            return {
              ruleId: 'security/password-never-logged',
              ruleName: 'Password Never Logged',
              severity: 'error',
              tier: 'hard_block',
              message: `PASSWORD_LOGGED: Derived password variable "${varName}" found in log statement`,
              location: { file: ctx.filePath, line: i + 1 },
              suggestion: `Variable "${varName}" was assigned from password. Remove it from the log statement.`,
              metadata: {
                cweId: 'CWE-532',
                owaspId: 'A3:2017',
                derivedVar: varName,
              },
            };
          }
        }
      }
    }
    
    return null;
  },
};

/**
 * Rule: Same error message for invalid email and password
 * 
 * Prevents user enumeration attacks by ensuring authentication failures
 * return the same error message regardless of whether the email or password
 * was incorrect.
 * 
 * CWE-203: Observable Discrepancy
 * OWASP: A2:2017 Broken Authentication
 */
const errorMessageConsistencyRule: PolicyRule = {
  id: 'security/error-message-consistency',
  name: 'Error Message Consistency',
  description: 'Ensures same error message for invalid email and invalid password to prevent user enumeration',
  severity: 'error',
  category: 'security',
  tags: ['login', 'authentication', 'enumeration', 'cwe-203', 'owasp-a2'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const content = ctx.content;
    
    // Patterns that indicate distinct error messages
    const userNotFoundPatterns = [
      /['"`]user\s*not\s*found['"`]/i,
      /['"`]email\s*not\s*found['"`]/i,
      /['"`]no\s*user\s*with\s*(?:this|that)\s*email['"`]/i,
      /['"`]account\s*not\s*found['"`]/i,
      /['"`]invalid\s*email['"`]/i,
      /['"`]unknown\s*email['"`]/i,
      /['"`]email\s*does\s*not\s*exist['"`]/i,
      /USER_NOT_FOUND/,
      /EMAIL_NOT_FOUND/,
      /ACCOUNT_NOT_FOUND/,
    ];
    
    const wrongPasswordPatterns = [
      /['"`]wrong\s*password['"`]/i,
      /['"`]incorrect\s*password['"`]/i,
      /['"`]invalid\s*password['"`]/i,
      /['"`]password\s*(?:is\s*)?incorrect['"`]/i,
      /['"`]bad\s*password['"`]/i,
      /WRONG_PASSWORD/,
      /INCORRECT_PASSWORD/,
      /BAD_PASSWORD/,
    ];
    
    // Check for user-not-found specific errors
    const hasUserNotFound = userNotFoundPatterns.some(pattern => pattern.test(content));
    const hasWrongPassword = wrongPasswordPatterns.some(pattern => pattern.test(content));
    
    // If file has both distinct error types, flag it
    if (hasUserNotFound) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of userNotFoundPatterns) {
          if (pattern.test(line)) {
            return {
              ruleId: 'security/error-message-consistency',
              ruleName: 'Error Message Consistency',
              severity: 'error',
              tier: 'hard_block',
              message: 'USER_ENUMERATION: Distinct error message for user-not-found reveals account existence',
              location: { file: ctx.filePath, line: i + 1 },
              suggestion: 'Use a generic error like "Invalid credentials" for both invalid email and password.',
              metadata: {
                cweId: 'CWE-203',
                owaspId: 'A2:2017',
                errorType: 'user-not-found',
              },
            };
          }
        }
      }
    }
    
    if (hasWrongPassword) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of wrongPasswordPatterns) {
          if (pattern.test(line)) {
            return {
              ruleId: 'security/error-message-consistency',
              ruleName: 'Error Message Consistency',
              severity: 'error',
              tier: 'hard_block',
              message: 'USER_ENUMERATION: Distinct error message for wrong-password reveals account existence',
              location: { file: ctx.filePath, line: i + 1 },
              suggestion: 'Use a generic error like "Invalid credentials" for both invalid email and password.',
              metadata: {
                cweId: 'CWE-203',
                owaspId: 'A2:2017',
                errorType: 'wrong-password',
              },
            };
          }
        }
      }
    }
    
    return null;
  },
};

/**
 * Rule: Password never stored in plaintext
 * 
 * Detects patterns where passwords might be stored without hashing.
 * 
 * CWE-256: Plaintext Storage of a Password
 * OWASP: A3:2017 Sensitive Data Exposure
 */
const passwordNeverStoredPlaintextRule: PolicyRule = {
  id: 'security/password-never-stored-plaintext',
  name: 'Password Never Stored Plaintext',
  description: 'Detects patterns where passwords might be stored without proper hashing',
  severity: 'error',
  category: 'security',
  tags: ['login', 'password', 'storage', 'hashing', 'cwe-256'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const lines = ctx.content.split('\n');
    
    // Patterns that indicate plaintext password storage
    const plaintextStoragePatterns = [
      // user.password = password (direct assignment)
      /(\w+)\.password\s*=\s*(?:input|req\.body|body|data|params)\.password/,
      // { password: password } without hash
      /password\s*:\s*(?:input|req\.body|body|data|params)\.password(?!\s*,?\s*password_hash)/,
      // save/create with raw password
      /\.(?:save|create|insert|update)\s*\([^)]*password\s*:\s*(?:input|req\.body|body)\.password/,
    ];
    
    // Patterns that indicate proper hashing (exclusions)
    const hashingPatterns = [
      /bcrypt/i,
      /argon2/i,
      /scrypt/i,
      /pbkdf2/i,
      /hash/i,
      /crypto/i,
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip if line contains hashing
      if (hashingPatterns.some(pattern => pattern.test(line))) {
        continue;
      }
      
      for (const pattern of plaintextStoragePatterns) {
        if (pattern.test(line)) {
          // Check surrounding context for hashing
          const contextStart = Math.max(0, i - 5);
          const contextEnd = Math.min(lines.length, i + 5);
          const context = lines.slice(contextStart, contextEnd).join('\n');
          
          const hasHashing = hashingPatterns.some(p => p.test(context));
          
          if (!hasHashing) {
            return {
              ruleId: 'security/password-never-stored-plaintext',
              ruleName: 'Password Never Stored Plaintext',
              severity: 'error',
              tier: 'hard_block',
              message: 'PLAINTEXT_PASSWORD: Password may be stored without hashing',
              location: { file: ctx.filePath, line: i + 1 },
              suggestion: 'Hash passwords using bcrypt, argon2, or scrypt before storage.',
              metadata: {
                cweId: 'CWE-256',
                owaspId: 'A3:2017',
              },
            };
          }
        }
      }
    }
    
    return null;
  },
};

// ============================================================================
// RUNTIME TRACE SCANNING RULES
// ============================================================================

/**
 * Patterns to detect in runtime traces/logs that indicate password leakage
 */
const TRACE_PASSWORD_PATTERNS = [
  // Actual password values in traces
  /"password"\s*:\s*"[^"]+"/,
  /'password'\s*:\s*'[^']+'/,
  /password=\S+/i,
  /pwd=\S+/i,
  // Password markers that shouldn't appear
  /\[PASSWORD\]/i,
  /\[SECRET\]/i,
];

/**
 * Patterns that should appear if password was properly redacted
 * If we see these in logs, it means redaction is WORKING correctly
 */
const REDACTED_MARKERS = [
  '[REDACTED]',
  '***',
  '[hidden]',
  '••••••••',
  '[SENSITIVE]',
];

/**
 * Rule: Runtime trace scan for password in logs
 * 
 * Scans runtime traces and logs for any password values that leaked.
 * This is a runtime check that examines actual execution traces.
 */
const tracePasswordScanRule: PolicyRule = {
  id: 'security/trace-password-scan',
  name: 'Trace Password Scan',
  description: 'Runtime check: scans traces/logs for password values that should not appear',
  severity: 'error',
  category: 'security',
  tags: ['runtime', 'trace', 'logging', 'password'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // This rule is designed for trace files, not source code
    // It will be invoked by the verification pipeline on trace output
    
    // Skip non-trace files (based on common trace file patterns)
    const isTraceFile = /\.(trace|log)\.json$/.test(ctx.filePath) ||
                        /traces?\//.test(ctx.filePath) ||
                        /logs?\//.test(ctx.filePath);
    
    if (!isTraceFile && !ctx.truthpack.traces) {
      return null;
    }
    
    // For source files, check if there's trace data in truthpack
    const tracesToScan = ctx.truthpack.traces || [];
    
    // Also scan file content if it's a trace file
    const contentToScan = isTraceFile ? ctx.content : '';
    
    // Scan traces from truthpack
    for (const trace of tracesToScan) {
      const traceContent = typeof trace === 'string' ? trace : JSON.stringify(trace);
      
      for (const pattern of TRACE_PASSWORD_PATTERNS) {
        if (pattern.test(traceContent)) {
          return {
            ruleId: 'security/trace-password-scan',
            ruleName: 'Trace Password Scan',
            severity: 'error',
            tier: 'hard_block',
            message: 'PASSWORD_IN_TRACE: Password value found in runtime trace/log',
            location: { file: ctx.filePath },
            suggestion: 'Password leaked into trace. Ensure password is never passed to logging functions.',
            metadata: {
              pattern: pattern.toString(),
              traceType: 'truthpack',
            },
          };
        }
      }
    }
    
    // Scan file content if it's a trace file
    if (contentToScan) {
      for (const pattern of TRACE_PASSWORD_PATTERNS) {
        if (pattern.test(contentToScan)) {
          const lines = contentToScan.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              return {
                ruleId: 'security/trace-password-scan',
                ruleName: 'Trace Password Scan',
                severity: 'error',
                tier: 'hard_block',
                message: 'PASSWORD_IN_TRACE: Password value found in runtime trace/log',
                location: { file: ctx.filePath, line: i + 1 },
                suggestion: 'Password leaked into trace. Ensure password is never passed to logging functions.',
                metadata: {
                  pattern: pattern.toString(),
                  traceType: 'file',
                },
              };
            }
          }
        }
      }
    }
    
    return null;
  },
};

/**
 * Rule: Verify redacted markers are not present in production traces
 * 
 * If redacted markers appear, it means:
 * 1. Password was passed to logging (bad)
 * 2. Redaction kicked in (good, but shouldn't have been needed)
 * 
 * The presence of redaction markers indicates the system tried to log sensitive data.
 */
const traceRedactedMarkerRule: PolicyRule = {
  id: 'security/trace-redacted-marker',
  name: 'Trace Redacted Marker Check',
  description: 'Runtime check: warns if redacted markers appear in traces (indicates password was passed to logs)',
  severity: 'warning',
  category: 'security',
  tags: ['runtime', 'trace', 'logging', 'password', 'redaction'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Skip non-trace files
    const isTraceFile = /\.(trace|log)\.json$/.test(ctx.filePath) ||
                        /traces?\//.test(ctx.filePath) ||
                        /logs?\//.test(ctx.filePath);
    
    if (!isTraceFile && !ctx.truthpack.traces) {
      return null;
    }
    
    const tracesToScan = ctx.truthpack.traces || [];
    const contentToScan = isTraceFile ? ctx.content : '';
    
    // Check for redaction markers
    for (const trace of tracesToScan) {
      const traceContent = typeof trace === 'string' ? trace : JSON.stringify(trace);
      
      for (const marker of REDACTED_MARKERS) {
        if (traceContent.includes(marker)) {
          return {
            ruleId: 'security/trace-redacted-marker',
            ruleName: 'Trace Redacted Marker Check',
            severity: 'warning',
            tier: 'soft_block',
            message: `REDACTION_MARKER: "${marker}" found in trace - password was passed to logging`,
            location: { file: ctx.filePath },
            suggestion: 'While redaction worked, password should never reach logging functions. Fix the source.',
            metadata: {
              marker,
              traceType: 'truthpack',
            },
          };
        }
      }
    }
    
    if (contentToScan) {
      for (const marker of REDACTED_MARKERS) {
        if (contentToScan.includes(marker)) {
          return {
            ruleId: 'security/trace-redacted-marker',
            ruleName: 'Trace Redacted Marker Check',
            severity: 'warning',
            tier: 'soft_block',
            message: `REDACTION_MARKER: "${marker}" found in trace - password was passed to logging`,
            location: { file: ctx.filePath },
            suggestion: 'While redaction worked, password should never reach logging functions. Fix the source.',
            metadata: {
              marker,
              traceType: 'file',
            },
          };
        }
      }
    }
    
    return null;
  },
};

// ============================================================================
// POLICY PACK EXPORT
// ============================================================================

/**
 * Security Policy Pack
 * 
 * Enforces login security invariants:
 * - password never appears in logs
 * - same error message for invalid email and password
 * - password never stored plaintext
 * - runtime trace scanning for password leaks
 */
export const securityPolicyPack: PolicyPack = {
  id: 'security',
  name: 'Login Security Invariants',
  description: 'Rules for enforcing login security: password logging, error consistency, and trace scanning',
  version: '0.1.0',
  rules: [
    passwordNeverLoggedRule,
    errorMessageConsistencyRule,
    passwordNeverStoredPlaintextRule,
    tracePasswordScanRule,
    traceRedactedMarkerRule,
  ],
  defaultConfig: {
    enabled: true,
  },
};

/**
 * Export individual rules for granular use
 */
export const securityRules = {
  passwordNeverLogged: passwordNeverLoggedRule,
  errorMessageConsistency: errorMessageConsistencyRule,
  passwordNeverStoredPlaintext: passwordNeverStoredPlaintextRule,
  tracePasswordScan: tracePasswordScanRule,
  traceRedactedMarker: traceRedactedMarkerRule,
};

/**
 * Export patterns for external use (e.g., by verifier-security)
 */
export {
  LOGGING_PATTERNS,
  PASSWORD_KEYWORDS,
  DIRECT_PASSWORD_PATTERNS,
  DERIVED_PASSWORD_PATTERNS,
  TRACE_PASSWORD_PATTERNS,
  REDACTED_MARKERS,
};

export default securityPolicyPack;
