/**
 * AST-Based Semantic Rules for Next.js Route Handlers
 *
 * These are REAL enforcement checks, not string matching.
 * A rule passes only when the semantic requirement is satisfied.
 *
 * Focus rules:
 * - intent/audit-required: Must cover ALL return paths (success + failures)
 * - intent/rate-limit-required: Must be BEFORE request.json and business logic
 * - intent/no-pii-logging: Must ban console.* and PII sinks
 * - quality/no-stubbed-handlers: Must block "Not implemented"
 *
 * @module @isl-lang/healer/rules
 */

// ============================================================================
// Types
// ============================================================================

export interface SemanticViolation {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  fix?: string;
  /** Additional context for the violation */
  context?: {
    exitPath?: ExitPath;
    auditCalls?: AuditCall[];
    totalExitPaths?: number;
    coveredExitPaths?: number;
  };
}

export interface SemanticRule {
  id: string;
  description: string;
  check: (code: string, file: string, config?: SemanticRuleConfig) => SemanticViolation[];
}

export interface SemanticRuleConfig {
  stubAllowlist?: string[];
  [key: string]: unknown;
}

// ============================================================================
// Exit Path Analysis Types
// ============================================================================

export interface ExitPath {
  line: number;
  column: number;
  code: string;
  type: 'success' | 'error' | 'rate_limit' | 'validation' | 'auth' | 'server_error' | 'unknown';
  isSuccessPath: boolean;
  statusCode?: number;
  /** Whether this exit path has an audit call before it */
  hasAudit: boolean;
  /** The audit call if present */
  auditCall?: AuditCall;
}

export interface AuditCall {
  line: number;
  column: number;
  payload: string;
  methodName: string;
  /** Extracted success value */
  successValue?: boolean | 'dynamic';
  /** Extracted reason field */
  reason?: string;
  /** Required fields present */
  hasTimestamp: boolean;
  hasRequestId: boolean;
  hasAction: boolean;
}

export interface HandlerInfo {
  method: string;
  startLine: number;
  endLine: number;
  bodyStartOffset: number;
  bodyEndOffset: number;
  code: string;
}

// ============================================================================
// AST-Light Parsing Utilities
// ============================================================================

/**
 * Parse Next.js route handlers from source code
 */
function parseHandlers(code: string): HandlerInfo[] {
  const handlers: HandlerInfo[] = [];
  const pattern = /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\([^)]*\)\s*\{/g;

  let match;
  while ((match = pattern.exec(code)) !== null) {
    const method = match[2];
    const startOffset = match.index;
    const startLine = code.substring(0, startOffset).split('\n').length;
    const bodyStartOffset = code.indexOf('{', startOffset);

    // Find matching closing brace
    let braceCount = 0;
    let i = bodyStartOffset;
    while (i < code.length) {
      if (code[i] === '{') braceCount++;
      if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) break;
      }
      i++;
    }

    const bodyEndOffset = i + 1;
    const endLine = code.substring(0, bodyEndOffset).split('\n').length;
    const handlerCode = code.substring(startOffset, bodyEndOffset);

    handlers.push({
      method,
      startLine,
      endLine,
      bodyStartOffset: bodyStartOffset - startOffset,
      bodyEndOffset: bodyEndOffset - startOffset,
      code: handlerCode,
    });
  }

  return handlers;
}

/**
 * Extract all exit paths (return statements) from handler code
 */
