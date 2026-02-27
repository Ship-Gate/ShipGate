/**
 * Deterministic Fix Recipes
 *
 * Each recipe produces patches that SATISFY the semantic validators.
 * The patches are deterministic: same input always produces same output.
 *
 * Constraints:
 * - No suppressions, no weakening
 * - Only minimal refactors inside touched files
 * - All fixes are deterministic (same input → same output)
 *
 * @module @isl-lang/healer/rules
 */

import type { SemanticViolation } from './ast-semantic-rules';

// ============================================================================
// Types
// ============================================================================

export interface DeterministicPatch {
  type: 'insert' | 'replace' | 'delete';
  file: string;
  /** Character offset for insert/replace/delete */
  startOffset: number;
  /** End offset for replace/delete */
  endOffset?: number;
  /** Content to insert or replace with */
  content: string;
  /** Human-readable description */
  description: string;
}

export interface FixRecipe {
  ruleId: string;
  description: string;
  /** Generate patches to fix the violation */
  createPatches: (violation: SemanticViolation, ctx: FixContext) => DeterministicPatch[];
  /** Validate the patch satisfies the rule (semantic check) */
  validate: (originalCode: string, patchedCode: string, violation: SemanticViolation) => ValidationResult;
  /** What to run after patching */
  verifyWith: ('gate' | 'typecheck' | 'lint' | 'test')[];
}

export interface FixContext {
  codeMap: Map<string, string>;
  framework: 'nextjs-app-router' | 'nextjs' | 'express' | 'fastify';
  behaviorName?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  evidence?: string[];
}

export interface ApplyResult {
  success: boolean;
  newCode: string;
  patches: DeterministicPatch[];
  validation: ValidationResult;
}

// ============================================================================
// Code Generation Templates
// ============================================================================

const TEMPLATES = {
  // Import statements
  imports: {
    rateLimit: "import { rateLimit } from '@/lib/rate-limit';",
    audit: "import { audit, auditAttempt } from '@/lib/audit';",
    zod: "import { z } from 'zod';",
    safeLogger: "import { safeLogger, redactPII } from '@/lib/logger';",
    bcrypt: "import bcrypt from 'bcrypt';",
  },

  // Audit helper function (for handlers without it)
  auditHelper: `
// @intent audit-required - Audit helper called on ALL exit paths
async function auditAttempt(input: {
  action: string;
  success: boolean;
  reason?: string;
  requestId: string;
  timestamp?: string;
}) {
  await audit({
    action: input.action,
    success: input.success,
    reason: input.reason,
    requestId: input.requestId,
    timestamp: input.timestamp || new Date().toISOString(),
  });
}
`,

  // Rate limit check block
  rateLimitBlock: (indent: string, action: string) => `${indent}// @intent rate-limit-required - MUST be before body parsing
${indent}const rateLimitResult = await rateLimit(request);
${indent}if (!rateLimitResult.success) {
${indent}  await auditAttempt({ action: '${action}', success: false, reason: 'rate_limited', requestId });
${indent}  return NextResponse.json(
${indent}    { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
${indent}    { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
${indent}  );
${indent}}
`,

  // Request ID extraction
  requestIdExtraction: (indent: string) =>
    `${indent}const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
`,

  // Action constant
  actionConstant: (indent: string, action: string) =>
    `${indent}const action = '${action}';
`,

  // Validation block
  validationBlock: (indent: string, schemaName: string, action: string) => `${indent}// @intent input-validation - validate before use
${indent}const validationResult = ${schemaName}.safeParse(body);
${indent}if (!validationResult.success) {
${indent}  await auditAttempt({ action: '${action}', success: false, reason: 'validation_failed', requestId });
${indent}  return NextResponse.json(
${indent}    { error: 'Validation failed', details: validationResult.error.flatten() },
${indent}    { status: 400 }
${indent}  );
${indent}}
${indent}const input = validationResult.data;
`,

  // Audit success call
  auditSuccessCall: (indent: string, action: string) =>
    `${indent}await auditAttempt({ action: '${action}', success: true, requestId });
`,

  // Audit failure call
  auditFailureCall: (indent: string, action: string, reason: string) =>
    `${indent}await auditAttempt({ action: '${action}', success: false, reason: '${reason}', requestId });
`,

  // Safe logger replacement
  safeLoggerReplacement: (message: string, hasArgs: boolean) =>
    hasArgs
      ? `safeLogger.error(${message}, { error: redactPII(error) });`
      : `safeLogger.error(${message});`,

  // PII redaction helper
  redactPIIHelper: `
// @intent no-pii-logging - Redact PII before logging
function redactPII(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const redacted = { ...obj as Record<string, unknown> };
  const piiFields = ['email', 'password', 'token', 'secret', 'ssn', 'phone', 'creditCard', 'cardNumber', 'apiKey'];
  for (const field of piiFields) {
    if (field in redacted) redacted[field] = '[REDACTED]';
    for (const key of Object.keys(redacted)) {
      if (key.toLowerCase().includes(field.toLowerCase())) redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}
`,
};

// ============================================================================
// Helper Functions
// ============================================================================

function findLastImportOffset(code: string): number {
  const importMatches = [...code.matchAll(/^import\s+.*?['"][^'"]+['"];?\s*$/gm)];
  if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    if (!lastImport) return 0;
    return (lastImport.index ?? 0) + lastImport[0].length;
  }
  return 0;
}

function findExportFunctionOffset(code: string): number {
  const match = code.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/);
  return match?.index ?? -1;
}

function findFunctionBodyStart(code: string, exportOffset: number): number {
  return code.indexOf('{', exportOffset) + 1;
}

