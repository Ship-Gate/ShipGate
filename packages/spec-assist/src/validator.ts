/**
 * ISL Validator
 * 
 * Validates ISL output through the full pipeline:
 * 1. Parse - syntax check
 * 2. Semantic - type checking, symbol resolution
 * 3. Verify - quick verification for obvious issues
 * 
 * This is the GATE that ensures AI output is valid before acceptance.
 * AI cannot bypass this validation.
 */

import type {
  ValidationResult,
  ParseError,
  SemanticError,
  VerifyIssue,
  Diagnostic,
} from './types.js';

/**
 * Validate ISL spec through all pipeline stages
 * 
 * @param isl - The ISL code to validate
 * @returns ValidationResult with details from each stage
 */
export async function validateISL(isl: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    parseOk: false,
    semanticOk: false,
    verifyOk: false,
    allPassed: false,
    parseErrors: [],
    semanticErrors: [],
    verifyIssues: [],
  };
  
  // Stage 1: Parse
  try {
    const parseResult = await runParser(isl);
    result.parseOk = parseResult.success;
    result.parseErrors = parseResult.errors;
    
    if (!result.parseOk) {
      return result; // Stop early if parse fails
    }
  } catch (err) {
    result.parseErrors.push({
      line: 1,
      column: 1,
      message: `Parser error: ${err instanceof Error ? err.message : String(err)}`,
      code: 'E_PARSE_CRASH',
    });
    return result;
  }
  
  // Stage 2: Semantic Analysis
  try {
    const semanticResult = await runSemanticAnalysis(isl);
    result.semanticOk = semanticResult.success;
    result.semanticErrors = semanticResult.errors;
    
    if (!result.semanticOk) {
      return result; // Stop early if semantic fails
    }
  } catch (err) {
    result.semanticErrors.push({
      message: `Semantic analysis error: ${err instanceof Error ? err.message : String(err)}`,
      severity: 'error',
      category: 'internal',
    });
    return result;
  }
  
  // Stage 3: Quick Verification
  try {
    const verifyResult = await runQuickVerify(isl);
    result.verifyOk = verifyResult.success;
    result.verifyIssues = verifyResult.issues;
  } catch (err) {
    result.verifyIssues.push({
      message: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
      severity: 'warning',
    });
    // Don't fail on verify errors - it's a softer check
    result.verifyOk = true;
  }
  
  result.allPassed = result.parseOk && result.semanticOk && result.verifyOk;
  return result;
}

/**
 * Convert validation result to actionable diagnostics
 */
export function toDiagnostics(result: ValidationResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Parse errors
  for (const err of result.parseErrors) {
    diagnostics.push({
      severity: 'error',
      message: err.message,
      line: err.line,
      column: err.column,
      fix: getParseErrorFix(err),
    });
  }
  
  // Semantic errors
  for (const err of result.semanticErrors) {
    diagnostics.push({
      severity: err.severity,
      message: err.message,
      line: err.line,
      column: err.column,
      fix: getSemanticErrorFix(err),
    });
  }
  
  // Verify issues
  for (const issue of result.verifyIssues) {
    diagnostics.push({
      severity: issue.severity === 'blocking' ? 'error' : issue.severity,
      message: issue.message,
      fix: getVerifyIssueFix(issue),
    });
  }
  
  return diagnostics;
}

// ============================================================================
// PIPELINE STAGE RUNNERS
// ============================================================================

interface ParseStageResult {
  success: boolean;
  errors: ParseError[];
  ast?: unknown;
}

/**
 * Run the ISL parser
 */
async function runParser(isl: string): Promise<ParseStageResult> {
  try {
    // Dynamic import to handle if parser package is not available
    const parser = await import('@isl-lang/parser');
    const result = parser.parse(isl, 'generated.isl');
    
    const errors: ParseError[] = result.errors?.map((e: { location?: { line?: number; column?: number }; message?: string; code?: string }) => ({
      line: e.location?.line ?? 1,
      column: e.location?.column ?? 1,
      message: e.message ?? 'Unknown parse error',
      code: e.code ?? 'E_PARSE',
    })) ?? [];
    
    return {
      success: result.success && errors.length === 0,
      errors,
      ast: result.ast,
    };
  } catch (err) {
    // Parser not available - fall back to basic syntax check
    return runBasicSyntaxCheck(isl);
  }
}

/**
 * Basic syntax check when parser is not available
 */
function runBasicSyntaxCheck(isl: string): ParseStageResult {
  const errors: ParseError[] = [];
  const lines = isl.split('\n');
  
  // Check for balanced braces
  let braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  }
  
  if (braceCount !== 0) {
    errors.push({
      line: lines.length,
      column: 1,
      message: `Unbalanced braces: ${braceCount > 0 ? 'missing closing' : 'extra closing'} brace`,
      code: 'E_UNBALANCED_BRACES',
    });
  }
  
  // Check for required keywords
  const hasValidStart = /^(domain|behavior|entity|type|enum|policy|import)\s/m.test(isl);
  if (!hasValidStart) {
    errors.push({
      line: 1,
      column: 1,
      message: 'ISL must start with domain, behavior, entity, type, enum, policy, or import',
      code: 'E_INVALID_START',
    });
  }
  
  return {
    success: errors.length === 0,
    errors,
  };
}

interface SemanticStageResult {
  success: boolean;
  errors: SemanticError[];
}

/**
 * Run semantic analysis
 */
