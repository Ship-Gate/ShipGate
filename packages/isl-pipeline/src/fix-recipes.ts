/**
 * Deterministic Fix Recipes
 * 
 * This module provides deterministic, AST-based fix recipes for ISL intent rules.
 * 
 * Rules covered:
 * - intent/rate-limit-required
 * - intent/audit-required
 * - intent/no-pii-logging
 * - intent/input-validation
 * - intent/encryption-required
 * 
 * Constraints:
 * - No suppressions, no weakening
 * - Only minimal refactors inside touched files
 * - Prefer AST transformations
 * - All fixes are deterministic (same input → same output)
 * 
 * @module @isl-lang/pipeline/fix-recipes
 */

import type { SemanticViolation } from './semantic-rules.js';
import type { ISLAST, RepoContext } from '@isl-lang/translator';

// ============================================================================
// Types
// ============================================================================

export interface FixRecipe {
  /** Rule ID this recipe handles */
  ruleId: string;
  /** Human-readable description */
  description: string;
  /** Generate patches for this violation */
  createPatches: (violation: SemanticViolation, context: FixRecipeContext) => FixPatch[];
  /** Validator: confirms patch satisfies rule semantics */
  validate: (originalCode: string, patchedCode: string, violation: SemanticViolation) => ValidationResult;
  /** What to verify after patching */
  verifyWith: ('gate' | 'typecheck' | 'lint' | 'test')[];
}

export interface FixPatch {
  /** Type of transformation */
  type: 'insert' | 'replace' | 'delete' | 'reorder';
  /** Target file */
  file: string;
  /** Start offset (character position) */
  startOffset: number;
  /** End offset (for replace/delete) */
  endOffset?: number;
  /** Content to insert/replace */
  content: string;
  /** Human-readable description */
  description: string;
  /** Optional: target pattern (for logging/debugging) */
  targetPattern?: string;
}

export interface FixRecipeContext {
  ast: ISLAST;
  repoContext: RepoContext;
  codeMap: Map<string, string>;
  framework: 'nextjs' | 'nextjs-app-router' | 'express' | 'fastify';
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  evidence?: string[];
}

export interface FixPreview {
  ruleId: string;
  file: string;
  patches: PatchPreview[];
  estimatedLines: number;
  willSatisfyRule: boolean;
}

export interface PatchPreview {
  description: string;
  lineNumber: number;
  before: string;
  after: string;
  changeType: 'add' | 'remove' | 'modify';
}

// ============================================================================
// Helper Functions
// ============================================================================

function findLineNumber(code: string, offset: number): number {
  return code.substring(0, offset).split('\n').length;
}

function getLineContent(code: string, lineNum: number): string {
  const lines = code.split('\n');
  return lines[lineNum - 1] || '';
}

function findPatternOffset(code: string, pattern: RegExp): number {
  const match = code.match(pattern);
  return match?.index ?? -1;
}

function findAllPatternOffsets(code: string, pattern: RegExp): number[] {
  const offsets: number[] = [];
  const globalPattern = new RegExp(pattern.source, 'g');
  let match;
  while ((match = globalPattern.exec(code)) !== null) {
    offsets.push(match.index);
  }
  return offsets;
}