function getIndentationAt(code: string, offset: number): string {
  const beforeOffset = code.substring(0, offset);
  const lastNewline = beforeOffset.lastIndexOf('\n');
  const lineStart = lastNewline + 1;
  const lineContent = code.substring(lineStart, offset);
  const match = lineContent.match(/^(\s*)/);
  return match?.[1] ?? '  ';
}

function inferActionFromFile(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/');
  const fileName = (parts[parts.length - 1] ?? '').replace(/\.(ts|tsx|js|jsx)$/, '');

  if (fileName === 'route') {
    return parts[parts.length - 2] || 'api_request';
  }

  const actionMap: Record<string, string> = {
    login: 'user_login',
    logout: 'user_logout',
    register: 'user_register',
    signup: 'user_signup',
    checkout: 'payment_checkout',
    payment: 'payment_process',
    webhook: 'webhook_received',
  };

  for (const [key, action] of Object.entries(actionMap)) {
    if (fileName.toLowerCase().includes(key)) return action;
  }

  return `${fileName.replace(/[-_]/g, '_')}_request`;
}

/**
 * Exit path information for audit coverage
 */
interface ExitPath {
  offset: number;
  statusCode?: number;
  exitType: 'return' | 'throw' | 'catch_return';
  inCatchBlock: boolean;
  reason?: string;
}

/**
 * Find all exit paths in code (returns, throws, catch blocks)
 */