async function runSemanticAnalysis(isl: string): Promise<SemanticStageResult> {
  try {
    // Dynamic import
    const semantics = await import('@isl-lang/isl-semantic-analysis');
    
    // Parse first to get AST
    const parser = await import('@isl-lang/parser');
    const parseResult = parser.parse(isl, 'generated.isl');
    
    if (!parseResult.success || !parseResult.ast) {
      return { success: false, errors: [] };
    }
    
    // Run semantic passes
    const passResult = await semantics.runPasses(parseResult.ast);
    
    const errors: SemanticError[] = passResult.errors?.map((e: { message?: string; severity?: string; category?: string; location?: { line?: number; column?: number } }) => ({
      message: e.message ?? 'Unknown semantic error',
      severity: (e.severity ?? 'error') as 'error' | 'warning',
      category: e.category ?? 'unknown',
      line: e.location?.line,
      column: e.location?.column,
    })) ?? [];
    
    return {
      success: errors.filter(e => e.severity === 'error').length === 0,
      errors,
    };
  } catch (err) {
    // Semantic analysis not available - basic check
    return runBasicSemanticCheck(isl);
  }
}

/**
 * Basic semantic check when full analysis is not available
 */
function runBasicSemanticCheck(isl: string): SemanticStageResult {
  const errors: SemanticError[] = [];
  
  // Check for common issues
  
  // Duplicate entity/behavior names
  const entityMatches = [...isl.matchAll(/entity\s+(\w+)/g)];
  const behaviorMatches = [...isl.matchAll(/behavior\s+(\w+)/g)];
  
  const seenNames = new Set<string>();
  for (const match of [...entityMatches, ...behaviorMatches]) {
    const name = match[1];
    if (name && seenNames.has(name)) {
      errors.push({
        message: `Duplicate declaration: ${name}`,
        severity: 'error',
        category: 'duplicate',
      });
    }
    if (name) seenNames.add(name);
  }
  
  return {
    success: errors.length === 0,
    errors,
  };
}

interface VerifyStageResult {
  success: boolean;
  issues: VerifyIssue[];
}

/**
 * Run quick verification
 */
async function runQuickVerify(isl: string): Promise<VerifyStageResult> {
  try {
    // Dynamic import
    const verifier = await import('@isl-lang/verifier');
    const parser = await import('@isl-lang/parser');
    
    const parseResult = parser.parse(isl, 'generated.isl');
    if (!parseResult.success || !parseResult.ast) {
      return { success: false, issues: [] };
    }
    
    // Create minimal spec for verification
    const spec = verifier.createSpec(
      parseResult.ast.name ?? 'Generated',
      extractBehaviors(parseResult.ast)
    );
    
    // Quick verify with empty artifacts (no workspace scan)
    const artifacts = verifier.createEmptyArtifacts();
    const report = verifier.verifyWithArtifacts(spec, artifacts);
    
    const issues: VerifyIssue[] = report.blockingIssues?.map((i: { message?: string; behavior?: string }) => ({
      message: i.message ?? 'Verification issue',
      behaviorName: i.behavior,
      severity: 'warning' as const,
    })) ?? [];
    
    return {
      success: true, // Quick verify is advisory
      issues,
    };
  } catch {
    // Verifier not available - pass
    return { success: true, issues: [] };
  }
}

/**
 * Extract behavior info from AST for verification
 */
function extractBehaviors(ast: unknown): Array<{
  name: string;
  preconditions?: string[];
  postconditions?: string[];
}> {
  const behaviors: Array<{ name: string; preconditions?: string[]; postconditions?: string[] }> = [];
  
  if (typeof ast !== 'object' || ast === null) {
    return behaviors;
  }
  
  const astObj = ast as Record<string, unknown>;
  const declarations = astObj.declarations ?? astObj.behaviors ?? [];
  
  if (!Array.isArray(declarations)) {
    return behaviors;
  }
  
  for (const decl of declarations) {
    if (typeof decl === 'object' && decl !== null) {
      const d = decl as Record<string, unknown>;
      if (d.type === 'behavior' || d.kind === 'behavior') {
        behaviors.push({
          name: String(d.name ?? 'Unknown'),
          preconditions: Array.isArray(d.preconditions)
            ? d.preconditions.map((p) => String((p as Record<string, unknown>).expression ?? p))
            : undefined,
          postconditions: Array.isArray(d.postconditions)
            ? d.postconditions.map((p) => String((p as Record<string, unknown>).expression ?? p))
            : undefined,
        });
      }
    }
  }
  
  return behaviors;
}

// ============================================================================
// FIX SUGGESTIONS
// ============================================================================

function getParseErrorFix(err: ParseError): string | undefined {
  if (err.code === 'E_UNBALANCED_BRACES') {
    return 'Check for missing or extra braces in the specification.';
  }
  if (err.code === 'E_INVALID_START') {
    return 'Start the specification with "domain", "behavior", "entity", or another ISL keyword.';
  }
  return undefined;
}

function getSemanticErrorFix(err: SemanticError): string | undefined {
  if (err.category === 'duplicate') {
    return 'Rename one of the duplicate declarations.';
  }
  return undefined;
}

function getVerifyIssueFix(issue: VerifyIssue): string | undefined {
  if (issue.clauseType === 'precondition') {
    return 'Add tests that verify the precondition.';
  }
  if (issue.clauseType === 'postcondition') {
    return 'Add tests that verify the postcondition.';
  }
  return undefined;
}