function getIndentationAt(code: string, offset: number): string {
  const beforeOffset = code.substring(0, offset);
  const lastNewline = beforeOffset.lastIndexOf('\n');
  const lineStart = lastNewline + 1;
  const lineContent = code.substring(lineStart, offset);
  const match = lineContent.match(/^(\s*)/);
  return match?.[1] ?? '  ';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Code Generation Templates
// ============================================================================

const TEMPLATES = {
  // Rate limit templates
  rateLimitImport: {
    nextjs: "import { rateLimit } from '@/lib/rate-limit';",
    express: "import { rateLimiter } from '../middleware/rate-limit';",
  },
  
  rateLimitCheck: (indent: string, framework: string) => {
    if (framework.includes('nextjs')) {
      return `${indent}// @intent rate-limit-required
${indent}const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
${indent}const rateLimitResult = await rateLimit(request);
${indent}if (!rateLimitResult.success) {
${indent}  await auditAttempt({ success: false, reason: 'rate_limited', requestId, action });
${indent}  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
${indent}}
`;
    }
    return `${indent}// @intent rate-limit-required
${indent}const rateLimitResult = await rateLimiter.check(req.ip);
${indent}if (!rateLimitResult.allowed) {
${indent}  return res.status(429).json({ error: 'Rate limit exceeded' });
${indent}}
`;
  },

  // Audit templates
  auditImport: {
    nextjs: "import { audit } from '@/lib/audit';",
    express: "import { auditLog } from '../services/audit';",
  },
  
  auditHelper: (indent: string) => `
${indent}// Audit helper - called on ALL exit paths with correct semantics
${indent}async function auditAttempt(input: { 
${indent}  success: boolean; 
${indent}  reason?: string; 
${indent}  requestId: string;
${indent}  action: string;
${indent}}) {
${indent}  await audit({
${indent}    action: input.action,
${indent}    timestamp: new Date().toISOString(),
${indent}    success: input.success,
${indent}    reason: input.reason,
${indent}    requestId: input.requestId,
${indent}  });
${indent}}
`,

  auditCall: (indent: string, success: boolean, reason?: string, action?: string) => {
    const reasonPart = reason ? `, reason: '${reason}'` : '';
    return `${indent}await auditAttempt({ success: ${success}${reasonPart}, requestId, action: '${action ?? 'unknown'}' });
`;
  },

  // Validation templates
  validationImport: "import { z } from 'zod';",
  
  validationCheck: (indent: string, schemaName: string = 'InputSchema') => `${indent}// @intent input-validation
${indent}const validationResult = ${schemaName}.safeParse(body);
${indent}if (!validationResult.success) {
${indent}  await auditAttempt({ success: false, reason: 'validation_failed', requestId, action });
${indent}  return NextResponse.json(
${indent}    { error: 'Validation failed', details: validationResult.error.flatten() },
${indent}    { status: 400 }
${indent}  );
${indent}}
${indent}const input = validationResult.data;
`,

  // Safe logger templates
  safeLoggerImport: "import { safeLogger, redactPII } from '@/lib/logger';",
  
  redactPIIHelper: (indent: string) => `
${indent}// PII redaction helper for safe logging
${indent}function redactPII(obj: unknown): unknown {
${indent}  if (typeof obj !== 'object' || obj === null) return obj;
${indent}  const redacted = { ...obj as Record<string, unknown> };
${indent}  const piiFields = ['email', 'password', 'token', 'secret', 'credential', 'ssn', 'phone', 'creditCard', 'cardNumber'];
${indent}  for (const field of piiFields) {
${indent}    if (field in redacted) redacted[field] = '[REDACTED]';
${indent}    const lowerField = field.toLowerCase();
${indent}    for (const key of Object.keys(redacted)) {
${indent}      if (key.toLowerCase().includes(lowerField)) redacted[key] = '[REDACTED]';
${indent}    }
${indent}  }
${indent}  return redacted;
${indent}}
`,

  // Encryption templates
  encryptionImport: "import { encrypt, decrypt, hashPassword } from '@/lib/encryption';",
  
  bcryptImport: "import bcrypt from 'bcrypt';",
  
  passwordHash: (indent: string, varName: string = 'password') => 
    `${indent}const hashedPassword = await bcrypt.hash(${varName}, 12);
`,

  encryptField: (indent: string, fieldName: string) => 
    `${indent}const encrypted${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} = await encrypt(${fieldName});
`,
};

// ============================================================================
// Fix Recipe: intent/rate-limit-required
// ============================================================================

const rateLimitRecipe: FixRecipe = {
  ruleId: 'intent/rate-limit-required',
  description: 'Add rate limiting check BEFORE body parsing with proper audit on 429',
  
  createPatches(violation, ctx): FixPatch[] {
    const patches: FixPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const fw = ctx.framework;
    
    // Step 1: Add import if missing
    if (!code.includes('rateLimit') && !code.includes('rateLimiter')) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.rateLimitImport[fw.includes('express') ? 'express' : 'nextjs'],
        description: 'Add rate limit import',
      });
    }
    
    // Step 2: Find handler function and add rate limit at the start
    const handlerMatch = code.match(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/);
    if (handlerMatch && handlerMatch.index !== undefined) {
      const braceOffset = code.indexOf('{', handlerMatch.index) + 1;
      const indent = getIndentationAt(code, braceOffset) + '  ';
      
      // Check if rate limit exists but is in wrong position
      const rateLimitOffset = findPatternOffset(code, /rateLimit\s*\(/);
      const bodyParseOffset = findPatternOffset(code, /request\.json\s*\(\)/);
      
      if (rateLimitOffset > bodyParseOffset && bodyParseOffset !== -1) {
        // Need to reorder: remove existing rate limit and add at correct position
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: braceOffset,
          content: '\n' + TEMPLATES.rateLimitCheck(indent, fw),
          description: 'Add rate limit check at handler start (before body parsing)',
        });
      } else if (rateLimitOffset === -1) {
        // No rate limit exists, add it
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: braceOffset,
          content: '\n' + TEMPLATES.rateLimitCheck(indent, fw),
          description: 'Add rate limit check at handler start',
        });
      }
    }
    
    // Step 3: Ensure 429 response has proper audit
    const has429 = code.includes('429');
    if (has429) {
      const block429Match = code.match(/return\s+NextResponse\.json\([^)]*,\s*\{\s*status:\s*429\s*\}\)/);
      if (block429Match && block429Match.index !== undefined) {
        // Check if audit exists before this return
        const contextStart = Math.max(0, block429Match.index - 200);
        const context = code.substring(contextStart, block429Match.index);
        if (!context.includes('auditAttempt') && !context.includes('audit(')) {
          const indent = getIndentationAt(code, block429Match.index);
          patches.push({
            type: 'insert',
            file: violation.file,
            startOffset: block429Match.index,
            content: TEMPLATES.auditCall(indent, false, 'rate_limited', inferActionFromFile(violation.file)),
            description: 'Add audit call before 429 response',
          });
        }
      }
    }
    
    return patches;
  },
  
  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];
    
    // Check 1: Rate limit exists
    const hasRateLimit = patched.includes('rateLimit');
    if (!hasRateLimit) {
      return { valid: false, reason: 'Rate limit check not found in patched code' };
    }
    evidence.push('✓ Rate limit check present');
    
    // Check 2: Rate limit is BEFORE body parsing
    const rateLimitOffset = patched.indexOf('rateLimit');
    const bodyParseOffset = patched.indexOf('request.json()');
    if (bodyParseOffset !== -1 && rateLimitOffset > bodyParseOffset) {
      return { 
        valid: false, 
        reason: 'Rate limit check occurs AFTER body parsing',
        evidence: ['Rate limit must be before request.json()'],
      };
    }
    evidence.push('✓ Rate limit before body parsing');
    
    // Check 3: 429 responses have audit with success:false
    if (patched.includes('429')) {
      const has429Audit = /audit.*success:\s*false.*429|429.*audit.*success:\s*false/s.test(patched);
      if (!has429Audit) {
        return {
          valid: false,
          reason: '429 response missing audit with success:false',
          evidence,
        };
      }
      evidence.push('✓ 429 response has audit with success:false');
    }
    
    return { valid: true, evidence };
  },
  
  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// Fix Recipe: intent/audit-required
