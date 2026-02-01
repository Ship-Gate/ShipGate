// ============================================================================
// Verify implementation using @isl-bindings as primary evidence
// ============================================================================

import type {
  BindingEntry,
  ParsedBindings,
  ClauseResult,
  ClauseStatus,
  HeuristicMatch,
  VerificationNote,
} from './types.js';

/**
 * Clause information from ISL spec
 */
export interface ClauseInfo {
  id: string;
  type: 'precondition' | 'postcondition' | 'invariant';
  expression: string;
  description?: string;
}

/**
 * Source location info for verification
 */
export interface SourceInfo {
  line: number;
  column?: number;
  code: string;
}

/**
 * Context for binding verification
 */
export interface BindingVerificationContext {
  sourceCode: string;
  sourceLines: string[];
  functionLocations: Map<string, { start: number; end: number }>;
}

/**
 * Verify a clause using explicit bindings
 */
export function verifyClauseFromBindings(
  clause: ClauseInfo,
  bindings: BindingEntry[],
  context: BindingVerificationContext
): ClauseResult {
  const notes: VerificationNote[] = [];
  
  if (bindings.length === 0) {
    return {
      clauseId: clause.id,
      status: 'FAIL',
      evidence: 'bindings',
      notes: [{
        level: 'error',
        message: `No bindings found for clause ${clause.id}`,
      }],
      bindings: [],
    };
  }

  // Check each binding
  let hasGuard = false;
  let hasAssert = false;
  let hasTest = false;
  let validBindings = 0;

  for (const binding of bindings) {
    const locationValid = verifyLocation(binding, context);
    
    if (locationValid.valid) {
      validBindings++;
      
      switch (binding.type) {
        case 'guard':
          hasGuard = true;
          notes.push({
            level: 'info',
            message: `Guard found at ${binding.location}`,
            location: binding.location,
          });
          break;
        case 'assert':
          hasAssert = true;
          notes.push({
            level: 'info',
            message: `Assertion found at ${binding.location}`,
            location: binding.location,
          });
          break;
        case 'test':
          hasTest = true;
          notes.push({
            level: 'info',
            message: `Test found at ${binding.location}`,
            location: binding.location,
          });
          break;
      }
    } else {
      notes.push({
        level: 'warning',
        message: `Could not verify location: ${binding.location} - ${locationValid.error}`,
        location: binding.location,
      });
    }
  }

  // Determine status based on coverage
  const status = determineStatus(
    clause.type,
    validBindings,
    bindings.length,
    { hasGuard, hasAssert, hasTest }
  );

  return {
    clauseId: clause.id,
    status,
    evidence: 'bindings',
    notes,
    bindings,
  };
}

/**
 * Verify that a binding location exists in source
 */
function verifyLocation(
  binding: BindingEntry,
  context: BindingVerificationContext
): { valid: boolean; error?: string } {
  const location = binding.location;

  // Line number format: L42 or L42-L50
  const lineMatch = /^L(\d+)(?:-L(\d+))?$/.exec(location);
  if (lineMatch) {
    const startLine = parseInt(lineMatch[1]!, 10);
    const endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : startLine;
    
    if (startLine < 1 || startLine > context.sourceLines.length) {
      return { valid: false, error: `Line ${startLine} out of range` };
    }
    if (endLine < startLine || endLine > context.sourceLines.length) {
      return { valid: false, error: `Line range ${startLine}-${endLine} invalid` };
    }
    
    return { valid: true };
  }

  // Function reference format: fn:functionName or just functionName
  const fnMatch = /^(?:fn:)?([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(location);
  if (fnMatch) {
    const fnName = fnMatch[1]!;
    if (context.functionLocations.has(fnName)) {
      return { valid: true };
    }
    
    // Fallback: search for function in source
    const fnRegex = new RegExp(
      `(?:function\\s+${fnName}|const\\s+${fnName}\\s*=|${fnName}\\s*\\()`,
      'g'
    );
    if (fnRegex.test(context.sourceCode)) {
      return { valid: true };
    }
    
    return { valid: false, error: `Function '${fnName}' not found` };
  }

  // Method reference: Class.method
  const methodMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(location);
  if (methodMatch) {
    const [, className, methodName] = methodMatch;
    const methodRegex = new RegExp(
      `(?:class\\s+${className}[^{]*\\{[^}]*${methodName}\\s*\\(|${className}\\.${methodName})`,
      's'
    );
    if (methodRegex.test(context.sourceCode)) {
      return { valid: true };
    }
    return { valid: false, error: `Method '${className}.${methodName}' not found` };
  }

  return { valid: false, error: 'Unknown location format' };
}

/**
 * Determine clause status based on binding coverage
 */
function determineStatus(
  clauseType: ClauseInfo['type'],
  validBindings: number,
  totalBindings: number,
  coverage: { hasGuard: boolean; hasAssert: boolean; hasTest: boolean }
): ClauseStatus {
  // No valid bindings at all
  if (validBindings === 0) {
    return 'FAIL';
  }

  // All bindings valid
  if (validBindings === totalBindings) {
    // For preconditions, prefer guards
    if (clauseType === 'precondition') {
      return coverage.hasGuard ? 'PASS' : 'PARTIAL';
    }
    
    // For postconditions, prefer asserts or tests
    if (clauseType === 'postcondition') {
      return (coverage.hasAssert || coverage.hasTest) ? 'PASS' : 'PARTIAL';
    }
    
    // For invariants, any valid binding is good
    return 'PASS';
  }

  // Partial bindings valid
  return 'PARTIAL';
}

/**
 * Build verification context from source code
 */
export function buildVerificationContext(
  sourceCode: string
): BindingVerificationContext {
  const sourceLines = sourceCode.split('\n');
  const functionLocations = extractFunctionLocations(sourceCode);

  return {
    sourceCode,
    sourceLines,
    functionLocations,
  };
}

/**
 * Extract function locations from source code
 */
function extractFunctionLocations(
  sourceCode: string
): Map<string, { start: number; end: number }> {
  const locations = new Map<string, { start: number; end: number }>();
  const lines = sourceCode.split('\n');

  // Simple function detection patterns
  const patterns = [
    /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
    /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\(/,
    /([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match && match[1]) {
        // Find end of function (simple brace counting)
        const end = findFunctionEnd(lines, i);
        locations.set(match[1], { start: i + 1, end: end + 1 });
        break;
      }
    }
  }

  return locations;
}

/**
 * Find the end of a function by counting braces
 */
function findFunctionEnd(lines: string[], startLine: number): number {
  let braceCount = 0;
  let started = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]!;
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return i;
        }
      }
    }
  }

  return lines.length - 1;
}

/**
 * Score for heuristic matching confidence
 */
export function calculateHeuristicConfidence(
  match: HeuristicMatch,
  clause: ClauseInfo
): number {
  let confidence = 0.3; // Base confidence

  // Boost for matching type
  if (
    (clause.type === 'precondition' && match.type === 'guard') ||
    (clause.type === 'postcondition' && (match.type === 'assert' || match.type === 'test')) ||
    (clause.type === 'invariant' && match.type === 'assert')
  ) {
    confidence += 0.3;
  }

  // Boost for keyword matches in code
  const keywords = clause.expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  const matchingKeywords = keywords.filter(kw => 
    match.code.toLowerCase().includes(kw.toLowerCase())
  );
  
  if (keywords.length > 0) {
    confidence += 0.4 * (matchingKeywords.length / keywords.length);
  }

  return Math.min(confidence, 1.0);
}