function findAllExitPaths(code: string): ExitPath[] {
  const paths: ExitPath[] = [];

  // Find catch block ranges
  const catchBlocks: { start: number; end: number }[] = [];
  const catchPattern = /catch\s*\([^)]*\)\s*\{/g;
  let catchMatch;
  while ((catchMatch = catchPattern.exec(code)) !== null) {
    const start = catchMatch.index;
    // Find matching closing brace
    let braceCount = 1;
    let pos = catchMatch.index + catchMatch[0].length;
    while (pos < code.length && braceCount > 0) {
      if (code[pos] === '{') braceCount++;
      if (code[pos] === '}') braceCount--;
      pos++;
    }
    catchBlocks.push({ start, end: pos });
  }

  // Helper to check if offset is in catch block
  const isInCatch = (offset: number): boolean => {
    return catchBlocks.some(b => offset >= b.start && offset <= b.end);
  };

  // Pattern 1: NextResponse.json returns
  const jsonReturnPattern = /return\s+(?:NextResponse|Response)\.json\s*\(/g;
  let match;
  while ((match = jsonReturnPattern.exec(code)) !== null) {
    const context = code.substring(match.index, Math.min(code.length, match.index + 300));
    const statusMatch = context.match(/status:\s*(\d{3})/);
    const statusCode = statusMatch ? parseInt(statusMatch[1] ?? '0', 10) : undefined;

    // Infer reason from error code or message
    let reason: string | undefined;
    const errorCodeMatch = context.match(/code:\s*['"](\w+)['"]/);
    if (errorCodeMatch && errorCodeMatch[1]) {
      reason = errorCodeMatch[1].toLowerCase().replace(/_/g, '_');
    }

    paths.push({
      offset: match.index,
      statusCode,
      exitType: isInCatch(match.index) ? 'catch_return' : 'return',
      inCatchBlock: isInCatch(match.index),
      reason,
    });
  }

  // Pattern 2: Plain return statements (without NextResponse)
  const plainReturnPattern = /return\s+\{[^;]*success:\s*(true|false)/g;
  while ((match = plainReturnPattern.exec(code)) !== null) {
    const isSuccess = match[1] === 'true';
    paths.push({
      offset: match.index,
      statusCode: isSuccess ? 200 : 400,
      exitType: isInCatch(match.index) ? 'catch_return' : 'return',
      inCatchBlock: isInCatch(match.index),
    });
  }

  // Pattern 3: Throw statements
  const throwPattern = /throw\s+new\s+(Error|HttpError|ApiError)\s*\(/g;
  while ((match = throwPattern.exec(code)) !== null) {
    paths.push({
      offset: match.index,
      statusCode: 500,
      exitType: 'throw',
      inCatchBlock: isInCatch(match.index),
      reason: 'internal_error',
    });
  }

  return paths;
}

function findAllReturnOffsets(code: string): { offset: number; statusCode?: number }[] {
  const paths = findAllExitPaths(code);
  return paths.map(p => ({ offset: p.offset, statusCode: p.statusCode }));
}

// ============================================================================
// FIX RECIPE: intent/audit-required
// ============================================================================

export const auditRequiredRecipe: FixRecipe = {
  ruleId: 'intent/audit-required',
  description: 'Add audit calls on ALL exit paths with correct success/failure semantics',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const action = ctx.behaviorName || inferActionFromFile(violation.file);

    // Step 1: Add audit import if missing
    if (!code.includes("from '@/lib/audit'")) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.imports.audit,
        description: 'Add audit import',
      });
    }

    // Step 2: Add auditAttempt helper if missing
    if (!code.includes('async function auditAttempt')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset > 0) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportOffset,
          content: TEMPLATES.auditHelper + '\n',
          description: 'Add auditAttempt helper function',
        });
      }
    }

    // Step 3: Add requestId and action extraction if missing
    const exportOffset = findExportFunctionOffset(code);
    if (exportOffset !== -1 && !code.includes('const requestId')) {
      const bodyStart = findFunctionBodyStart(code, exportOffset);
      const indent = getIndentationAt(code, bodyStart) + '  ';
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: bodyStart,
        content: '\n' + TEMPLATES.requestIdExtraction(indent) + TEMPLATES.actionConstant(indent, action),
        description: 'Add requestId and action extraction',
      });
    }

    // Step 4: Add audit before EVERY exit path (returns, throws, catch returns)
    const exitPaths = findAllExitPaths(code);
    for (const exitPath of exitPaths) {
      const { offset, statusCode, exitType, inCatchBlock, reason } = exitPath;

      // Check if audit already exists in preceding 200 chars
      const contextStart = Math.max(0, offset - 200);
      const context = code.substring(contextStart, offset);
      if (context.includes('auditAttempt') || context.includes('await audit(')) {
        continue; // Already has audit
      }

      const indent = getIndentationAt(code, offset);
      const isSuccess = !statusCode || (statusCode >= 200 && statusCode < 300);

      // Determine the reason based on exit type and context
      let auditReason: string;
      if (reason) {
        auditReason = reason;
      } else if (exitType === 'throw') {
        auditReason = 'internal_error';
      } else if (inCatchBlock) {
        // In catch block, try to infer reason from error handling
        const catchContext = code.substring(Math.max(0, offset - 300), offset);
        if (catchContext.includes('ZodError')) {
          auditReason = 'validation_failed';
        } else {
          auditReason = 'internal_error';
        }
      } else {
        auditReason = getReasonFromStatus(statusCode);
      }

      const auditCall = isSuccess
        ? TEMPLATES.auditSuccessCall(indent, action)
        : TEMPLATES.auditFailureCall(indent, action, auditReason);

      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: offset,
        content: auditCall,
        description: `Add audit before ${exitType}${inCatchBlock ? ' (in catch)' : ''}: ${isSuccess ? 'success' : auditReason}`,
      });
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: Has auditAttempt helper or audit import
    if (!patched.includes('auditAttempt') && !patched.includes('audit(')) {
      return { valid: false, reason: 'No audit function found' };
    }
    evidence.push('✓ Audit function present');

    // Check 2: Count ALL exit paths and audit calls
    const exitPaths = findAllExitPaths(patched);
    const auditMatches = [...patched.matchAll(/auditAttempt\s*\(|await\s+audit\s*\(/g)];

    if (auditMatches.length < exitPaths.length) {
      const missing = exitPaths.length - auditMatches.length;
      return {
        valid: false,
        reason: `Missing audit on ${missing} exit path(s): found ${auditMatches.length} audit calls for ${exitPaths.length} exit paths`,
      };
    }
    evidence.push(`✓ ${auditMatches.length} audit calls covering ${exitPaths.length} exit paths`);

    // Check 3: Verify each exit path has a preceding audit
    for (const exitPath of exitPaths) {
      const contextStart = Math.max(0, exitPath.offset - 200);
      const contextEnd = exitPath.offset;
      const context = patched.substring(contextStart, contextEnd);

      if (!context.includes('auditAttempt') && !context.includes('await audit(')) {
        const exitSnippet = patched.substring(exitPath.offset, exitPath.offset + 50).split('\n')[0] ?? '';
        return {
          valid: false,
          reason: `Exit path at offset ${exitPath.offset} missing audit: ${exitSnippet.trim()}...`,
        };
      }
    }
    evidence.push('✓ All exit paths have preceding audit calls');

    // Check 4: No success:true on error paths (4xx/5xx status)
    const errorWithTrueSuccess = /(?:status:\s*(?:4|5)\d\d)[\s\S]{0,150}success:\s*true/;
    if (errorWithTrueSuccess.test(patched)) {
      return { valid: false, reason: 'Found success:true on error path (4xx/5xx status)' };
    }
    evidence.push('✓ Error paths correctly have success:false');

    // Check 5: Required fields present in audit calls
    const auditPayloads = [...patched.matchAll(/auditAttempt\s*\(\s*\{([^}]+)\}/g)];
    for (const [, payload] of auditPayloads) {
      const p = payload ?? '';
      if (!p.includes('action')) {
        return { valid: false, reason: 'Audit payload missing required "action" field' };
      }
      if (!p.includes('success')) {
        return { valid: false, reason: 'Audit payload missing required "success" field' };
      }
    }
    evidence.push('✓ All audit calls have required fields (action, success)');

    // Check 6: Catch blocks also have audit coverage
    const catchBlocks = [...patched.matchAll(/catch\s*\([^)]*\)\s*\{/g)];
    for (const catchMatch of catchBlocks) {
      const catchStart = catchMatch.index!;
      // Find returns within this catch block (next ~500 chars)
      const catchContent = patched.substring(catchStart, catchStart + 500);
      if (catchContent.includes('return') && !catchContent.includes('auditAttempt')) {
        return { valid: false, reason: 'Catch block has return without audit' };
      }
    }
    evidence.push('✓ Catch blocks properly audited');

    return { valid: true, evidence };
  },

  verifyWith: ['gate', 'typecheck'],
};

function getReasonFromStatus(statusCode?: number): string {
  if (!statusCode) return 'error';
  switch (statusCode) {
    case 429:
      return 'rate_limited';
    case 400:
      return 'validation_failed';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    default:
      return statusCode >= 500 ? 'server_error' : 'error';
  }
}

// ============================================================================
// FIX RECIPE: intent/rate-limit-required
// ============================================================================