// ============================================================================

const auditRecipe: FixRecipe = {
  ruleId: 'intent/audit-required',
  description: 'Add audit logging on ALL exit paths with correct success/failure semantics',
  
  createPatches(violation, ctx): FixPatch[] {
    const patches: FixPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    const action = inferActionFromFile(violation.file);
    
    // Step 1: Add audit import if missing
    if (!code.includes('audit') || (!code.includes("from '@/lib/audit'") && !code.includes("from '../services/audit'"))) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.auditImport[ctx.framework.includes('express') ? 'express' : 'nextjs'],
        description: 'Add audit import',
      });
    }
    
    // Step 2: Add auditAttempt helper if missing
    if (!code.includes('auditAttempt')) {
      const exportIdx = findPatternOffset(code, /export\s+(async\s+)?function/);
      if (exportIdx !== -1) {
        const indent = '';
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportIdx,
          content: TEMPLATES.auditHelper(indent) + '\n',
          description: 'Add auditAttempt helper function',
        });
      }
    }
    
    // Step 3: Add requestId extraction if missing
    const handlerMatch = code.match(/export\s+async\s+function\s+\w+\s*\([^)]*\)\s*\{/);
    if (handlerMatch && handlerMatch.index !== undefined && !code.includes('requestId')) {
      const braceOffset = code.indexOf('{', handlerMatch.index) + 1;
      const indent = getIndentationAt(code, braceOffset) + '  ';
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: braceOffset,
        content: `\n${indent}const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();\n${indent}const action = '${action}';\n`,
        description: 'Add requestId extraction',
      });
    }
    
    // Step 4: Find all return statements and add audit before each
    const returnPatterns = [
      { pattern: /return\s+NextResponse\.json\([^,]+,\s*\{\s*status:\s*429/, success: false, reason: 'rate_limited' },
      { pattern: /return\s+NextResponse\.json\([^,]+,\s*\{\s*status:\s*400/, success: false, reason: 'validation_failed' },
      { pattern: /return\s+NextResponse\.json\([^,]+,\s*\{\s*status:\s*401/, success: false, reason: 'unauthorized' },
      { pattern: /return\s+NextResponse\.json\([^,]+,\s*\{\s*status:\s*403/, success: false, reason: 'forbidden' },
      { pattern: /return\s+NextResponse\.json\([^,]+,\s*\{\s*status:\s*404/, success: false, reason: 'not_found' },
      { pattern: /return\s+NextResponse\.json\([^,]+,\s*\{\s*status:\s*5\d\d/, success: false, reason: 'server_error' },
      { pattern: /return\s+NextResponse\.json\(\s*result\s*\)/, success: true, reason: undefined },
      { pattern: /return\s+NextResponse\.json\(\s*\{(?!.*error)/, success: true, reason: undefined },
    ];
    
    for (const { pattern, success, reason } of returnPatterns) {
      const offsets = findAllPatternOffsetsWithContext(code, pattern);
      for (const offset of offsets) {
        // Check if audit already exists before this return
        const contextStart = Math.max(0, offset - 150);
        const context = code.substring(contextStart, offset);
        if (!context.includes('auditAttempt') && !context.includes('await audit(')) {
          const indent = getIndentationAt(code, offset);
          patches.push({
            type: 'insert',
            file: violation.file,
            startOffset: offset,
            content: TEMPLATES.auditCall(indent, success, reason, action),
            description: `Add audit before ${success ? 'success' : 'error'} return`,
          });
        }
      }
    }
    
    // Step 5: Add audit in catch blocks
    const catchOffsets = findAllPatternOffsets(code, /catch\s*\([^)]*\)\s*\{/);
    for (const catchOffset of catchOffsets) {
      const braceOffset = code.indexOf('{', catchOffset) + 1;
      const catchBlock = extractBlock(code, braceOffset);
      if (!catchBlock.includes('auditAttempt') && !catchBlock.includes('await audit(')) {
        const indent = getIndentationAt(code, braceOffset) + '  ';
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: braceOffset,
          content: `\n${TEMPLATES.auditCall(indent, false, 'error', action)}`,
          description: 'Add audit in catch block',
        });
      }
    }
    
    return patches;
  },
  
  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];
    
    // Check 1: auditAttempt helper exists
    if (!patched.includes('auditAttempt')) {
      return { valid: false, reason: 'auditAttempt helper not found' };
    }
    evidence.push('✓ auditAttempt helper present');
    
    // Check 2: All return statements have audit
    const returnStatements = patched.match(/return\s+(?:NextResponse|Response)\.json/g) || [];
    const auditCalls = patched.match(/auditAttempt\s*\(/g) || [];
    
    if (auditCalls.length < returnStatements.length) {
      return {
        valid: false,
        reason: `Found ${returnStatements.length} return statements but only ${auditCalls.length} audit calls`,
        evidence,
      };
    }
    evidence.push(`✓ ${auditCalls.length} audit calls for ${returnStatements.length} return statements`);
    
    // Check 3: Error paths have success:false
    const errorAuditPatterns = [
      /429[\s\S]{0,100}success:\s*true/,
      /400[\s\S]{0,100}success:\s*true/,
      /401[\s\S]{0,100}success:\s*true/,
      /catch[\s\S]{0,100}success:\s*true/,
    ];
    
    for (const pattern of errorAuditPatterns) {
      if (pattern.test(patched)) {
        return {
          valid: false,
          reason: 'Found success:true on error path (must be false)',
          evidence,
        };
      }
    }
    evidence.push('✓ Error paths have success:false');
    
    // Check 4: Required fields present
    if (!patched.includes('timestamp')) {
      return { valid: false, reason: 'Audit calls missing timestamp field', evidence };
    }
    evidence.push('✓ timestamp field present');
    
    return { valid: true, evidence };
  },
  
  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// Fix Recipe: intent/no-pii-logging
// ============================================================================

const noPiiLoggingRecipe: FixRecipe = {
  ruleId: 'intent/no-pii-logging',
  description: 'Remove/replace console.* with safe logger, add PII redaction',
  
  createPatches(violation, ctx): FixPatch[] {
    const patches: FixPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    
    // Step 1: Add safe logger import if needed
    if (!code.includes('safeLogger') && !code.includes('redactPII')) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.safeLoggerImport,
        description: 'Add safe logger import',
      });
    }
    
    // Step 2: Add redactPII helper if not imported
    if (!code.includes('redactPII') && !code.includes("from '@/lib/logger'")) {
      const exportIdx = findPatternOffset(code, /export\s+(async\s+)?function/);
      if (exportIdx !== -1) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: exportIdx,
          content: TEMPLATES.redactPIIHelper('') + '\n',
          description: 'Add redactPII helper function',
        });
      }
    }
    
    // Step 3: Replace/remove console.* calls
    // Note: replacement text must NOT contain patterns like "console.log(" that would fail validation
    const consolePatterns = [
      { pattern: /console\.log\s*\([^)]*\)\s*;?\s*\n?/g, replacement: '// [REMOVED] console-log - PII risk\n' },
      { pattern: /console\.info\s*\([^)]*\)\s*;?\s*\n?/g, replacement: '// [REMOVED] console-info - PII risk\n' },
      { pattern: /console\.debug\s*\([^)]*\)\s*;?\s*\n?/g, replacement: '// [REMOVED] console-debug - PII risk\n' },
      { pattern: /console\.warn\s*\([^)]*\)\s*;?\s*\n?/g, replacement: '// [REMOVED] console-warn - PII risk\n' },
    ];
    
    for (const { pattern, replacement } of consolePatterns) {
      let match;
      const globalPattern = new RegExp(pattern.source, 'g');
      while ((match = globalPattern.exec(code)) !== null) {
        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          content: replacement,
          description: `Remove ${match[0].split('(')[0]}`,
        });
      }
    }
    
    // Step 4: Replace console.error with safeLogger.error
    const errorPattern = /console\.error\s*\(\s*(['"`][^'"`]+['"`])\s*,?\s*([^)]*)\)\s*;?/g;
    let errorMatch;
    while ((errorMatch = errorPattern.exec(code)) !== null) {
      const message = errorMatch[1];
      const args = errorMatch[2].trim();
      const replacement = args 
        ? `safeLogger.error(${message}, { error: redactPII(${args}) });`
        : `safeLogger.error(${message});`;
      
      patches.push({
        type: 'replace',
        file: violation.file,
        startOffset: errorMatch.index,
        endOffset: errorMatch.index + errorMatch[0].length,
        content: replacement,
        description: 'Replace console.error with safeLogger.error',
      });
    }
    
    // Step 5: Wrap raw PII in audit calls with redaction
    const piiFields = ['email', 'password', 'ssn', 'creditCard', 'phone', 'token', 'secret'];
    const auditPiiPattern = new RegExp(`audit(?:Attempt)?\\s*\\(\\s*\\{[^}]*(${piiFields.join('|')})\\s*:[^}]+\\}`, 'gi');
    let auditMatch;
    while ((auditMatch = auditPiiPattern.exec(code)) !== null) {
      const field = auditMatch[1];
      // This is complex - for now, flag it in the patch description
      // A full implementation would parse and transform the object
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: auditMatch.index,
        content: `// TODO: Wrap ${field} with redactPII() before including in audit\n`,
        description: `Flag PII field ${field} in audit payload`,
      });
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
    
    // Check 2: console.error replaced with safeLogger
    if (original.includes('console.error') && patched.includes('console.error')) {
      if (!patched.includes('safeLogger.error')) {
        return { valid: false, reason: 'console.error not replaced with safeLogger' };
      }
    }
    evidence.push('✓ console.error properly replaced');
    
    // Check 3: No raw request body logging
    if (/console\.[a-z]+\s*\([^)]*req\.body/i.test(patched)) {
      return { valid: false, reason: 'Raw request body still logged' };
    }
    evidence.push('✓ No raw request body logging');
    
    // Check 4: No raw headers logging
    if (/console\.[a-z]+\s*\([^)]*req\.headers/i.test(patched)) {
      return { valid: false, reason: 'Raw headers still logged' };
    }
    evidence.push('✓ No raw headers logging');
    
    return { valid: true, evidence };
  },
  
  verifyWith: ['gate', 'lint'],
};

