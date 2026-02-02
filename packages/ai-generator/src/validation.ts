/**
 * Code Validation
 * 
 * Validates that generated code compiles and meets quality standards.
 */

import * as ts from 'typescript';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: CodeMetrics;
}

export interface ValidationError {
  type: 'syntax' | 'type' | 'semantic' | 'quality';
  message: string;
  line?: number;
  column?: number;
  code?: string;
}

export interface ValidationWarning {
  type: 'style' | 'complexity' | 'best-practice';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface CodeMetrics {
  lines: number;
  functions: number;
  complexity: number;
  hasExport: boolean;
  hasAsyncAwait: boolean;
  hasErrorHandling: boolean;
}

export interface ValidationOptions {
  language: string;
  strict?: boolean;
  checkTypes?: boolean;
  maxComplexity?: number;
}

/**
 * Validate generated code
 */
export function validateCode(
  code: string,
  options: ValidationOptions
): ValidationResult {
  const { language, strict = true, checkTypes = true, maxComplexity = 15 } = options;

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const metrics = calculateMetrics(code);

  // Language-specific validation
  if (language.toLowerCase() === 'typescript' || language.toLowerCase() === 'ts') {
    const tsValidation = validateTypeScript(code, checkTypes);
    errors.push(...tsValidation.errors);
    warnings.push(...tsValidation.warnings);
  } else if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'js') {
    const jsValidation = validateJavaScript(code);
    errors.push(...jsValidation.errors);
    warnings.push(...jsValidation.warnings);
  }

  // Quality checks
  const qualityChecks = validateQuality(code, strict, maxComplexity);
  errors.push(...qualityChecks.errors);
  warnings.push(...qualityChecks.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics,
  };
}

/**
 * Validate TypeScript code
 */
function validateTypeScript(
  code: string,
  checkTypes: boolean
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Create a virtual TypeScript program
  const fileName = 'generated.ts';
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
  };

  // Create source file
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS
  );

  // Check for syntax errors by walking the AST
  const syntaxErrors = findSyntaxErrors(sourceFile);
  errors.push(...syntaxErrors);

  // Type checking (if enabled)
  if (checkTypes) {
    const host = createCompilerHost(code, fileName, compilerOptions);
    const program = ts.createProgram([fileName], compilerOptions, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    for (const diagnostic of diagnostics) {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          errors.push({
            type: 'type',
            message,
            line: line + 1,
            column: character + 1,
            code: `TS${diagnostic.code}`,
          });
        } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
          warnings.push({
            type: 'style',
            message,
            line: line + 1,
          });
        }
      }
    }
  }

  // Check for 'any' type usage
  if (code.includes(': any') || code.includes('<any>') || code.includes('as any')) {
    warnings.push({
      type: 'best-practice',
      message: 'Usage of "any" type detected. Consider using more specific types.',
      suggestion: 'Replace "any" with "unknown" or a specific type',
    });
  }

  return { errors, warnings };
}

/**
 * Validate JavaScript code
 */