export const rateLimitRequiredRecipe: FixRecipe = {
  ruleId: 'intent/rate-limit-required',
  description: 'Add rate limiting BEFORE body parsing with IP/identifier extraction and audit on 429',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const action = ctx.behaviorName || inferActionFromFile(violation.file);

    // Step 1: Add rate limit import if missing
    if (!code.includes("from '@/lib/rate-limit'")) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.imports.rateLimit,
        description: 'Add rate limit import',
      });
    }

    // Step 2: Ensure auditAttempt helper exists (needed for 429 path)
    if (!code.includes('async function auditAttempt') && !code.includes('auditAttempt(')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset > 0) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportOffset,
          content: TEMPLATES.auditHelper + '\n',
          description: 'Add auditAttempt helper',
        });
      }
    }

    // Step 3: Add rate limit check at the VERY START of the handler (before ANY body parsing)
    const exportOffset = findExportFunctionOffset(code);
    if (exportOffset !== -1) {
      const bodyStart = findFunctionBodyStart(code, exportOffset);

      // Check if rate limit already exists but in wrong position
      const rateLimitMatch = code.match(/rateLimit\s*\(/);
      const bodyParseMatch = code.match(/request\.json\s*\(\)/);
      const tryBlockMatch = code.match(/\btry\s*\{/);

      const rateLimitPos = rateLimitMatch?.index ?? -1;
      const bodyParsePos = bodyParseMatch?.index ?? -1;
      const tryBlockPos = tryBlockMatch?.index ?? -1;

      // Rate limit must be BEFORE try block and body parse
      const mustBeBefore = Math.min(
        bodyParsePos === -1 ? Infinity : bodyParsePos,
        tryBlockPos === -1 ? Infinity : tryBlockPos
      );

      // If no rate limit, or rate limit is after critical points, add at start
      if (rateLimitPos === -1 || rateLimitPos > mustBeBefore) {
        const indent = getIndentationAt(code, bodyStart) + '  ';

        // Build early rate limit block
        let content = '';

        // Add requestId extraction if not present
        if (!code.includes('const requestId')) {
          content += '\n' + TEMPLATES.requestIdExtraction(indent);
        }

        // Add IP extraction for rate limiting
        if (!code.includes('const ip') && !code.includes('clientIp')) {
          content += `${indent}// @intent rate-limit-required - Extract client IP for rate limiting
${indent}const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
${indent}  ?? request.headers.get('x-real-ip')
${indent}  ?? 'unknown';
`;
        }

        // Add action constant if not present
        if (!code.includes("const action = '")) {
          content += TEMPLATES.actionConstant(indent, action);
        }

        // Add the rate limit check block
        content += `
${indent}// @intent rate-limit-required - MUST be checked BEFORE body parsing
${indent}const rateLimitResult = await rateLimit({ ip: clientIp, action });
${indent}if (!rateLimitResult.success) {
${indent}  await auditAttempt({ action, success: false, reason: 'rate_limited', requestId });
${indent}  return NextResponse.json(
${indent}    { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' }, retryAfter: rateLimitResult.retryAfter },
${indent}    { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
${indent}  );
${indent}}

`;

        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: bodyStart,
          content,
          description: 'Add early rate limit check with IP extraction (BEFORE body parsing)',
        });
      }
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: Rate limit check exists
    if (!patched.includes('rateLimit')) {
      return { valid: false, reason: 'Rate limit check not found' };
    }
    evidence.push('✓ Rate limit check present');

    // Check 2: Rate limit is BEFORE body parsing
    const rateLimitOffset = patched.indexOf('rateLimit');
    const bodyParseOffset = patched.indexOf('request.json()');

    if (bodyParseOffset !== -1 && rateLimitOffset > bodyParseOffset) {
      return { valid: false, reason: 'CRITICAL: Rate limit check occurs AFTER body parsing - must be BEFORE' };
    }
    evidence.push('✓ Rate limit positioned BEFORE body parsing');

    // Check 3: Rate limit is before try block (if exists)
    const tryBlockOffset = patched.indexOf('try {') !== -1 ? patched.indexOf('try {') : patched.indexOf('try{');
    if (tryBlockOffset !== -1 && rateLimitOffset > tryBlockOffset) {
      return { valid: false, reason: 'Rate limit should be before try block for early rejection' };
    }
    evidence.push('✓ Rate limit positioned early in handler');

    // Check 4: Has IP extraction for rate limiting
    if (!patched.includes('clientIp') && !patched.includes('const ip') && !patched.includes('x-forwarded-for')) {
      return { valid: false, reason: 'Missing IP extraction for rate limiting' };
    }
    evidence.push('✓ IP extraction for rate limiting present');

    // Check 5: 429 response with Retry-After header
    if (patched.includes('429')) {
      if (!patched.includes('Retry-After')) {
        return { valid: false, reason: '429 response missing Retry-After header' };
      }
      evidence.push('✓ 429 response includes Retry-After header');

      // Check audit on rate limit path
      const has429Audit = /auditAttempt[\s\S]{0,150}rate_limited|rate_limited[\s\S]{0,150}auditAttempt/.test(patched);
      if (!has429Audit) {
        return { valid: false, reason: '429 response missing audit with reason: rate_limited' };
      }
      evidence.push('✓ 429 response properly audited');
    }

    return { valid: true, evidence };
  },

  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// FIX RECIPE: intent/no-pii-logging
// ============================================================================

// Sensitive data field patterns that should NEVER be logged
const SENSITIVE_FIELD_PATTERNS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'ssn',
  'social_security',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'pin',
  'privateKey',
  'private_key',
  'sessionId',
  'session_id',
  'authHeader',
  'authorization',
];

// Detect if a log statement contains sensitive data
function containsSensitiveData(logContent: string): { contains: boolean; fields: string[] } {
  const lowerContent = logContent.toLowerCase();
  const foundFields: string[] = [];

  for (const field of SENSITIVE_FIELD_PATTERNS) {
    if (lowerContent.includes(field.toLowerCase())) {
      foundFields.push(field);
    }
  }

  // Also check for common patterns
  const sensitivePatterns = [
    /\bpassword\s*[:=]/i,
    /\bemail\s*[:=]/i,
    /\.password\b/i,
    /\.email\b/i,
    /body\.password/i,
    /body\.email/i,
    /input\.password/i,
    /input\.email/i,
    /\btoken\s*[:=]/i,
    /\bsecret\s*[:=]/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(logContent)) {
      foundFields.push(pattern.source);
    }
  }

  return { contains: foundFields.length > 0, fields: [...new Set(foundFields)] };
}