// ============================================================================
// Fix Recipe: intent/input-validation
// ============================================================================

const inputValidationRecipe: FixRecipe = {
  ruleId: 'intent/input-validation',
  description: 'Add schema validation BEFORE business logic, check validation result',
  
  createPatches(violation, ctx): FixPatch[] {
    const patches: FixPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    
    // Step 1: Add zod import if missing
    if (!code.includes("from 'zod'") && !code.includes("from \"zod\"")) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.validationImport,
        description: 'Add Zod import',
      });
    }
    
    // Step 2: Find body parsing and add validation after
    const bodyParseMatch = code.match(/const\s+(\w+)\s*=\s*await\s+request\.json\s*\(\s*\)\s*;?/);
    if (bodyParseMatch && bodyParseMatch.index !== undefined) {
      const bodyVar = bodyParseMatch[1];
      const afterBodyParse = bodyParseMatch.index + bodyParseMatch[0].length;
      const indent = getIndentationAt(code, bodyParseMatch.index);
      
      // Check if validation already exists after body parse
      const codeAfterParse = code.substring(afterBodyParse, afterBodyParse + 300);
      if (!codeAfterParse.includes('safeParse') && !codeAfterParse.includes('.parse(')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: afterBodyParse,
          content: '\n' + TEMPLATES.validationCheck(indent, 'InputSchema'),
          description: 'Add input validation after body parsing',
        });
      }
    }
    
    // Step 3: If schema doesn't exist, add a placeholder
    if (!code.includes('Schema') && !code.includes('schema')) {
      const importOffset = findLastImportOffset(code);
      const schemaPlaceholder = `

// TODO: Define your input schema
const InputSchema = z.object({
  // Add your schema fields here
  // Example: email: z.string().email(),
});
`;
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: schemaPlaceholder,
        description: 'Add placeholder input schema',
      });
    }
    
    // Step 4: Ensure validation result is checked
    if (code.includes('safeParse')) {
      const hasResultCheck = code.includes('.success') || code.includes('.error');
      if (!hasResultCheck) {
        const safeParseMatch = code.match(/(\w+)\.safeParse\s*\(/);
        if (safeParseMatch) {
          const validationResultVar = safeParseMatch[1];
          const afterSafeParse = code.indexOf('safeParse') + 50;
          // Find the semicolon and add check after
          const semiOffset = code.indexOf(';', afterSafeParse);
          if (semiOffset !== -1) {
            const indent = getIndentationAt(code, semiOffset);
            patches.push({
              type: 'insert',
              file: violation.file,
              startOffset: semiOffset + 1,
              content: `\n${indent}if (!validationResult.success) {\n${indent}  return NextResponse.json({ error: 'Validation failed' }, { status: 400 });\n${indent}}\n`,
              description: 'Add validation result check',
            });
          }
        }
      }
    }
    
    return patches;
  },
  
  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];
    
    // Check 1: Has body parsing
    const hasBodyParse = patched.includes('request.json()') || patched.includes('req.body');
    if (!hasBodyParse) {
      // No body parsing, validation not needed
      return { valid: true, evidence: ['No body parsing detected, validation not required'] };
    }
    evidence.push('✓ Body parsing detected');
    
    // Check 2: Has validation
    const hasValidation = patched.includes('safeParse') || patched.includes('.parse(');
    if (!hasValidation) {
      return { valid: false, reason: 'No schema validation found' };
    }
    evidence.push('✓ Schema validation present');
    
    // Check 3: Validation is BEFORE business logic
    const validationOffset = Math.min(
      patched.indexOf('safeParse') !== -1 ? patched.indexOf('safeParse') : Infinity,
      patched.indexOf('.parse(') !== -1 ? patched.indexOf('.parse(') : Infinity
    );
    const bodyParseOffset = patched.indexOf('request.json()');
    
    const dbPatterns = ['prisma.', 'db.', 'await db', 'findUnique', 'findMany', 'create(', 'update('];
    let firstDbCall = Infinity;
    for (const pattern of dbPatterns) {
      const idx = patched.indexOf(pattern);
      if (idx > bodyParseOffset && idx < firstDbCall) {
        firstDbCall = idx;
      }
    }
    
    if (validationOffset > firstDbCall) {
      return {
        valid: false,
        reason: 'Validation occurs AFTER database call',
        evidence,
      };
    }
    evidence.push('✓ Validation before business logic');
    
    // Check 4: Validation result is checked
    if (!patched.includes('.success') && !patched.includes('.error')) {
      return {
        valid: false,
        reason: 'Validation result not checked',
        evidence,
      };
    }
    evidence.push('✓ Validation result checked');
    
    return { valid: true, evidence };
  },
  
  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// Fix Recipe: intent/encryption-required
