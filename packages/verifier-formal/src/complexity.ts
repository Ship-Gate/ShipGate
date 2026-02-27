// ============================================================================
// SMT Query Complexity Analyzer
// Determines if a query is tractable before sending to solver
// ============================================================================

import type { ComplexityAnalysis, ComplexityMetric, UnknownReason } from './verdict';
import { createComplexityReason, createQuantifierInstantiationReason, createNonlinearArithmeticReason } from './verdict';

// ============================================================================
// COMPLEXITY LIMITS
// ============================================================================

export interface ComplexityLimits {
  maxAstDepth: number;
  maxQuantifierAlternations: number;
  maxVariableCount: number;
  maxConstraintCount: number;
  maxQuantifierCount: number;
  allowNonlinearArithmetic: boolean;
  allowStringTheory: boolean;
}

export const DEFAULT_LIMITS: ComplexityLimits = {
  maxAstDepth: 50,
  maxQuantifierAlternations: 2,
  maxVariableCount: 100,
  maxConstraintCount: 200,
  maxQuantifierCount: 10,
  allowNonlinearArithmetic: false,
  allowStringTheory: true,
};

export const STRICT_LIMITS: ComplexityLimits = {
  maxAstDepth: 20,
  maxQuantifierAlternations: 1,
  maxVariableCount: 30,
  maxConstraintCount: 50,
  maxQuantifierCount: 5,
  allowNonlinearArithmetic: false,
  allowStringTheory: true,
};

export const PERMISSIVE_LIMITS: ComplexityLimits = {
  maxAstDepth: 100,
  maxQuantifierAlternations: 3,
  maxVariableCount: 500,
  maxConstraintCount: 1000,
  maxQuantifierCount: 20,
  allowNonlinearArithmetic: true,
  allowStringTheory: true,
};

// ============================================================================
// COMPLEXITY ANALYSIS
// ============================================================================

/**
 * Analyze SMT-LIB query complexity
 */
export function analyzeComplexity(smtLib: string): ComplexityAnalysis {
  const astDepth = measureAstDepth(smtLib);
  const quantifierInfo = analyzeQuantifiers(smtLib);
  const variableCount = countVariables(smtLib);
  const constraintCount = countConstraints(smtLib);
  const theories = detectTheories(smtLib);

  const analysis: ComplexityAnalysis = {
    astDepth,
    quantifierCount: quantifierInfo.total,
    quantifierAlternations: quantifierInfo.alternations,
    variableCount,
    constraintCount,
    usesNonlinearArithmetic: theories.nonlinear,
    usesStrings: theories.strings,
    usesArrays: theories.arrays,
    usesQuantifiers: quantifierInfo.total > 0,
    estimatedDifficulty: 'trivial',
  };

  analysis.estimatedDifficulty = estimateDifficulty(analysis);

  return analysis;
}

/**
 * Check if query exceeds complexity limits
 * Returns null if within limits, or an UnknownReason if exceeded
 */
export function checkComplexityLimits(
  analysis: ComplexityAnalysis,
  limits: ComplexityLimits = DEFAULT_LIMITS
): UnknownReason | null {
  // Check AST depth
  if (analysis.astDepth > limits.maxAstDepth) {
    return createComplexityReason('ast-depth', limits.maxAstDepth, analysis.astDepth);
  }

  // Check quantifier alternations
  if (analysis.quantifierAlternations > limits.maxQuantifierAlternations) {
    return createComplexityReason(
      'quantifier-alternations',
      limits.maxQuantifierAlternations,
      analysis.quantifierAlternations
    );
  }

  // Check variable count
  if (analysis.variableCount > limits.maxVariableCount) {
    return createComplexityReason('variable-count', limits.maxVariableCount, analysis.variableCount);
  }

  // Check constraint count
  if (analysis.constraintCount > limits.maxConstraintCount) {
    return createComplexityReason('constraint-count', limits.maxConstraintCount, analysis.constraintCount);
  }

  // Check quantifier count
  if (analysis.quantifierCount > limits.maxQuantifierCount) {
    return createQuantifierInstantiationReason(analysis.quantifierCount, limits.maxQuantifierCount);
  }

  // Check nonlinear arithmetic
  if (analysis.usesNonlinearArithmetic && !limits.allowNonlinearArithmetic) {
    return createNonlinearArithmeticReason(['multiplication', 'division', 'exponentiation']);
  }

  return null;
}

// ============================================================================
// MEASUREMENT FUNCTIONS
// ============================================================================

function measureAstDepth(smtLib: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  let inString = false;

  for (let i = 0; i < smtLib.length; i++) {
    const char = smtLib[i];
    const prev = smtLib[i - 1];

    if (char === '"' && prev !== '\\') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '(') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === ')') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maxDepth;
}

interface QuantifierInfo {
  total: number;
  forall: number;
  exists: number;
  alternations: number;
}

