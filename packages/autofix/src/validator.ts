/**
 * Fix Validator
 * 
 * Validates that fixes actually resolve the verification failures.
 */

import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import type { VerificationFailure } from './analyzer.js';
import type { Patch } from './patcher.js';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  passedChecks: string[];
  failedChecks: ValidationError[];
  newFailures: VerificationFailure[];
  compiles: boolean;
  compilationErrors?: string[];
}

export interface ValidationError {
  check: string;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface ValidatorOptions {
  runStaticAnalysis?: boolean;
  runTypeCheck?: boolean;
  mockVerification?: boolean;
  timeout?: number;
}

// ============================================================================
// Validator Class
// ============================================================================

export class FixValidator {
  private options: Required<ValidatorOptions>;

  constructor(
    _domain: DomainDeclaration,
    _behavior: BehaviorDeclaration,
    options: ValidatorOptions = {}
  ) {
    this.options = {
      runStaticAnalysis: options.runStaticAnalysis ?? true,
      runTypeCheck: options.runTypeCheck ?? true,
      mockVerification: options.mockVerification ?? false,
      timeout: options.timeout ?? 5000,
    };
  }

  /**
   * Validate that a fix resolves the original failure
   */
  async validate(
    originalFailure: VerificationFailure,
    patchedCode: string,
    patches: Patch[]
  ): Promise<ValidationResult> {
    const passedChecks: string[] = [];
    const failedChecks: ValidationError[] = [];
    const newFailures: VerificationFailure[] = [];

    // Check 1: Code compiles
    const compilationResult = this.checkCompilation(patchedCode);
    if (!compilationResult.success) {
      return {
        valid: false,
        passedChecks,
        failedChecks: [{
          check: 'compilation',
          expected: 'valid TypeScript',
          actual: 'compilation errors',
          message: compilationResult.errors?.join('; ') ?? 'Compilation failed',
        }],
        newFailures,
        compiles: false,
        compilationErrors: compilationResult.errors,
      };
    }
    passedChecks.push('compilation');

    // Check 2: Static analysis
    if (this.options.runStaticAnalysis) {
      const analysisResult = this.runStaticAnalysis(patchedCode, patches, originalFailure);
      if (analysisResult.valid) {
        passedChecks.push('static_analysis');
      } else {
        failedChecks.push(...analysisResult.errors);
      }
    }

    // Check 3: Verify fix addresses the specific failure
    const addressesFailure = this.verifyAddressesFailure(patchedCode, patches, originalFailure);
    if (addressesFailure.addresses) {
      passedChecks.push('addresses_failure');
    } else {
      failedChecks.push({
        check: 'addresses_failure',
        expected: 'fix to address original failure',
        actual: 'failure not addressed',
        message: addressesFailure.reason ?? 'Fix does not address the original failure',
      });
    }

    // Check 4: No obvious regressions
    const regressionCheck = this.checkForRegressions(patchedCode, patches);
    if (regressionCheck.clean) {
      passedChecks.push('no_regressions');
    } else {
      newFailures.push(...regressionCheck.potentialIssues);
    }

    // Check 5: Code quality
    const qualityCheck = this.checkCodeQuality(patchedCode);
    if (qualityCheck.acceptable) {
      passedChecks.push('code_quality');
    } else {
      failedChecks.push(...qualityCheck.issues);
    }

    return {
      valid: failedChecks.length === 0 && newFailures.length === 0,
      passedChecks,
      failedChecks,
      newFailures,
      compiles: true,
    };
  }

  /**
   * Quick validation - just check if code compiles
   */
  quickValidate(patchedCode: string): boolean {
    return this.checkCompilation(patchedCode).success;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private checkCompilation(code: string): { success: boolean; errors?: string[] } {
    try {
      // Use TypeScript compiler API for validation
      const ts = require('typescript');
      
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        reportDiagnostics: true,
      });

      if (result.diagnostics && result.diagnostics.length > 0) {
        const errors = result.diagnostics
          .filter((d: { category: number }) => d.category === ts.DiagnosticCategory.Error)
          .map((d: { messageText: string | { messageText: string } }) => 
            typeof d.messageText === 'string' 
              ? d.messageText 
              : d.messageText.messageText
          );

        if (errors.length > 0) {
          return { success: false, errors };
        }
      }

      return { success: true };
    } catch (error) {
      // If TypeScript isn't available, do basic syntax check
      try {
        // Check for balanced braces
        const openBraces = (code.match(/{/g) ?? []).length;
        const closeBraces = (code.match(/}/g) ?? []).length;
        if (openBraces !== closeBraces) {
          return { success: false, errors: ['Unbalanced braces'] };
        }

        // Check for obvious syntax errors
        const errorPatterns = [
          /\bfunction\s+\(/,  // function without name followed by (
          /\bconst\s*=/,      // const without name
          /\blet\s*=/,        // let without name
        ];

        for (const pattern of errorPatterns) {
          if (pattern.test(code)) {
            return { success: false, errors: ['Syntax error detected'] };
          }
        }

        return { success: true };
      } catch {
        return { success: false, errors: ['Could not validate code'] };
      }
    }
  }