// ============================================================================

const encryptionRecipe: FixRecipe = {
  ruleId: 'intent/encryption-required',
  description: 'Add encryption for sensitive data, use bcrypt for passwords',
  
  createPatches(violation, ctx): FixPatch[] {
    const patches: FixPatch[] = [];
    const code = ctx.codeMap.get(violation.file) || '';
    
    // Detect what type of encryption is needed
    const needsPasswordHash = /password\s*[=:]/i.test(code) && !code.includes('bcrypt');
    const needsFieldEncryption = /(ssn|creditCard|cardNumber|secret)\s*[=:]/i.test(code) && !code.includes('encrypt(');
    
    // Step 1: Add appropriate imports
    if (needsPasswordHash && !code.includes('bcrypt')) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.bcryptImport,
        description: 'Add bcrypt import for password hashing',
      });
    }
    
    if (needsFieldEncryption && !code.includes("from '@/lib/encryption'")) {
      const importOffset = findLastImportOffset(code);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: importOffset,
        content: '\n' + TEMPLATES.encryptionImport,
        description: 'Add encryption import',
      });
    }
    
    // Step 2: Transform password storage to use bcrypt
    // Pattern 1: Direct assignment like user.password = body.password
    const passwordAssignments = [...code.matchAll(/(\w+)\.password\s*=\s*(\w+)\.password/g)];
    for (const match of passwordAssignments) {
      if (match.index !== undefined) {
        const indent = getIndentationAt(code, match.index);
        const sourceVar = match[2];
        
        // Insert hash before the assignment
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: match.index,
          content: TEMPLATES.passwordHash(indent, `${sourceVar}.password`),
          description: 'Add password hashing before storage',
        });
        
        // Replace assignment to use hashed password
        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index + patches[patches.length - 1].content.length,
          endOffset: match.index + match[0].length,
          content: `${match[1]}.password = hashedPassword`,
          description: 'Use hashed password in assignment',
        });
      }
    }
    
    // Pattern 2: Object literal like { password: body.password }
    const objectPasswordPatterns = [...code.matchAll(/(\s*)(password)\s*:\s*(\w+)\.password\s*(,?)/g)];
    for (const match of objectPasswordPatterns) {
      if (match.index !== undefined) {
        const indent = match[1];
        const sourceVar = match[3];
        const comma = match[4] || '';
        
        // Find a good place to insert the hash (before the object or at function start)
        const objStart = findObjectStart(code, match.index);
        const insertOffset = objStart !== -1 ? objStart : match.index;
        const hashIndent = getIndentationAt(code, insertOffset);
        
        // Add hash before object creation
        patches.push({
          type: 'insert',
          file: violation.file,
          startOffset: insertOffset,
          content: `const hashedPassword = await bcrypt.hash(${sourceVar}.password, 12);\n${hashIndent}`,
          description: 'Add password hashing before object creation',
        });
        
        // Replace the password property to use hashedPassword
        patches.push({
          type: 'replace',
          file: violation.file,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          content: `${indent}password: hashedPassword${comma}`,
          description: 'Use hashed password in object literal',
        });
      }
    }
    
    // Step 3: Transform sensitive field storage to use encryption
    const sensitiveFields = ['ssn', 'creditCard', 'cardNumber', 'secret', 'apiKey'];
    for (const field of sensitiveFields) {
      const pattern = new RegExp(`(\\w+)\\.${field}\\s*=\\s*(\\w+)\\.${field}`, 'g');
      const matches = [...code.matchAll(pattern)];
      for (const match of matches) {
        if (match.index !== undefined) {
          const indent = getIndentationAt(code, match.index);
          const sourceVar = match[2];
          
          patches.push({
            type: 'insert',
            file: violation.file,
            startOffset: match.index,
            content: TEMPLATES.encryptField(indent, `${sourceVar}.${field}`),
            description: `Add encryption for ${field}`,
          });
        }
      }
    }
    
    // Step 4: Check for hardcoded encryption keys and flag them
    const hardcodedKeyPattern = /(encryptionKey|secret)\s*=\s*['"][^'"]{8,}['"]/gi;
    let keyMatch;
    while ((keyMatch = hardcodedKeyPattern.exec(code)) !== null) {
      const lineNum = findLineNumber(code, keyMatch.index);
      patches.push({
        type: 'insert',
        file: violation.file,
        startOffset: keyMatch.index,
        content: `// SECURITY: Replace hardcoded key with environment variable\n// Use: process.env.${keyMatch[1].toUpperCase()}\n`,
        description: 'Flag hardcoded encryption key',
      });
    }
    
    return patches;
  },
  
  validate(original, patched, violation): ValidationResult {
    const evidence: string[] = [];
    
    // Check 1: Password uses bcrypt
    if (original.includes('password') && patched.includes('password')) {
      const hasProperHash = patched.includes('bcrypt.hash') || 
                          patched.includes('argon2.hash') ||
                          patched.includes('hashedPassword');
      if (!hasProperHash && /password\s*=/.test(patched)) {
        return {
          valid: false,
          reason: 'Password not properly hashed before storage',
          evidence: ['Passwords must use bcrypt.hash() or argon2.hash()'],
        };
      }
      evidence.push('✓ Password properly hashed');
    }
    
    // Check 2: Sensitive fields encrypted
    const sensitiveFields = ['ssn', 'creditCard', 'cardNumber'];
    for (const field of sensitiveFields) {
      if (original.includes(field) && patched.includes(field)) {
        const storedWithoutEncryption = new RegExp(`\\.${field}\\s*=\\s*\\w+\\.${field}(?!.*encrypt)`).test(patched);
        if (storedWithoutEncryption && !patched.includes(`encrypted${field.charAt(0).toUpperCase() + field.slice(1)}`)) {
          return {
            valid: false,
            reason: `${field} stored without encryption`,
            evidence,
          };
        }
      }
    }
    evidence.push('✓ Sensitive fields encrypted');
    
    // Check 3: No hardcoded keys (warning only)
    const hardcodedKeyPattern = /(encryptionKey|secret)\s*=\s*['"][^'"]{8,}['"]/i;
    if (hardcodedKeyPattern.test(patched)) {
      evidence.push('⚠ Hardcoded encryption key detected (use env variable)');
    } else {
      evidence.push('✓ No hardcoded encryption keys');
    }
    
    return { valid: true, evidence };
  },
  
  verifyWith: ['gate', 'typecheck'],
};