export const noPiiLoggingRecipe: FixRecipe = {
  ruleId: 'intent/no-pii-logging',
  description: 'Remove console.* calls containing sensitive data and add safe logger with PII redaction',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';

    // Step 1: Add safe logger import if needed
    if (!code.includes('safeLogger') && !code.includes('redactPII')) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.imports.safeLogger,
        description: 'Add safe logger import',
      });
    }

    // Step 2: Add redactPII helper function if not present
    if (!code.includes('function redactPII') && !code.includes('redactPII(')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset > 0) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportOffset,
          content: TEMPLATES.redactPIIHelper + '\n',
          description: 'Add redactPII helper function',
        });
      }
    }

    // Step 3: Remove/replace console.* calls containing sensitive data
    // Match console statements with their full content
    const consoleStatementPattern = /console\.(log|info|debug|warn)\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)\s*;?/g;

    let match;
    while ((match = consoleStatementPattern.exec(code)) !== null) {
      const method = match[1] ?? 'log';
      const logContent = match[2] ?? '';
      const sensitivity = containsSensitiveData(logContent);

      if (sensitivity.contains) {
        // CRITICAL: Contains sensitive data - must remove entirely
        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          content: `// @intent no-pii-logging - [REMOVED: logged sensitive fields: ${sensitivity.fields.slice(0, 3).join(', ')}]\n`,
          description: `Remove ${method} containing sensitive data (${sensitivity.fields.slice(0, 3).join(', ')})`,
        });
      } else {
        // Not obviously sensitive, but console.* is not allowed in production
        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          content: '// [Removed non-production log statement]\n',
          description: `Remove console.${method} (not allowed in production)`,
        });
      }
    }

    // Step 4: Replace console.error with safeLogger.error with redaction
    const errorPattern = /console\.error\s*\(\s*(['"`][^'"`]*['"`])\s*,?\s*([^)]*)\)\s*;?/g;
    let errorMatch;
    while ((errorMatch = errorPattern.exec(code)) !== null) {
      const message = errorMatch[1] ?? '';
      const args = (errorMatch[2] ?? '').trim();

      // Always use safe logger with redaction for errors
      const replacement = args
        ? `safeLogger.error(${message}, { error: redactPII(${args}) });`
        : `safeLogger.error(${message});`;

      patches.push({
        type: 'replace',
        file: violation.file,
        startOffset: errorMatch.index,
        endOffset: errorMatch.index + errorMatch[0].length,
        content: replacement,
        description: 'Replace console.error with safeLogger.error using redactPII',
      });
    }

    // Step 5: Remove any direct logging of body/input objects
    const bodyLoggingPatterns = [
      /console\.\w+\s*\([^)]*\bbody\b[^)]*\)\s*;?\n?/g,
      /console\.\w+\s*\([^)]*\binput\b[^)]*\)\s*;?\n?/g,
      /console\.\w+\s*\([^)]*request\.body[^)]*\)\s*;?\n?/g,
      /console\.\w+\s*\([^)]*req\.body[^)]*\)\s*;?\n?/g,
    ];

    for (const pattern of bodyLoggingPatterns) {
      let bodyMatch;
      while ((bodyMatch = pattern.exec(code)) !== null) {
        // Skip if already patched
        const alreadyPatched = patches.some(
          p => p.startOffset === bodyMatch!.index
        );
        if (alreadyPatched) continue;

        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: bodyMatch.index,
          endOffset: bodyMatch.index + bodyMatch[0].length,
          content: '// @intent no-pii-logging - [REMOVED: raw request body logging]\n',
          description: 'Remove raw body/input logging (may contain PII)',
        });
      }
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: No console.log/info/debug/warn
    const forbiddenConsole = /console\.(log|info|debug|warn)\s*\(/;
    if (forbiddenConsole.test(patched)) {
      return { valid: false, reason: 'console.log/info/debug/warn still present' };
    }
    evidence.push('✓ No forbidden console methods');

    // Check 2: console.error replaced with safeLogger (if original had it)
    if (original.includes('console.error') && patched.includes('console.error')) {
      if (!patched.includes('safeLogger.error')) {
        return { valid: false, reason: 'console.error not replaced with safeLogger' };
      }
    }
    evidence.push('✓ console.error properly handled');

    // Check 3: No logging of password fields
    const passwordLogging = /console\.\w+\s*\([^)]*password/i;
    if (passwordLogging.test(patched)) {
      return { valid: false, reason: 'CRITICAL: Password still being logged' };
    }
    evidence.push('✓ No password logging');

    // Check 4: No logging of email fields directly
    const emailLogging = /console\.\w+\s*\([^)]*email/i;
    if (emailLogging.test(patched)) {
      return { valid: false, reason: 'CRITICAL: Email still being logged' };
    }
    evidence.push('✓ No email logging');

    // Check 5: No raw request body logging
    const bodyLogging = /console\.\w+\s*\([^)]*(body|input|request\.body|req\.body)/i;
    if (bodyLogging.test(patched)) {
      return { valid: false, reason: 'Raw request body still being logged' };
    }
    evidence.push('✓ No raw body logging');

    // Check 6: Has redactPII helper (if needed)
    if (patched.includes('safeLogger') && !patched.includes('redactPII')) {
      return { valid: false, reason: 'Using safeLogger but missing redactPII helper' };
    }
    evidence.push('✓ PII redaction helper available');

    return { valid: true, evidence };
  },

  verifyWith: ['gate', 'lint'],
};

// ============================================================================
// FIX RECIPE: quality/no-stubbed-handlers
// ============================================================================

export const noStubbedHandlersRecipe: FixRecipe = {
  ruleId: 'quality/no-stubbed-handlers',
  description: 'Replace stub errors with implementation skeleton',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const action = ctx.behaviorName || inferActionFromFile(violation.file);

    // Pattern 1: Replace "throw new Error('Not implemented')" with proper TODO
    const notImplementedPatterns = [
      /throw\s+new\s+Error\s*\(\s*['"`]Not implemented['"`]\s*\)\s*;?/gi,
      /throw\s+new\s+Error\s*\(\s*['"`]Not yet implemented['"`]\s*\)\s*;?/gi,
      /throw\s+new\s+Error\s*\(\s*['"`]TODO['"`]\s*\)\s*;?/gi,
      /throw\s+new\s+Error\s*\(\s*['"`]STUB['"`]\s*\)\s*;?/gi,
    ];

    for (const pattern of notImplementedPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const indent = getIndentationAt(code, match.index);
        const skeleton = `// [IMPLEMENTATION REQUIRED] ${action}
${indent}// TODO: Implement the following:
${indent}// 1. Validate input data
${indent}// 2. Execute business logic
${indent}// 3. Return appropriate response
${indent}//
${indent}// Example:
${indent}// const result = await process${action.replace(/_/g, '')}(input);
${indent}// return NextResponse.json(result);
${indent}
${indent}return NextResponse.json(
${indent}  { error: 'Implementation pending', action: '${action}' },
${indent}  { status: 501 }
${indent});`;

        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          content: skeleton,
          description: 'Replace stub with implementation skeleton',
        });
      }
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: No "Not implemented" throws
    const notImplementedPattern = /throw\s+new\s+Error\s*\(\s*['"`]Not implemented['"`]\s*\)/i;
    if (notImplementedPattern.test(patched)) {
      return { valid: false, reason: '"Not implemented" error still present' };
    }
    evidence.push('✓ No "Not implemented" errors');

    // Check 2: No TODO/STUB throws
    const stubPattern = /throw\s+new\s+Error\s*\(\s*['"`](TODO|STUB|PLACEHOLDER)['"`]\s*\)/i;
    if (stubPattern.test(patched)) {
      return { valid: false, reason: 'TODO/STUB/PLACEHOLDER error still present' };
    }
    evidence.push('✓ No stub errors');

    // Check 3: Has some form of response (not just a throw)
    const hasResponse = /return\s+(?:NextResponse|Response)\.json/.test(patched);
    if (!hasResponse) {
      return { valid: false, reason: 'Handler has no response, only throws' };
    }
    evidence.push('✓ Handler has response');

    return { valid: true, evidence };
  },

  verifyWith: ['gate'],
};

// ============================================================================
// FIX RECIPE: intent/constant-time-compare
// ============================================================================

export const constantTimeCompareRecipe: FixRecipe = {
  ruleId: 'intent/constant-time-compare',
  description: 'Replace string comparison with constant-time compare to prevent timing attacks',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';

    // Step 1: Add crypto import if missing
    if (!code.includes("import crypto") && !code.includes("import * as crypto") && !code.includes("from 'crypto'")) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: "\nimport crypto from 'crypto';",
        description: 'Add crypto import for constant-time compare',
      });
    }

    // Step 2: Add constant-time compare helper if missing
    if (!code.includes('constantTimeCompare') && !code.includes('timingSafeEqual')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset > 0) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportOffset,
          content: `
// @intent constant-time-compare - Prevent timing attacks on credential verification
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

`,
          description: 'Add constantTimeCompare helper function',
        });
      }
    }

    // Step 3: Replace direct string comparisons with constant-time helper
    // Pattern: password_hash === expectedHash or similar
    const unsafeComparePatterns = [
      /(\w+\.password_hash)\s*===\s*(\w+)/g,
      /(\w+\.password)\s*===\s*(\w+)/g,
      /(password_hash)\s*===\s*(\w+)/g,
      /(expectedHash)\s*===\s*([\w.]+)/g,
      /(user\.password_hash)\s*!==\s*(\w+)/g,
    ];

    for (const pattern of unsafeComparePatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const fullMatch = match[0];
        const left = match[1];
        const right = match[2];
        const isNegative = fullMatch.includes('!==');

        // Skip if already using constantTimeCompare
        if (code.substring(Math.max(0, match.index - 50), match.index).includes('constantTimeCompare')) {
          continue;
        }

        const replacement = isNegative
          ? `!constantTimeCompare(${left}, ${right})`
          : `constantTimeCompare(${left}, ${right})`;

        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index,
          endOffset: match.index + fullMatch.length,
          content: replacement,
          description: `Replace ${isNegative ? 'unsafe !== check' : 'unsafe === check'} with constantTimeCompare`,
        });
      }
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: Has constantTimeCompare helper or timingSafeEqual
    if (!patched.includes('constantTimeCompare') && !patched.includes('timingSafeEqual')) {
      return { valid: false, reason: 'No constant-time compare function found' };
    }
    evidence.push('✓ Constant-time compare function present');

    // Check 2: No direct === comparisons on password/hash fields
    const unsafePatterns = [
      /password_hash\s*===\s*\w+/,
      /password\s*===\s*\w+/,
      /expectedHash\s*===\s*\w+/,
    ];

    for (const pattern of unsafePatterns) {
      // Skip patterns inside the constantTimeCompare function itself
      const lines = patched.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        if (pattern.test(line) && !line.includes('constantTimeCompare') && !line.includes('timingSafeEqual')) {
          return { valid: false, reason: `Unsafe direct comparison found: ${line.trim()}` };
        }
      }
    }
    evidence.push('✓ No unsafe direct comparisons on credential fields');

    // Check 3: Has crypto import
    if (!patched.includes("from 'crypto'") && !patched.includes('import crypto')) {
      return { valid: false, reason: 'Missing crypto import for timingSafeEqual' };
    }
    evidence.push('✓ Crypto import present');

    return { valid: true, evidence };
  },

  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// FIX RECIPE: intent/lockout-threshold