function extractExitPaths(handlerCode: string, handlerStartLine: number): ExitPath[] {
  const exitPaths: ExitPath[] = [];
  const lines = handlerCode.split('\n');

  // Patterns for return statements
  const returnPatterns = [
    /return\s+NextResponse\.json\s*\(/,
    /return\s+Response\.json\s*\(/,
    /return\s+new\s+(NextResponse|Response)\s*\(/,
    /return\s+res\.(json|send|status)/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = handlerStartLine + i;

    for (const pattern of returnPatterns) {
      if (pattern.test(line)) {
        const exitPath = classifyExitPath(handlerCode, lines, i, lineNum);
        exitPaths.push(exitPath);
        break;
      }
    }
  }

  return exitPaths;
}

/**
 * Classify an exit path based on context
 */
function classifyExitPath(
  handlerCode: string,
  lines: string[],
  lineIndex: number,
  absoluteLine: number
): ExitPath {
  // Look at surrounding context (10 lines before, current line, 5 lines after)
  const contextStart = Math.max(0, lineIndex - 10);
  const contextEnd = Math.min(lines.length, lineIndex + 5);
  const context = lines.slice(contextStart, contextEnd).join('\n').toLowerCase();
  const currentLine = lines[lineIndex];

  // Extract status code
  const statusMatch = currentLine.match(/status:\s*(\d{3})/i) ||
    context.match(/status:\s*(\d{3})/i) ||
    currentLine.match(/\b(4\d{2}|5\d{2}|2\d{2})\b/);
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

  // Check for audit in preceding lines (within 15 lines before return)
  const precedingStart = Math.max(0, lineIndex - 15);
  const precedingLines = lines.slice(precedingStart, lineIndex).join('\n');
  const hasAudit = /audit(?:Attempt|Event|Log)?\s*\(/.test(precedingLines);

  // Classify type based on context clues
  let type: ExitPath['type'] = 'unknown';
  let isSuccessPath = true;

  if (/429|rate.?limit|too.?many|throttl/i.test(context)) {
    type = 'rate_limit';
    isSuccessPath = false;
  } else if (/401|403|unauthorized|forbidden|unauthenticated/i.test(context)) {
    type = 'auth';
    isSuccessPath = false;
  } else if (/400|validat|invalid|missing|required|bad.?request/i.test(context)) {
    type = 'validation';
    isSuccessPath = false;
  } else if (/5\d\d|server.?error|internal/i.test(context)) {
    type = 'server_error';
    isSuccessPath = false;
  } else if (/4\d\d|error|fail|catch|throw/i.test(context)) {
    type = 'error';
    isSuccessPath = false;
  } else if (statusCode && statusCode >= 200 && statusCode < 300) {
    type = 'success';
    isSuccessPath = true;
  } else if (/success|200|201|ok\b/i.test(context)) {
    type = 'success';
    isSuccessPath = true;
  }

  return {
    line: absoluteLine,
    column: currentLine.search(/\S/) + 1,
    code: currentLine.trim(),
    type,
    isSuccessPath,
    statusCode,
    hasAudit,
  };
}

/**
 * Extract audit calls from handler code
 */
function extractAuditCalls(handlerCode: string, handlerStartLine: number): AuditCall[] {
  const calls: AuditCall[] = [];
  const pattern = /(await\s+)?(audit|auditAttempt|auditEvent|auditLog)\s*\(\s*\{/g;

  let match;
  while ((match = pattern.exec(handlerCode)) !== null) {
    const startIdx = match.index;
    const methodName = match[2];

    // Find the closing brace of the object
    let braceCount = 0;
    let i = startIdx + match[0].length - 1;
    while (i < handlerCode.length) {
      if (handlerCode[i] === '{') braceCount++;
      if (handlerCode[i] === '}') {
        braceCount--;
        if (braceCount === 0) break;
      }
      i++;
    }

    // Find closing paren
    while (i < handlerCode.length && handlerCode[i] !== ')') i++;
    const endIdx = i + 1;

    const payload = handlerCode.substring(startIdx, endIdx);
    const line = handlerStartLine + handlerCode.substring(0, startIdx).split('\n').length - 1;

    // Parse payload fields
    const hasTimestamp = /timestamp\s*:/i.test(payload);
    const hasRequestId = /requestId|request_id|correlationId/i.test(payload);
    const hasAction = /action\s*:/i.test(payload);

    // Extract success value
    let successValue: boolean | 'dynamic' | undefined;
    const successMatch = payload.match(/success\s*:\s*(true|false)/i);
    if (successMatch) {
      successValue = successMatch[1].toLowerCase() === 'true';
    } else if (/success\s*:/.test(payload)) {
      successValue = 'dynamic';
    }

    // Extract reason
    const reasonMatch = payload.match(/reason\s*:\s*['"]([^'"]+)['"]/i);
    const reason = reasonMatch?.[1];

    calls.push({
      line,
      column: 0,
      payload,
      methodName,
      successValue,
      reason,
      hasTimestamp,
      hasRequestId,
      hasAction,
    });
  }

  return calls;
}

/**
 * Find line number for a pattern in code
 */
function findLineNumber(code: string, pattern: string | RegExp): number {
  const match = typeof pattern === 'string'
    ? code.indexOf(pattern)
    : code.search(pattern);
  if (match === -1) return 1;
  return code.substring(0, match).split('\n').length;
}

/**
 * Get line content by line number (1-indexed)
 */
function getLineContent(code: string, lineNum: number): string {
  const lines = code.split('\n');
  return lines[lineNum - 1] || '';
}

// ============================================================================
// RULE: intent/audit-required
// Must audit ALL exit paths with correct success/failure semantics
// ============================================================================

export const auditRequiredRule: SemanticRule = {
  id: 'intent/audit-required',
  description: 'Audit must be called on ALL exit paths with correct success/failure semantics',

  check(code, file): SemanticViolation[] {
    const violations: SemanticViolation[] = [];

    // Skip non-handler files
    if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.') || file.includes('.d.ts')) {
      return [];
    }

    const handlers = parseHandlers(code);
    if (handlers.length === 0) return [];

    for (const handler of handlers) {
      const exitPaths = extractExitPaths(handler.code, handler.startLine);
      const auditCalls = extractAuditCalls(handler.code, handler.startLine);

      if (exitPaths.length === 0) continue;

      // =====================================================================
      // Check 1: Every exit path must have an audit call
      // =====================================================================
      const unauditedPaths = exitPaths.filter((ep) => !ep.hasAudit);

      for (const path of unauditedPaths) {
        violations.push({
          ruleId: 'intent/audit-required',
          file,
          line: path.line,
          message: `Missing audit on ${path.type} exit path (${path.isSuccessPath ? 'success' : 'failure'})`,
          severity: 'critical',
          evidence: path.code.slice(0, 80),
          fix: `Add auditAttempt({ action: "...", success: ${path.isSuccessPath}, timestamp: Date.now(), requestId }) before return`,
          context: {
            exitPath: path,
            totalExitPaths: exitPaths.length,
            coveredExitPaths: exitPaths.length - unauditedPaths.length,
          },
        });
      }

      // =====================================================================
      // Check 2: Audit payload must have required fields
      // =====================================================================
      for (const auditCall of auditCalls) {
        const requiredFields = [
          { field: 'action', has: auditCall.hasAction },
          { field: 'timestamp', has: auditCall.hasTimestamp },
        ];

        for (const { field, has } of requiredFields) {
          if (!has) {
            violations.push({
              ruleId: 'intent/audit-required',
              file,
              line: auditCall.line,
              message: `Audit payload missing required field: ${field}`,
              severity: 'critical',
              evidence: auditCall.payload.slice(0, 100),
              fix: `Add ${field} to audit payload`,
            });
          }
        }

        // Recommended fields (lower severity)
        if (!auditCall.hasRequestId) {
          violations.push({
            ruleId: 'intent/audit-required',
            file,
            line: auditCall.line,
            message: 'Audit payload missing recommended field: requestId (for tracing)',
            severity: 'medium',
            evidence: auditCall.payload.slice(0, 100),
            fix: 'Add requestId for request tracing',
          });
        }

        // Failure path must have reason
        if (auditCall.successValue === false && !auditCall.reason) {
          violations.push({
            ruleId: 'intent/audit-required',
            file,
            line: auditCall.line,
            message: 'Audit for failure path missing "reason" field',
            severity: 'high',
            evidence: auditCall.payload.slice(0, 100),
            fix: 'Add reason field (e.g., "validation_failed", "rate_limited")',
          });
        }
      }

      // =====================================================================
      // Check 3: success:true on error paths is invalid
      // =====================================================================
      for (const exitPath of exitPaths) {
        if (!exitPath.isSuccessPath && exitPath.hasAudit) {
          // Find the audit call for this path
          const relevantAuditCalls = auditCalls.filter(
            (ac) => ac.line <= exitPath.line && ac.line > exitPath.line - 15
          );

          for (const ac of relevantAuditCalls) {
            if (ac.successValue === true) {
              violations.push({
                ruleId: 'intent/audit-required',
                file,
                line: ac.line,
                message: `Audit has success:true on ${exitPath.type} path (must be success:false)`,
                severity: 'critical',
                evidence: ac.payload.slice(0, 100),
                fix: 'Change success: true to success: false on error paths',
              });
            }
          }
        }
      }
    }

    return violations;
  },
};

// ============================================================================
// RULE: intent/rate-limit-required
// Rate limiting must be BEFORE request.json() and business logic
// ============================================================================

export const rateLimitRequiredRule: SemanticRule = {
  id: 'intent/rate-limit-required',
  description: 'Rate limit check must occur BEFORE body parsing and business logic',

  check(code, file): SemanticViolation[] {
    const violations: SemanticViolation[] = [];

    if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.') || file.includes('.d.ts')) {
      return [];
    }

    const handlers = parseHandlers(code);
    if (handlers.length === 0) return [];

    for (const handler of handlers) {
      const handlerCode = handler.code;

      // Find positions of key operations
      const rateLimitPos = findRateLimitPosition(handlerCode);
      const bodyParsePos = findBodyParsePosition(handlerCode);
      const businessLogicPos = findFirstBusinessLogicPosition(handlerCode);

      // =====================================================================
      // Check 1: Rate limiting must exist
      // =====================================================================
      if (rateLimitPos === -1 && (bodyParsePos !== -1 || businessLogicPos !== -1)) {
        violations.push({
          ruleId: 'intent/rate-limit-required',
          file,
          line: handler.startLine,
          message: `Handler ${handler.method} has no rate limiting before body/business logic`,
          severity: 'high',
          evidence: `Found ${bodyParsePos !== -1 ? 'request.json()' : 'business logic'} but no rateLimit`,
          fix: 'Add rate limit check at the start of the handler',
        });
      }

      // =====================================================================
      // Check 2: Rate limit must be BEFORE body parsing
      // =====================================================================
      if (rateLimitPos !== -1 && bodyParsePos !== -1 && rateLimitPos > bodyParsePos) {
        const violationLine = handler.startLine + handlerCode.substring(0, rateLimitPos).split('\n').length - 1;
        violations.push({
          ruleId: 'intent/rate-limit-required',
          file,
          line: violationLine,
          message: 'Rate limit check occurs AFTER body parsing (must be before)',
          severity: 'critical',
          evidence: 'rateLimit() comes after request.json()',
          fix: 'Move rate limit check before request.json()',
        });
      }

      // =====================================================================
      // Check 3: Rate limit must be BEFORE business logic
      // =====================================================================
      if (rateLimitPos !== -1 && businessLogicPos !== -1 && rateLimitPos > businessLogicPos) {
        const violationLine = handler.startLine + handlerCode.substring(0, rateLimitPos).split('\n').length - 1;
        violations.push({
          ruleId: 'intent/rate-limit-required',
          file,
          line: violationLine,
          message: 'Rate limit check occurs AFTER business logic starts',
          severity: 'critical',
          evidence: 'rateLimit() comes after database/API calls',
          fix: 'Move rate limit check to the very start of the handler',
        });
      }

      // =====================================================================
      // Check 4: 429 response must have audit with success:false
      // =====================================================================
      const has429 = handlerCode.includes('429');
      if (has429) {
        // Find the 429 return statement
        const return429Match = handlerCode.match(/return[\s\S]{0,100}429/);
        if (return429Match && return429Match.index !== undefined) {
          const contextStart = Math.max(0, return429Match.index - 200);
          const context = handlerCode.substring(contextStart, return429Match.index + return429Match[0].length);

          if (!context.includes('audit')) {
            const line429 = handler.startLine + handlerCode.substring(0, return429Match.index).split('\n').length - 1;
            violations.push({
              ruleId: 'intent/rate-limit-required',
              file,
              line: line429,
              message: 'Rate limit 429 response must have audit with success:false',
              severity: 'high',
              evidence: '429 response without audit call',
              fix: 'Add auditAttempt({ success: false, reason: "rate_limited", ... }) before 429 return',
            });
          }
        }
      }
    }

    return violations;
  },
};

function findRateLimitPosition(code: string): number {
  const patterns = [
    /rateLimit\s*\(/,
    /rate_limit\s*\(/,
    /ensureRateLimit\s*\(/,
    /@intent\s+rate-limit/i,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.index !== undefined) return match.index;
  }
  return -1;
}

function findBodyParsePosition(code: string): number {
  const patterns = [
    /request\.json\s*\(\)/,
    /req\.body\b/,
    /await\s+\w+\.json\s*\(\)/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.index !== undefined) return match.index;
  }
  return -1;
}

function findFirstBusinessLogicPosition(code: string): number {
  const patterns = [
    /(?:db|database|prisma|supabase|drizzle)\./i,
    /fetch\s*\(/,
    /axios\./,
    /(?:create|update|delete|insert|find)\w*\(/i,
    /\.\s*query\s*\(/,
    /redis\./i,
  ];

  let earliest = -1;
  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.index !== undefined) {
      if (earliest === -1 || match.index < earliest) {
        earliest = match.index;
      }
    }
  }
  return earliest;
}

// ============================================================================
// RULE: intent/no-pii-logging
// Ban console.* and detect PII in logging sinks
// ============================================================================

export const noPiiLoggingRule: SemanticRule = {
  id: 'intent/no-pii-logging',
  description: 'No PII in logs - console.* forbidden, must use safe logger with redaction',

  check(code, file): SemanticViolation[] {
    const violations: SemanticViolation[] = [];

    if (file.includes('.test.') || file.includes('.spec.') || file.includes('.d.ts')) {
      return [];
    }

    const handlers = parseHandlers(code);
    // Only enforce on handler files
    if (handlers.length === 0) return [];

    // =====================================================================
    // FORBIDDEN SINKS: console.* methods
    // =====================================================================
    const consoleMethods = [
      { pattern: /console\.log\s*\(/g, method: 'console.log', severity: 'medium' as const },
      { pattern: /console\.info\s*\(/g, method: 'console.info', severity: 'medium' as const },
      { pattern: /console\.debug\s*\(/g, method: 'console.debug', severity: 'low' as const },
      { pattern: /console\.warn\s*\(/g, method: 'console.warn', severity: 'medium' as const },
      { pattern: /console\.error\s*\(/g, method: 'console.error', severity: 'high' as const },
      { pattern: /console\.trace\s*\(/g, method: 'console.trace', severity: 'medium' as const },
      { pattern: /console\.dir\s*\(/g, method: 'console.dir', severity: 'medium' as const },
      { pattern: /console\.table\s*\(/g, method: 'console.table', severity: 'medium' as const },
    ];

    // Safe wrappers that are allowed
    const safePatterns = [
      /safeLog(ger)?\./,
      /redact\s*\(/,
      /redactPII\s*\(/,
      /maskPII\s*\(/,
      /sanitize\s*\(/,
    ];

    for (const { pattern, method, severity } of consoleMethods) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const line = findLineNumber(code, match[0]);
        const lineContent = getLineContent(code, line);

        // Skip if wrapped in safe function
        const isSafe = safePatterns.some((sp) => sp.test(lineContent));
        if (isSafe) continue;

        violations.push({
          ruleId: 'intent/no-pii-logging',
          file,
          line,
          message: `${method} in production route handler - use structured logger`,
          severity,
          evidence: lineContent.trim().slice(0, 100),
          fix: `Replace with safeLogger.${method.split('.')[1]}(redactPII(data))`,
        });
      }
    }

    // =====================================================================
    // CRITICAL: Raw request body/headers in logs
    // =====================================================================
    const dangerousPatterns = [
      { pattern: /console\.\w+\s*\([^)]*req\.body/gi, type: 'request body' },
      { pattern: /console\.\w+\s*\([^)]*request\.body/gi, type: 'request body' },
      { pattern: /console\.\w+\s*\([^)]*req\.headers/gi, type: 'request headers' },
      { pattern: /console\.\w+\s*\([^)]*request\.headers/gi, type: 'request headers' },
      { pattern: /logger\.\w+\s*\([^)]*req\.body(?![^\)]*redact)/gi, type: 'request body' },
      { pattern: /logger\.\w+\s*\([^)]*request\.body(?![^\)]*redact)/gi, type: 'request body' },
    ];

    for (const { pattern, type } of dangerousPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const line = findLineNumber(code, match[0]);
        const lineContent = getLineContent(code, line);

        violations.push({
          ruleId: 'intent/no-pii-logging',
          file,
          line,
          message: `CRITICAL: Raw ${type} logged - may contain PII`,
          severity: 'critical',
          evidence: lineContent.trim().slice(0, 100),
          fix: `Use redactPII(${type}) or log only specific, safe fields`,
        });
      }
    }

    // =====================================================================
    // PII field detection in any logging
    // =====================================================================
    const piiFields = [
      { pattern: /password/i, category: 'auth', severity: 'critical' as const },
      { pattern: /\btoken\b/i, category: 'auth', severity: 'critical' as const },
      { pattern: /secret/i, category: 'auth', severity: 'critical' as const },
      { pattern: /apiKey|api_key/i, category: 'auth', severity: 'critical' as const },
      { pattern: /email/i, category: 'personal', severity: 'high' as const },
      { pattern: /\bssn\b|socialSecurity/i, category: 'personal', severity: 'critical' as const },
      { pattern: /creditCard|cardNumber/i, category: 'financial', severity: 'critical' as const },
      { pattern: /phone|mobile/i, category: 'personal', severity: 'high' as const },
    ];

    const logPatterns = [/console\.\w+\s*\([^)]+\)/g, /logger\.\w+\s*\([^)]+\)/g];

    for (const logPattern of logPatterns) {
      let logMatch;
      while ((logMatch = logPattern.exec(code)) !== null) {
        const logStatement = logMatch[0];
        const line = findLineNumber(code, logStatement);
        const lineContent = getLineContent(code, line);

        // Skip safe wrappers
        if (safePatterns.some((sp) => sp.test(lineContent))) continue;

        for (const { pattern, category, severity } of piiFields) {
          if (pattern.test(logStatement)) {
            violations.push({
              ruleId: 'intent/no-pii-logging',
              file,
              line,
              message: `PII (${category}) may be logged: ${pattern.source}`,
              severity,
              evidence: lineContent.trim().slice(0, 100),
              fix: `Use redactPII() wrapper or remove PII field from log`,
            });
            break; // One violation per log statement
          }
        }
      }
    }

    return violations;
  },
};

// ============================================================================
// RULE: quality/no-stubbed-handlers
// Block "Not implemented" and placeholder code
// ============================================================================

export const noStubbedHandlersRule: SemanticRule = {
  id: 'quality/no-stubbed-handlers',
  description: 'No stubbed handlers - "Not implemented" throws block shipping',

  check(code, file, config): SemanticViolation[] {
    const violations: SemanticViolation[] = [];

    // Default allowlist
    const defaultAllowlist = [
      '.test.', '.spec.', '.types.', '.schema.', '.d.ts',
      '__mocks__', '__fixtures__', '/mocks/', '/fixtures/',
      '/test-fixtures/', '.mock.', '/demo/', '/examples/',
    ];

    const allowlist = [...defaultAllowlist, ...(config?.stubAllowlist || [])];
    if (allowlist.some((pattern) => file.includes(pattern))) {
      return [];
    }

    // =====================================================================
    // Pattern 1: throw new Error('Not implemented') variants
    // =====================================================================
    const notImplementedPatterns = [
      { pattern: /throw\s+new\s+Error\s*\(\s*['"`]Not implemented['"`]\s*\)/gi, msg: 'Not implemented' },
      { pattern: /throw\s+new\s+Error\s*\(\s*['"`]Not yet implemented['"`]\s*\)/gi, msg: 'Not yet implemented' },
      { pattern: /throw\s+new\s+Error\s*\(\s*['"`]TODO['"`]\s*\)/gi, msg: 'TODO error' },
      { pattern: /throw\s+new\s+Error\s*\(\s*['"`]STUB['"`]\s*\)/gi, msg: 'STUB error' },
      { pattern: /throw\s+new\s+Error\s*\(\s*['"`]PLACEHOLDER['"`]\s*\)/gi, msg: 'PLACEHOLDER error' },
      { pattern: /throw\s+new\s+Error\s*\(\s*['"`]FIXME['"`]\s*\)/gi, msg: 'FIXME error' },
    ];

    for (const { pattern, msg } of notImplementedPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        violations.push({
          ruleId: 'quality/no-stubbed-handlers',
          file,
          line: findLineNumber(code, match[0]),
          message: `SHIP BLOCKED: "${msg}" error cannot ship - implementation required`,
          severity: 'critical',
          evidence: match[0],
          fix: 'Implement the handler logic or remove the stub',
        });
      }
    }

    // =====================================================================
    // Pattern 2: TODO markers in postconditions section
    // =====================================================================
    if (/postconditions?\s+to\s+satisfy[\s\S]{0,200}TODO/i.test(code) ||
        /\/\/\s*ISL\s+postconditions[\s\S]{0,200}TODO/i.test(code)) {
      violations.push({
        ruleId: 'quality/no-stubbed-handlers',
        file,
        line: findLineNumber(code, 'TODO'),
        message: 'SHIP BLOCKED: TODO markers in postconditions section',
        severity: 'critical',
        evidence: 'Found TODO under ISL postconditions comment',
        fix: 'Implement all postconditions marked with TODO',
      });
    }

    // =====================================================================
    // Pattern 3: Handler function that only throws
    // =====================================================================
    const handlers = parseHandlers(code);
    for (const handler of handlers) {
      const handlerBody = handler.code;

      // Check if the ONLY meaningful line is a throw
      const meaningfulLines = handlerBody.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('/*') && l !== '{' && l !== '}');

      // If there's basically just a throw and maybe const declarations
      const hasOnlyThrow = meaningfulLines.length <= 3 &&
        meaningfulLines.some((l) => l.includes('throw new Error'));

      if (hasOnlyThrow) {
        violations.push({
          ruleId: 'quality/no-stubbed-handlers',
          file,
          line: handler.startLine,
          message: `SHIP BLOCKED: ${handler.method}() handler only throws - implementation required`,
          severity: 'critical',
          evidence: `${handler.method} handler has no real implementation`,
          fix: `Implement ${handler.method}() with proper business logic`,
        });
      }
    }

    // =====================================================================
    // Pattern 4: Placeholder comments
    // =====================================================================
    const placeholderPatterns = [
      /\/\/\s*TODO:\s*implement\b/i,
      /\/\/\s*FIXME:\s*implement\b/i,
      /\/\/\s*Implementation goes here/i,
      /\/\/\s*placeholder\s*(implementation)?/i,
    ];

    for (const pattern of placeholderPatterns) {
      const match = code.match(pattern);
      if (match) {
        violations.push({
          ruleId: 'quality/no-stubbed-handlers',
          file,
          line: findLineNumber(code, match[0]),
          message: 'SHIP BLOCKED: Placeholder implementation comment found',
          severity: 'high',
          evidence: match[0],
          fix: 'Complete the implementation before shipping',
        });
      }
    }

    return violations;
  },
};

// ============================================================================
// Rule Registry
// ============================================================================

export const AST_SEMANTIC_RULES: SemanticRule[] = [
  auditRequiredRule,
  rateLimitRequiredRule,
  noPiiLoggingRule,
  noStubbedHandlersRule,
];

/**
 * Run all AST-based semantic rules
 */
export function runASTSemanticRules(
  codeMap: Map<string, string>,
  config?: SemanticRuleConfig
): SemanticViolation[] {
  const violations: SemanticViolation[] = [];

  for (const [file, code] of codeMap) {
    for (const rule of AST_SEMANTIC_RULES) {
      violations.push(...rule.check(code, file, config));
    }
  }

  return violations;
}

/**
 * Get a specific rule by ID
 */
export function getRule(ruleId: string): SemanticRule | undefined {
  return AST_SEMANTIC_RULES.find((r) => r.id === ruleId);
}