// ============================================================================
// Fix Recipe Registry
// ============================================================================

export const FIX_RECIPE_CATALOG: Record<string, FixRecipe> = {
  'intent/rate-limit-required': rateLimitRecipe,
  'intent/audit-required': auditRecipe,
  'intent/no-pii-logging': noPiiLoggingRecipe,
  'intent/input-validation': inputValidationRecipe,
  'intent/encryption-required': encryptionRecipe,
};

// ============================================================================
// Fix Preview Generator
// ============================================================================

/**
 * Generate a preview of patches without applying them
 */
export function generateFixPreview(
  violation: SemanticViolation,
  ctx: FixRecipeContext
): FixPreview | null {
  const recipe = FIX_RECIPE_CATALOG[violation.ruleId];
  if (!recipe) {
    return null;
  }
  
  const code = ctx.codeMap.get(violation.file) || '';
  const patches = recipe.createPatches(violation, ctx);
  
  if (patches.length === 0) {
    return null;
  }
  
  const patchPreviews: PatchPreview[] = patches.map(patch => {
    const lineNumber = findLineNumber(code, patch.startOffset);
    const before = patch.type === 'insert' 
      ? getLineContent(code, lineNumber)
      : code.substring(patch.startOffset, patch.endOffset ?? patch.startOffset + 50);
    
    const changeType: 'add' | 'remove' | 'modify' = 
      patch.type === 'insert' ? 'add' :
      patch.type === 'delete' ? 'remove' : 'modify';
    
    return {
      description: patch.description,
      lineNumber,
      before: before.trim().substring(0, 80),
      after: patch.content.trim().substring(0, 80),
      changeType,
    };
  });
  
  // Estimate if patches will satisfy the rule
  let simulatedCode = code;
  const sortedPatches = [...patches].sort((a, b) => b.startOffset - a.startOffset);
  for (const patch of sortedPatches) {
    if (patch.type === 'insert') {
      simulatedCode = simulatedCode.slice(0, patch.startOffset) + patch.content + simulatedCode.slice(patch.startOffset);
    } else if (patch.type === 'replace') {
      simulatedCode = simulatedCode.slice(0, patch.startOffset) + patch.content + simulatedCode.slice(patch.endOffset ?? patch.startOffset);
    } else if (patch.type === 'delete') {
      simulatedCode = simulatedCode.slice(0, patch.startOffset) + simulatedCode.slice(patch.endOffset ?? patch.startOffset);
    }
  }
  
  const validationResult = recipe.validate(code, simulatedCode, violation);
  
  return {
    ruleId: violation.ruleId,
    file: violation.file,
    patches: patchPreviews,
    estimatedLines: patches.reduce((sum, p) => sum + p.content.split('\n').length, 0),
    willSatisfyRule: validationResult.valid,
  };
}

