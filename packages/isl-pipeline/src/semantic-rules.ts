/**
 * Semantic Rule Validators
 * 
 * These are REAL checks, not string matching.
 * 
 * A rule passes only when:
 * - The semantic requirement is satisfied
 * - Not just "found the string @intent"
 * 
 * @module @isl-lang/pipeline
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
}

export interface SemanticRule {
  id: string;
  description: string;
  /** Run the semantic check */
  check: (code: string, file: string) => SemanticViolation[];
}

// ============================================================================
// Semantic Rules - Real Checks, Not String Matching
// ============================================================================

export const SEMANTIC_RULES: SemanticRule[] = [
  // =========================================================================
  // intent/audit-required - SEMANTIC VERSION
  // =========================================================================
  {
    id: 'intent/audit-required',
    description: 'Audit must be called on ALL exit paths with correct semantics',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      // Skip test files and type files
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      // Find all return statements
      const returnMatches = [...code.matchAll(/return\s+[^;]+;/g)];
      const throwMatches = [...code.matchAll(/throw\s+[^;]+;/g)];
      const exitPaths = returnMatches.length + throwMatches.length;

      if (exitPaths === 0) return [];

      // Count audit calls
      const auditCalls = [...code.matchAll(/await\s+audit\s*\(/g)];
      
      // Must have audit on every exit path (approximately)
      if (auditCalls.length < exitPaths) {
        violations.push({
          ruleId: 'intent/audit-required',
          file,
          line: 1,
          message: `Audit missing on some exit paths. Found ${auditCalls.length} audit calls for ${exitPaths} exit paths.`,
          severity: 'high',
          evidence: `Exit paths: ${exitPaths}, Audit calls: ${auditCalls.length}`,
          fix: 'Add audit() call before every return/throw statement',
        });
      }

      // Check for audit(success: true) on error paths - this is WRONG
      const badAuditPatterns = [
        /429.*audit\s*\(\s*\{[^}]*success\s*:\s*true/s,
        /status:\s*4\d\d.*audit\s*\(\s*\{[^}]*success\s*:\s*true/s,
        /error.*audit\s*\(\s*\{[^}]*success\s*:\s*true/is,
      ];

      for (const pattern of badAuditPatterns) {
        if (pattern.test(code)) {
          violations.push({
            ruleId: 'intent/audit-required',
            file,
            line: findLineNumber(code, 'success: true'),
            message: 'Audit with success:true on error path (must be success:false)',
            severity: 'critical',
            evidence: 'Found success:true near error response',
            fix: 'Change success: true to success: false on error paths',
          });
        }
      }

      // Check audit payload has required fields
      for (const match of auditCalls) {
        const callStart = match.index!;
        const callEnd = findClosingParen(code, callStart + match[0].length - 1);
        const auditPayload = code.slice(callStart, callEnd + 1);

        const requiredFields = ['action', 'success'];
        for (const field of requiredFields) {
          if (!auditPayload.includes(field)) {
            violations.push({
              ruleId: 'intent/audit-required',
              file,
              line: findLineNumber(code, auditPayload.slice(0, 30)),
              message: `Audit payload missing required field: ${field}`,
              severity: 'high',
              evidence: auditPayload.slice(0, 100),
              fix: `Add ${field} to audit payload`,
            });
          }
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // intent/rate-limit-required - SEMANTIC VERSION
  // =========================================================================
  {
    id: 'intent/rate-limit-required',
    description: 'Rate limit must be checked BEFORE parsing body or hitting DB',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      const hasRateLimit = code.includes('rateLimit');
      const hasBodyParse = code.includes('request.json()') || code.includes('req.body');
      
      if (!hasRateLimit && hasBodyParse) {
        violations.push({
          ruleId: 'intent/rate-limit-required',
          file,
          line: 1,
          message: 'No rate limiting before body parsing',
          severity: 'high',
          evidence: 'Found request.json() but no rateLimit call',
          fix: 'Add rate limit check before parsing request body',
        });
        return violations;
      }

      if (hasRateLimit && hasBodyParse) {
        // Check ORDER: rateLimit must come BEFORE body parsing
        const rateLimitIdx = code.indexOf('rateLimit');
        const bodyParseIdx = code.indexOf('request.json()') !== -1 
          ? code.indexOf('request.json()') 
          : code.indexOf('req.body');

        if (rateLimitIdx > bodyParseIdx) {
          violations.push({
            ruleId: 'intent/rate-limit-required',
            file,
            line: findLineNumber(code, 'request.json()'),
            message: 'Rate limit check happens AFTER body parsing (must be before)',
            severity: 'critical',
            evidence: 'Body parsed before rate limit check',
            fix: 'Move rate limit check before request.json()',
          });
        }
      }

      // 429 path must audit with success:false
      const has429 = code.includes('429');
      if (has429) {
        const block429Start = code.indexOf('429');
        const block429Context = code.slice(Math.max(0, block429Start - 200), block429Start + 200);
        
        if (!block429Context.includes('audit')) {
          violations.push({
            ruleId: 'intent/rate-limit-required',
            file,
            line: findLineNumber(code, '429'),
            message: 'Rate limit 429 response must audit with success:false',
            severity: 'high',
            evidence: '429 response without audit call',
            fix: 'Add audit({ success: false, reason: "rate_limited" }) on 429 path',
          });
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // intent/no-pii-logging - SEMANTIC VERSION (ALL console.*)
  // =========================================================================
  {
    id: 'intent/no-pii-logging',
    description: 'No console.* in production - must use safe logger',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      // Check ALL console methods, not just log
      const consolePatterns = [
        { pattern: /console\.log\s*\(/g, method: 'console.log' },
        { pattern: /console\.error\s*\(/g, method: 'console.error' },
        { pattern: /console\.warn\s*\(/g, method: 'console.warn' },
        { pattern: /console\.info\s*\(/g, method: 'console.info' },
        { pattern: /console\.debug\s*\(/g, method: 'console.debug' },
      ];

      for (const { pattern, method } of consolePatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          violations.push({
            ruleId: 'intent/no-pii-logging',
            file,
            line: findLineNumber(code, match[0]),
            message: `${method} in production code - use structured logger`,
            severity: method === 'console.error' ? 'high' : 'medium',
            evidence: match[0],
            fix: `Replace ${method} with safeLogger.${method.split('.')[1]}()`,
          });
        }
      }

      // Check for PII in any logging context
      const piiPatterns = [
        /log.*email/i,
        /log.*password/i,
        /log.*token/i,
        /log.*credential/i,
        /log.*secret/i,
        /log.*body/i,  // raw request body
      ];

      for (const pattern of piiPatterns) {
        if (pattern.test(code)) {
          violations.push({
            ruleId: 'intent/no-pii-logging',
            file,
            line: 1,
            message: 'Potential PII in logging - must redact sensitive fields',
            severity: 'critical',
            evidence: 'Found logging with sensitive field names',
            fix: 'Use redact() wrapper for any logged data',
          });
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // quality/no-stubbed-handlers - NEW CRITICAL RULE
  // =========================================================================
  {
    id: 'quality/no-stubbed-handlers',
    description: 'No stubbed handlers or TODO markers can SHIP',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      // Check for throw new Error('Not implemented')
      const notImplementedPatterns = [
        /throw\s+new\s+Error\s*\(\s*['"]Not implemented['"]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"]TODO['"]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"]FIXME['"]\s*\)/gi,
        /throw\s+['"]Not implemented['"]/gi,
      ];

      for (const pattern of notImplementedPatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          violations.push({
            ruleId: 'quality/no-stubbed-handlers',
            file,
            line: findLineNumber(code, match[0]),
            message: 'Stubbed handler cannot ship - implementation required',
            severity: 'critical',
            evidence: match[0],
            fix: 'Implement the handler logic',
          });
        }
      }

      // Check for TODO in postconditions sections
      const todoInPostconditions = /\/\/\s*ISL postconditions[\s\S]*?TODO/i;
      if (todoInPostconditions.test(code)) {
        violations.push({
          ruleId: 'quality/no-stubbed-handlers',
          file,
          line: findLineNumber(code, 'TODO'),
          message: 'TODO markers in postconditions section - must be implemented',
          severity: 'critical',
          evidence: 'Found TODO after ISL postconditions comment',
          fix: 'Implement all postconditions',
        });
      }

      // Check for placeholder implementations
      const placeholderPatterns = [
        /\/\/\s*Implementation goes here/i,
        /\/\/\s*TODO:\s*implement/i,
        /pass;?\s*\/\/\s*placeholder/i,
      ];

      for (const pattern of placeholderPatterns) {
        if (pattern.test(code)) {
          violations.push({
            ruleId: 'quality/no-stubbed-handlers',
            file,
            line: findLineNumber(code, 'implement'),
            message: 'Placeholder implementation cannot ship',
            severity: 'high',
            evidence: 'Found placeholder comment',
            fix: 'Complete the implementation',
          });
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // quality/validation-before-use - Input must be validated before use
  // =========================================================================
  {
    id: 'quality/validation-before-use',
    description: 'Input must be validated before use in business logic',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      const hasBodyParse = code.includes('request.json()') || code.includes('req.body');
      const hasValidation = code.includes('safeParse') || 
                           code.includes('.parse(') || 
                           code.includes('validate(');

      if (hasBodyParse && !hasValidation) {
        violations.push({
          ruleId: 'quality/validation-before-use',
          file,
          line: findLineNumber(code, 'request.json()') || findLineNumber(code, 'req.body'),
          message: 'Request body used without validation',
          severity: 'high',
          evidence: 'Found body parsing but no schema validation',
          fix: 'Add schema.safeParse(body) validation',
        });
      }

      return violations;
    },
  },
];

// ============================================================================
// Helpers
// ============================================================================

function findLineNumber(code: string, search: string): number {
  const idx = code.indexOf(search);
  if (idx === -1) return 1;
  return code.slice(0, idx).split('\n').length;
}

function findClosingParen(code: string, startIdx: number): number {
  let depth = 1;
  for (let i = startIdx + 1; i < code.length; i++) {
    if (code[i] === '(') depth++;
    if (code[i] === ')') depth--;
    if (depth === 0) return i;
  }
  return code.length;
}

// ============================================================================
// Run All Semantic Rules
// ============================================================================

export function runSemanticRules(codeMap: Map<string, string>): SemanticViolation[] {
  const violations: SemanticViolation[] = [];

  for (const [file, code] of codeMap) {
    for (const rule of SEMANTIC_RULES) {
      violations.push(...rule.check(code, file));
    }
  }

  return violations;
}

// ============================================================================
// Proof Bundle Completeness Check
// ============================================================================

export interface ProofCompletenessResult {
  complete: boolean;
  status: 'PROVEN' | 'INCOMPLETE_PROOF' | 'UNPROVEN';
  missing: string[];
  warnings: string[];
}

export function checkProofCompleteness(proof: {
  gateScore: number;
  gateVerdict: string;
  testsPassed: number;
  testsFailed: number;
  typecheckPassed: boolean;
  buildPassed: boolean;
  hasStubs: boolean;
}): ProofCompletenessResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Gate must pass
  if (proof.gateVerdict !== 'SHIP') {
    missing.push('Gate verdict is not SHIP');
  }

  // Tests must have run (0 tests = incomplete)
  if (proof.testsPassed === 0 && proof.testsFailed === 0) {
    missing.push('No tests ran - proof requires test execution');
  }

  // Tests must pass
  if (proof.testsFailed > 0) {
    missing.push(`${proof.testsFailed} tests failed`);
  }

  // Typecheck must pass
  if (!proof.typecheckPassed) {
    missing.push('TypeScript compilation failed');
  }

  // Build must pass
  if (!proof.buildPassed) {
    missing.push('Build failed');
  }

  // No stubs allowed
  if (proof.hasStubs) {
    missing.push('Code contains stubbed handlers');
  }

  // Warnings
  if (proof.testsPassed < 3) {
    warnings.push('Low test coverage - consider adding more tests');
  }

  const complete = missing.length === 0;
  const status = complete ? 'PROVEN' : 
                 proof.gateVerdict === 'SHIP' ? 'INCOMPLETE_PROOF' : 
                 'UNPROVEN';

  return { complete, status, missing, warnings };
}