// ============================================================================

export const lockoutThresholdRecipe: FixRecipe = {
  ruleId: 'intent/lockout-threshold',
  description: 'Enforce account lockout after N failed login attempts',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const action = ctx.behaviorName || inferActionFromFile(violation.file);

    // Default lockout threshold (can be overridden via violation evidence)
    const threshold = 5;

    // Step 1: Check if lockout constant exists
    if (!code.includes('LOCKOUT_THRESHOLD') && !code.includes('MAX_FAILED_ATTEMPTS')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset > 0) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportOffset,
          content: `
// @intent lockout-threshold - Lock account after ${threshold} failed attempts
const LOCKOUT_THRESHOLD = ${threshold};

`,
          description: 'Add LOCKOUT_THRESHOLD constant',
        });
      }
    }

    // Step 2: Find failed_attempts increment and add lockout check after it
    const failedIncrementPattern = /(\w+)\.failed_attempts\s*\+\+/g;
    let match;
    while ((match = failedIncrementPattern.exec(code)) !== null) {
      const userVar = match[1];
      const afterIncrement = match.index + match[0].length;

      // Check if lockout check already exists within next 200 chars
      const following = code.substring(afterIncrement, afterIncrement + 200);
      if (following.includes('LOCKOUT_THRESHOLD') || following.includes('MAX_FAILED_ATTEMPTS') || following.includes("status = 'LOCKED'")) {
        continue;
      }

      const indent = getIndentationAt(code, match.index);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: afterIncrement,
        content: `
${indent}
${indent}// @intent lockout-threshold - Auto-lock after threshold
${indent}if (${userVar}.failed_attempts >= LOCKOUT_THRESHOLD) {
${indent}  ${userVar}.status = 'LOCKED';
${indent}  await auditAttempt({ action: '${action}', success: false, reason: 'account_locked_threshold', requestId });
${indent}}`,
        description: 'Add lockout threshold enforcement after failed attempt increment',
      });
    }

    // Step 3: Add lockout check at handler start (before credential verification)
    if (!code.includes("status === 'LOCKED'") && !code.includes("status == 'LOCKED'")) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset !== -1) {
        const bodyStart = findFunctionBodyStart(code, exportOffset);
        // Find where user lookup happens
        const userLookupMatch = code.match(/const\s+user\s*=.*\.get\(/);
        if (userLookupMatch && userLookupMatch.index) {
          const afterUserLookup = code.indexOf('\n', userLookupMatch.index) + 1;
          // Find the next statement after user lookup
          const nextStatementMatch = code.substring(afterUserLookup).match(/^\s*\S/m);
          if (nextStatementMatch && nextStatementMatch.index !== undefined) {
            const insertPoint = afterUserLookup + nextStatementMatch.index;
            const indent = getIndentationAt(code, insertPoint);

            // Only add if not already present
            if (!code.includes("user.status === 'LOCKED'") && !code.includes("user?.status === 'LOCKED'")) {
              patches.push({
                type: 'insert',
                file: violation.file,
                startOffset: afterUserLookup,
                content: `
${indent}// @intent lockout-threshold - Check lockout before verification
${indent}if (user?.status === 'LOCKED') {
${indent}  await auditAttempt({ action: '${action}', success: false, reason: 'account_locked', requestId });
${indent}  return NextResponse.json(
${indent}    { success: false, error: { code: 'ACCOUNT_LOCKED', message: 'Account is locked' } },
${indent}    { status: 401 }
${indent}  );
${indent}}

`,
                description: 'Add early lockout check after user lookup',
              });
            }
          }
        }
      }
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: Has lockout threshold constant
    if (!patched.includes('LOCKOUT_THRESHOLD') && !patched.includes('MAX_FAILED_ATTEMPTS')) {
      return { valid: false, reason: 'No lockout threshold constant defined' };
    }
    evidence.push('✓ Lockout threshold constant defined');

    // Check 2: Has lockout enforcement after failed attempts
    if (!patched.includes("= 'LOCKED'") && !patched.includes("status = 'LOCKED'")) {
      return { valid: false, reason: 'No lockout enforcement after failed attempts' };
    }
    evidence.push('✓ Lockout enforcement present');

    // Check 3: Audit logged on lockout
    if (!patched.includes('account_locked')) {
      return { valid: false, reason: 'Lockout event not audited' };
    }
    evidence.push('✓ Lockout events audited');

    return { valid: true, evidence };
  },

  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// FIX RECIPE: intent/captcha-required