/**
 * Generate previews for all violations
 */
export function generateAllFixPreviews(
  violations: SemanticViolation[],
  ctx: FixRecipeContext
): FixPreview[] {
  const previews: FixPreview[] = [];
  
  // Group by file and rule to avoid duplicate patches
  const groupedViolations = new Map<string, SemanticViolation[]>();
  for (const v of violations) {
    const key = `${v.file}:${v.ruleId}`;
    const group = groupedViolations.get(key) || [];
    group.push(v);
    groupedViolations.set(key, group);
  }
  
  for (const [, ruleViolations] of groupedViolations) {
    const preview = generateFixPreview(ruleViolations[0], ctx);
    if (preview) {
      previews.push(preview);
    }
  }
  
  return previews;
}

// ============================================================================
// Apply Patches
// ============================================================================

/**
 * Apply all patches from a fix recipe
 */
export function applyFixRecipe(
  violation: SemanticViolation,
  ctx: FixRecipeContext
): { success: boolean; newCode: string; patches: FixPatch[]; validation: ValidationResult } {
  const recipe = FIX_RECIPE_CATALOG[violation.ruleId];
  if (!recipe) {
    return {
      success: false,
      newCode: ctx.codeMap.get(violation.file) || '',
      patches: [],
      validation: { valid: false, reason: `No fix recipe for ${violation.ruleId}` },
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
        newCode = newCode.slice(0, patch.startOffset) + patch.content + newCode.slice(patch.endOffset ?? patch.startOffset);
        break;
      case 'delete':
        newCode = newCode.slice(0, patch.startOffset) + newCode.slice(patch.endOffset ?? patch.startOffset);
        break;
      case 'reorder':
        // Reorder is handled specially
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

// ============================================================================
// Helper Functions
// ============================================================================

function findLastImportOffset(code: string): number {
  const importMatches = [...code.matchAll(/^import\s+.*?['"][^'"]+['"];?\s*$/gm)];
  if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    return (lastImport.index ?? 0) + lastImport[0].length;
  }
  return 0;
}

function inferActionFromFile(file: string): string {
  const parts = file.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1].replace(/\.(ts|tsx|js|jsx)$/, '');
  
  if (fileName === 'route') {
    const parentFolder = parts[parts.length - 2];
    return parentFolder || 'api_request';
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
    if (fileName.toLowerCase().includes(key)) {
      return action;
    }
  }
  
  return `${fileName.replace(/[-_]/g, '_')}_request`;
}

function findAllPatternOffsetsWithContext(code: string, pattern: RegExp): number[] {
  const offsets: number[] = [];
  let match;
  const globalPattern = new RegExp(pattern.source, 'g');
  while ((match = globalPattern.exec(code)) !== null) {
    offsets.push(match.index);
  }
  return offsets;
}

function extractBlock(code: string, startBraceOffset: number): string {
  let depth = 1;
  let i = startBraceOffset;
  while (i < code.length && depth > 0) {
    if (code[i] === '{') depth++;
    if (code[i] === '}') depth--;
    i++;
  }
  return code.substring(startBraceOffset, i);
}

/**
 * Find the start of an object literal containing a given offset
 * Returns -1 if not found or if it's a function body
 */
function findObjectStart(code: string, offset: number): number {
  // Look backwards for the start of an assignment or const/let/var
  let i = offset;
  let braceDepth = 0;
  
  while (i > 0) {
    const char = code[i];
    if (char === '}') braceDepth++;
    if (char === '{') {
      if (braceDepth === 0) {
        // Found opening brace, check if it's an object literal
        const before = code.substring(Math.max(0, i - 50), i).trim();
        // Check for assignment patterns like "const x = {" or "= {"
        if (/(?:const|let|var)\s+\w+\s*=\s*$/.test(before) || /=\s*$/.test(before)) {
          // Find the line start before the const/let/var
          let lineStart = i;
          while (lineStart > 0 && code[lineStart - 1] !== '\n') {
            lineStart--;
          }
          return lineStart;
        }
        return -1; // Not an object literal (probably function body)
      }
      braceDepth--;
    }
    i--;
  }
  
  return -1;
}

// ============================================================================
// Exports
// ============================================================================

export {
  rateLimitRecipe,
  auditRecipe,
  noPiiLoggingRecipe,
  inputValidationRecipe,
  encryptionRecipe,
};