function analyzeQuantifiers(smtLib: string): QuantifierInfo {
  const forallMatches = smtLib.match(/\(forall\s/g) || [];
  const existsMatches = smtLib.match(/\(exists\s/g) || [];

  const forall = forallMatches.length;
  const exists = existsMatches.length;
  const total = forall + exists;

  // Count alternations by looking for nested quantifiers of different types
  let alternations = 0;
  const quantifierPattern = /\((forall|exists)\s/g;
  const matches: Array<{ type: string; index: number }> = [];
  let match;

  while ((match = quantifierPattern.exec(smtLib)) !== null) {
    matches.push({ type: match[1], index: match.index });
  }

  // Check for alternations by looking at nesting
  for (let i = 1; i < matches.length; i++) {
    const prev = matches[i - 1];
    const curr = matches[i];
    
    // Check if curr is nested inside prev (simplified check)
    const between = smtLib.slice(prev.index, curr.index);
    const openParens = (between.match(/\(/g) || []).length;
    const closeParens = (between.match(/\)/g) || []).length;
    
    if (openParens > closeParens && prev.type !== curr.type) {
      alternations++;
    }
  }

  return { total, forall, exists, alternations };
}

function countVariables(smtLib: string): number {
  // Count declare-const and declare-fun with no arguments
  const declareConst = (smtLib.match(/\(declare-const\s/g) || []).length;
  const declareFun = (smtLib.match(/\(declare-fun\s+\S+\s+\(\s*\)/g) || []).length;
  
  // Count quantifier-bound variables
  const quantifierVars = (smtLib.match(/\(forall\s+\(\(|\(exists\s+\(\(/g) || []).length;

  return declareConst + declareFun + quantifierVars;
}

function countConstraints(smtLib: string): number {
  // Count assert statements
  return (smtLib.match(/\(assert\s/g) || []).length;
}

interface TheoryUsage {
  nonlinear: boolean;
  strings: boolean;
  arrays: boolean;
  bitvectors: boolean;
  datatypes: boolean;
}

function detectTheories(smtLib: string): TheoryUsage {
  return {
    // Nonlinear: multiplication of variables, division, power
    nonlinear: detectNonlinearArithmetic(smtLib),
    
    // String theory
    strings: /str\.(len|at|substr|indexof|replace|prefixof|suffixof|contains|in_re|to_re)/.test(smtLib),
    
    // Array theory
    arrays: /\(select\s|\(store\s|\(Array\s/.test(smtLib),
    
    // Bitvectors
    bitvectors: /bv\d+|BitVec|bvadd|bvmul/.test(smtLib),
    
    // Algebraic datatypes
    datatypes: /\(declare-datatype|\(declare-datatypes/.test(smtLib),
  };
}

function detectNonlinearArithmetic(smtLib: string): boolean {
  // Look for patterns like (* x y) where both are variables, not constants
  // This is a heuristic - proper detection would require parsing
  
  // Check for multiplication of non-constants
  const multPattern = /\(\*\s+(?![\d.]+\s)(\S+)\s+(?![\d.]+\))(\S+)\)/g;
  if (multPattern.test(smtLib)) {
    return true;
  }

  // Check for division by non-constants
  const divPattern = /\(\/\s+\S+\s+(?![\d.]+\))(\S+)\)/g;
  if (divPattern.test(smtLib)) {
    return true;
  }

  // Check for power/exponentiation
  if (/\(pow\s|\(^\s/.test(smtLib)) {
    return true;
  }

  return false;
}

// ============================================================================
// DIFFICULTY ESTIMATION
// ============================================================================

function estimateDifficulty(analysis: ComplexityAnalysis): ComplexityAnalysis['estimatedDifficulty'] {
  // Intractable cases
  if (analysis.quantifierAlternations >= 3) return 'intractable';
  if (analysis.usesNonlinearArithmetic && analysis.quantifierCount > 0) return 'intractable';
  
  // Hard cases
  if (analysis.quantifierAlternations >= 2) return 'hard';
  if (analysis.usesNonlinearArithmetic) return 'hard';
  if (analysis.quantifierCount > 5 && analysis.usesArrays) return 'hard';
  if (analysis.constraintCount > 100 && analysis.quantifierCount > 3) return 'hard';
  
  // Moderate cases
  if (analysis.quantifierCount > 3) return 'moderate';
  if (analysis.astDepth > 30) return 'moderate';
  if (analysis.variableCount > 50) return 'moderate';
  if (analysis.usesStrings && analysis.usesArrays) return 'moderate';
  
  // Easy cases
  if (analysis.quantifierCount > 0) return 'easy';
  if (analysis.constraintCount > 20) return 'easy';
  if (analysis.astDepth > 15) return 'easy';
  
  // Trivial: simple propositional or linear arithmetic
  return 'trivial';
}

// ============================================================================
// TIMEOUT ESTIMATION
// ============================================================================

/**
 * Estimate appropriate timeout based on complexity
 */
export function estimateTimeout(analysis: ComplexityAnalysis, baseTimeout: number = 5000): number {
  const multipliers: Record<ComplexityAnalysis['estimatedDifficulty'], number> = {
    trivial: 0.5,
    easy: 1,
    moderate: 2,
    hard: 4,
    intractable: 6,
  };

  return Math.min(
    baseTimeout * multipliers[analysis.estimatedDifficulty],
    60000 // Max 60 seconds
  );
}

/**
 * Determine if pre-check should skip solver entirely
 */
export function shouldSkipSolver(analysis: ComplexityAnalysis): boolean {
  // Skip for clearly intractable problems
  if (analysis.estimatedDifficulty === 'intractable') {
    return true;
  }

  // Skip for problems with too many quantifier alternations
  if (analysis.quantifierAlternations > 3) {
    return true;
  }

  return false;
}

// ============================================================================
// REPORTING
// ============================================================================

export function formatComplexityAnalysis(analysis: ComplexityAnalysis): string {
  const lines: string[] = [
    `Complexity Analysis:`,
    `  AST Depth: ${analysis.astDepth}`,
    `  Variables: ${analysis.variableCount}`,
    `  Constraints: ${analysis.constraintCount}`,
    `  Quantifiers: ${analysis.quantifierCount} (${analysis.quantifierAlternations} alternations)`,
    `  Theories: ${[
      analysis.usesStrings ? 'strings' : null,
      analysis.usesArrays ? 'arrays' : null,
      analysis.usesNonlinearArithmetic ? 'nonlinear' : null,
    ].filter(Boolean).join(', ') || 'none'}`,
    `  Estimated Difficulty: ${analysis.estimatedDifficulty.toUpperCase()}`,
  ];

  return lines.join('\n');
}