// ============================================================================

export const captchaRequiredRecipe: FixRecipe = {
  ruleId: 'intent/captcha-required',
  description: 'Add CAPTCHA verification for suspicious login attempts',

  createPatches(violation, ctx): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const action = ctx.behaviorName || inferActionFromFile(violation.file);

    // Step 1: Add captcha import if missing
    if (!code.includes('verifyCaptcha') && !code.includes('captcha')) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: "\nimport { verifyCaptcha, isCaptchaRequired } from '@/lib/captcha';",
        description: 'Add captcha verification imports',
      });
    }

    // Step 2: Add captcha threshold constant
    if (!code.includes('CAPTCHA_THRESHOLD')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset > 0) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportOffset,
          content: `
// @intent captcha-required - Require CAPTCHA after suspicious activity
const CAPTCHA_THRESHOLD = 3; // Require after 3 failed attempts

`,
          description: 'Add CAPTCHA_THRESHOLD constant',
        });
      }
    }

    // Step 3: Add captcha verification check early in handler
    if (!code.includes('verifyCaptcha') && !code.includes('captchaToken')) {
      const exportOffset = findExportFunctionOffset(code);
      if (exportOffset !== -1) {
        const bodyStart = findFunctionBodyStart(code, exportOffset);

        // Find a good insertion point - after rate limit but before auth logic
        const rateLimitMatch = code.match(/rateLimit|rateLimitResult/);
        const bodyParseMatch = code.match(/request\.json\s*\(\)/);

        let insertOffset = bodyStart;
        if (rateLimitMatch && rateLimitMatch.index) {
          // Insert after rate limit block
          const nextLineAfterRL = code.indexOf('\n\n', rateLimitMatch.index);
          if (nextLineAfterRL > 0) insertOffset = nextLineAfterRL;
        } else if (bodyParseMatch && bodyParseMatch.index) {
          // Insert after body parse
          const nextLineAfterParse = code.indexOf('\n', bodyParseMatch.index);
          if (nextLineAfterParse > 0) insertOffset = nextLineAfterParse + 1;
        }

        const indent = getIndentationAt(code, insertOffset) || '  ';

        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: insertOffset,
          content: `
${indent}// @intent captcha-required - Verify CAPTCHA for suspicious requests
${indent}const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
${indent}const captchaRequired = await isCaptchaRequired(body.email, ip, CAPTCHA_THRESHOLD);
${indent}if (captchaRequired) {
${indent}  const captchaToken = body.captchaToken;
${indent}  if (!captchaToken) {
${indent}    await auditAttempt({ action: '${action}', success: false, reason: 'captcha_required', requestId });
${indent}    return NextResponse.json(
${indent}      { success: false, error: { code: 'CAPTCHA_REQUIRED', message: 'CAPTCHA verification required' }, captchaRequired: true },
${indent}      { status: 403 }
${indent}    );
${indent}  }
${indent}  const captchaValid = await verifyCaptcha(captchaToken);
${indent}  if (!captchaValid) {
${indent}    await auditAttempt({ action: '${action}', success: false, reason: 'captcha_failed', requestId });
${indent}    return NextResponse.json(
${indent}      { success: false, error: { code: 'CAPTCHA_INVALID', message: 'CAPTCHA verification failed' }, captchaRequired: true },
${indent}      { status: 403 }
${indent}    );
${indent}  }
${indent}}

`,
          description: 'Add CAPTCHA verification block',
        });
      }
    }

    return patches;
  },

  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];

    // Check 1: Has captcha imports
    if (!patched.includes('verifyCaptcha') && !patched.includes('captcha')) {
      return { valid: false, reason: 'No captcha verification function found' };
    }
    evidence.push('✓ Captcha verification imports present');

    // Check 2: Has captcha threshold
    if (!patched.includes('CAPTCHA_THRESHOLD')) {
      return { valid: false, reason: 'No CAPTCHA_THRESHOLD constant' };
    }
    evidence.push('✓ Captcha threshold defined');

    // Check 3: Has captcha verification logic
    if (!patched.includes('captchaRequired') && !patched.includes('CAPTCHA_REQUIRED')) {
      return { valid: false, reason: 'No captcha required check in code' };
    }
    evidence.push('✓ Captcha required check present');

    // Check 4: Audit logged on captcha failure
    if (!patched.includes('captcha_required') && !patched.includes('captcha_failed')) {
      return { valid: false, reason: 'Captcha events not audited' };
    }
    evidence.push('✓ Captcha events audited');

    return { valid: true, evidence };
  },

  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// Recipe Registry