  private runStaticAnalysis(
    code: string,
    _patches: Patch[],
    originalFailure: VerificationFailure
  ): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Check that patches make sense for the failure type
    switch (originalFailure.type) {
      case 'precondition':
        if (!code.includes('if') && !code.includes('throw')) {
          errors.push({
            check: 'precondition_check_added',
            expected: 'if statement with throw',
            actual: 'no condition check found',
            message: 'Precondition fix should add a validation check',
          });
        }
        break;

      case 'postcondition':
        // Check that the expected value is now used
        if (originalFailure.expected !== undefined) {
          const expectedStr = String(originalFailure.expected).toLowerCase();
          if (!code.toLowerCase().includes(expectedStr)) {
            errors.push({
              check: 'postcondition_value_fixed',
              expected: originalFailure.expected,
              actual: 'value not found in code',
              message: `Expected value "${originalFailure.expected}" not found in patched code`,
            });
          }
        }
        break;

      case 'error_handling':
        if (!code.includes('catch') && !code.includes('throw')) {
          errors.push({
            check: 'error_handling_added',
            expected: 'try-catch or throw statement',
            actual: 'no error handling found',
            message: 'Error handling fix should add try-catch or throw',
          });
        }
        break;

      case 'invariant':
        // Check for guard conditions or clamps
        if (!code.includes('Math.max') && !code.includes('Math.min') && !code.includes('if')) {
          errors.push({
            check: 'invariant_guard_added',
            expected: 'guard condition or value clamping',
            actual: 'no guard found',
            message: 'Invariant fix should add validation or clamping',
          });
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  private verifyAddressesFailure(
    code: string,
    patches: Patch[],
    originalFailure: VerificationFailure
  ): { addresses: boolean; reason?: string } {
    // Check that at least one patch relates to the failure
    const relatedPatches = patches.filter(p => {
      const descLower = p.description.toLowerCase();
      const predicateLower = originalFailure.predicate.toLowerCase();

      // Check for keyword overlap
      const keywords = predicateLower.match(/\b\w+\b/g) ?? [];
      return keywords.some(kw => 
        kw.length > 3 && descLower.includes(kw)
      );
    });

    if (relatedPatches.length === 0) {
      return { 
        addresses: false, 
        reason: 'No patches appear to relate to the original failure' 
      };
    }

    // Verify patch was actually applied (content appears in code)
    const patchApplied = relatedPatches.some(p => {
      if (p.replacement && code.includes(p.replacement)) return true;
      if (p.content && code.includes(p.content.trim().split('\n')[0] ?? '')) return true;
      return false;
    });

    if (!patchApplied) {
      return { 
        addresses: false, 
        reason: 'Patch content not found in the patched code' 
      };
    }

    return { addresses: true };
  }

  private checkForRegressions(
    code: string,
    patches: Patch[]
  ): { clean: boolean; potentialIssues: VerificationFailure[] } {
    const potentialIssues: VerificationFailure[] = [];

    // Check for removed functionality
    const deletionPatches = patches.filter(p => p.type === 'delete');
    for (const patch of deletionPatches) {
      if (patch.original && patch.original.includes('return')) {
        potentialIssues.push({
          type: 'unknown',
          predicate: 'return_statement_removed',
          message: 'A return statement was removed, which may break functionality',
        });
      }
    }

    // Check for infinite loops (basic)
    if (code.includes('while (true)') && !code.includes('break')) {
      potentialIssues.push({
        type: 'unknown',
        predicate: 'potential_infinite_loop',
        message: 'Potential infinite loop detected',
      });
    }

    // Check for obviously wrong patterns
    if (code.includes('throw new Error') && code.includes('// TODO')) {
      potentialIssues.push({
        type: 'unknown',
        predicate: 'incomplete_implementation',
        message: 'TODO comment found near error handling',
      });
    }

    return { clean: potentialIssues.length === 0, potentialIssues };
  }

  private checkCodeQuality(code: string): { acceptable: boolean; issues: ValidationError[] } {
    const issues: ValidationError[] = [];

    // Check for console.log in production code
    if (/console\.(log|debug)\(/.test(code)) {
      issues.push({
        check: 'no_console_log',
        expected: 'no console statements',
        actual: 'console.log found',
        message: 'Console statements should not be in production code',
      });
    }

    // Check for hardcoded credentials
    if (/['"][a-zA-Z0-9]{32,}['"]/.test(code) || /password\s*=\s*['"][^'"]+['"]/.test(code)) {
      issues.push({
        check: 'no_hardcoded_secrets',
        expected: 'no hardcoded secrets',
        actual: 'potential secret found',
        message: 'Potential hardcoded secret detected',
      });
    }

    // Check for empty catch blocks
    if (/catch\s*\([^)]*\)\s*{\s*}/.test(code)) {
      issues.push({
        check: 'no_empty_catch',
        expected: 'error handling in catch blocks',
        actual: 'empty catch block',
        message: 'Empty catch block swallows errors',
      });
    }

    return { acceptable: issues.length === 0, issues };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick validation of patched code
 */
export function quickValidate(code: string): boolean {
  try {
    // Basic syntax checks
    const openBraces = (code.match(/{/g) ?? []).length;
    const closeBraces = (code.match(/}/g) ?? []).length;
    if (openBraces !== closeBraces) return false;

    const openParens = (code.match(/\(/g) ?? []).length;
    const closeParens = (code.match(/\)/g) ?? []).length;
    if (openParens !== closeParens) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push(result.valid ? '✓ Validation PASSED' : '✗ Validation FAILED');
  lines.push('');

  if (result.passedChecks.length > 0) {
    lines.push('Passed checks:');
    for (const check of result.passedChecks) {
      lines.push(`  ✓ ${check}`);
    }
    lines.push('');
  }

  if (result.failedChecks.length > 0) {
    lines.push('Failed checks:');
    for (const check of result.failedChecks) {
      lines.push(`  ✗ ${check.check}: ${check.message}`);
    }
    lines.push('');
  }

  if (result.newFailures.length > 0) {
    lines.push('New potential failures:');
    for (const failure of result.newFailures) {
      lines.push(`  ⚠ ${failure.type}: ${failure.message}`);
    }
  }

  if (!result.compiles && result.compilationErrors) {
    lines.push('Compilation errors:');
    for (const error of result.compilationErrors) {
      lines.push(`  ${error}`);
    }
  }

  return lines.join('\n');
}