function validateJavaScript(
  code: string
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Create source file with JavaScript
  try {
    const sourceFile = ts.createSourceFile(
      'generated.js',
      code,
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.JS
    );

    const syntaxErrors = findSyntaxErrors(sourceFile);
    errors.push(...syntaxErrors);
  } catch (err) {
    errors.push({
      type: 'syntax',
      message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { errors, warnings };
}

/**
 * Find syntax errors in source file
 */
function findSyntaxErrors(sourceFile: ts.SourceFile): ValidationError[] {
  const errors: ValidationError[] = [];

  function visit(node: ts.Node) {
    // Check for parse errors
    if (node.kind === ts.SyntaxKind.Unknown) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      errors.push({
        type: 'syntax',
        message: 'Unknown syntax element',
        line: line + 1,
        column: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return errors;
}

/**
 * Validate code quality
 */
function validateQuality(
  code: string,
  strict: boolean,
  maxComplexity: number
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for exports
  if (!code.includes('export')) {
    if (strict) {
      errors.push({
        type: 'quality',
        message: 'No export statement found. Generated code must export the behavior function.',
      });
    } else {
      warnings.push({
        type: 'best-practice',
        message: 'No export statement found',
        suggestion: 'Add export to make the function available',
      });
    }
  }

  // Check for console statements
  if (/console\.(log|warn|error|debug)/.test(code)) {
    warnings.push({
      type: 'best-practice',
      message: 'Console statements detected',
      suggestion: 'Use a proper logger for production code',
    });
  }

  // Check for TODO/FIXME comments
  const todoMatches = code.match(/\/\/\s*(TODO|FIXME|XXX|HACK)/gi);
  if (todoMatches) {
    warnings.push({
      type: 'best-practice',
      message: `${todoMatches.length} TODO/FIXME comment(s) detected`,
      suggestion: 'Complete or remove before using in production',
    });
  }

  // Check for hardcoded values that might be secrets
  if (/['"]sk-[a-zA-Z0-9]+['"]/.test(code) || /['"][a-zA-Z0-9]{32,}['"]/.test(code)) {
    errors.push({
      type: 'quality',
      message: 'Possible hardcoded secret/API key detected',
    });
  }

  // Check complexity
  const complexity = estimateComplexity(code);
  if (complexity > maxComplexity) {
    warnings.push({
      type: 'complexity',
      message: `High cyclomatic complexity: ${complexity} (max: ${maxComplexity})`,
      suggestion: 'Consider breaking down into smaller functions',
    });
  }

  // Check for error handling
  const hasErrorHandling = 
    code.includes('try') && code.includes('catch') ||
    code.includes('throw') ||
    code.includes('.catch(');
  
  if (!hasErrorHandling && strict) {
    warnings.push({
      type: 'best-practice',
      message: 'No explicit error handling detected',
      suggestion: 'Add try/catch or error checks for robustness',
    });
  }

  return { errors, warnings };
}

/**
 * Calculate code metrics
 */
function calculateMetrics(code: string): CodeMetrics {
  const lines = code.split('\n').filter(line => line.trim().length > 0).length;
  
  // Count functions (approximate)
  const functionMatches = code.match(/function\s+\w+|=>\s*{|\(\)\s*=>/g) ?? [];
  const functions = functionMatches.length;

  const complexity = estimateComplexity(code);
  
  const hasExport = /export\s+(function|const|class|async|default)/.test(code);
  const hasAsyncAwait = /async|await/.test(code);
  const hasErrorHandling = 
    (code.includes('try') && code.includes('catch')) ||
    code.includes('throw');

  return {
    lines,
    functions,
    complexity,
    hasExport,
    hasAsyncAwait,
    hasErrorHandling,
  };
}

/**
 * Estimate cyclomatic complexity
 */
function estimateComplexity(code: string): number {
  let complexity = 1; // Base complexity

  // Count decision points
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\?\s*[^:]/g, // Ternary
    /\|\|/g,      // Logical OR
    /&&/g,        // Logical AND
    /\bcatch\s*\(/g,
  ];

  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Create a minimal compiler host for type checking
 */
function createCompilerHost(
  code: string,
  fileName: string,
  _options: ts.CompilerOptions
): ts.CompilerHost {
  return {
    getSourceFile: (name) => {
      if (name === fileName) {
        return ts.createSourceFile(name, code, ts.ScriptTarget.ES2020, true);
      }
      return undefined;
    },
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    fileExists: (name) => name === fileName,
    readFile: (name) => name === fileName ? code : undefined,
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
}

/**
 * Quick validation - just check if code parses
 */
export function quickValidate(code: string, language: string): boolean {
  try {
    if (language.toLowerCase() === 'typescript' || language.toLowerCase() === 'ts') {
      ts.createSourceFile('temp.ts', code, ts.ScriptTarget.ES2020, true);
    } else {
      ts.createSourceFile('temp.js', code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Format validation result as string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Validation passed');
  } else {
    lines.push('✗ Validation failed');
  }

  lines.push('');
  lines.push('Metrics:');
  lines.push(`  Lines: ${result.metrics.lines}`);
  lines.push(`  Functions: ${result.metrics.functions}`);
  lines.push(`  Complexity: ${result.metrics.complexity}`);
  lines.push(`  Has Export: ${result.metrics.hasExport}`);
  lines.push(`  Has Async/Await: ${result.metrics.hasAsyncAwait}`);
  lines.push(`  Has Error Handling: ${result.metrics.hasErrorHandling}`);

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      const location = error.line ? ` (line ${error.line})` : '';
      lines.push(`  ✗ [${error.type}]${location}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      const location = warning.line ? ` (line ${warning.line})` : '';
      lines.push(`  ⚠ [${warning.type}]${location}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    → ${warning.suggestion}`);
      }
    }
  }

  return lines.join('\n');
}