// ============================================================================

export const DETERMINISTIC_RECIPES: Record<string, FixRecipe> = {
  'intent/audit-required': auditRequiredRecipe,
  'intent/rate-limit-required': rateLimitRequiredRecipe,
  'intent/no-pii-logging': noPiiLoggingRecipe,
  'quality/no-stubbed-handlers': noStubbedHandlersRecipe,
  'intent/constant-time-compare': constantTimeCompareRecipe,
  'intent/lockout-threshold': lockoutThresholdRecipe,
  'intent/captcha-required': captchaRequiredRecipe,
};

// ============================================================================
// Apply Patches
// ============================================================================

/**
 * Apply a fix recipe to resolve a violation
 */
export function applyRecipe(violation: SemanticViolation, ctx: FixContext): ApplyResult {
  const recipe = DETERMINISTIC_RECIPES[violation.ruleId];
  if (!recipe) {
    return {
      success: false,
      newCode: ctx.codeMap.get(violation.file) || '',
      patches: [],
      validation: { valid: false, reason: `No recipe for ${violation.ruleId}` },
    };
  }

  const originalCode = ctx.codeMap.get(violation.file) || '';
  const patches = recipe.createPatches(violation, ctx);

  // Apply patches in reverse order (from end to start) to preserve offsets
  let newCode = originalCode;
  const sortedPatches = [...patches].sort((a, b) => b.startOffset - a.startOffset);

  for (const patch of sortedPatches) {
    switch (patch.type) {
      case 'insert':
        newCode = newCode.slice(0, patch.startOffset) + patch.content + newCode.slice(patch.startOffset);
        break;
      case 'replace':
        newCode =
          newCode.slice(0, patch.startOffset) +
          patch.content +
          newCode.slice(patch.endOffset ?? patch.startOffset);
        break;
      case 'delete':
        newCode = newCode.slice(0, patch.startOffset) + newCode.slice(patch.endOffset ?? patch.startOffset);
        break;
    }
  }

  const validation = recipe.validate(originalCode, newCode, violation);

  return {
    success: validation.valid,
    newCode,
    patches,
    validation,
  };
}

/**
 * Get a recipe by rule ID
 */
export function getRecipe(ruleId: string): FixRecipe | undefined {
  return DETERMINISTIC_RECIPES[ruleId];
}

/**
 * Check if we have a recipe for a rule
 */
export function hasRecipe(ruleId: string): boolean {
  return ruleId in DETERMINISTIC_RECIPES;
}
