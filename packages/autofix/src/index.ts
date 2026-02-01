/**
 * @isl-lang/autofix
 * 
 * Automatically fix implementation bugs based on verification failures.
 * 
 * @example
 * ```typescript
 * import { fix } from '@isl-lang/autofix';
 * 
 * const result = await fix(verificationResult, implementation, domain);
 * 
 * if (result.success && result.verified) {
 *   console.log('Fixed code:', result.newImplementation);
 * }
 * ```
 */

import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import {
  FailureAnalyzer,
  parseVerificationResult,
  type VerificationFailure,
  type AnalysisResult,
  type FailureType,
  type RootCauseType,
  type FixStrategy,
} from './analyzer.js';
import {
  CodePatcher,
  mergePatches,
  type Patch,
  type PatchResult,
  type PatchContext,
} from './patcher.js';
import {
  FixValidator,
  quickValidate,
  type ValidationResult,
} from './validator.js';
import {
  generatePreconditionPatches,
  generatePostconditionPatches,
  generateInvariantPatches,
  generateErrorPatches,
  generateTemporalPatches,
} from './strategies/index.js';
import { AIFixGenerator, isAIAvailable, type AIFixResult } from './ai/generator.js';

// ============================================================================
// Main Types
// ============================================================================

export interface VerifyResult {
  success: boolean;
  failures?: VerificationFailure[];
  behaviorName?: string;
  [key: string]: unknown;
}

export interface FixResult {
  success: boolean;
  patches: Patch[];
  newImplementation?: string;
  verified: boolean;
  validation?: ValidationResult;
  explanation?: string;
  confidence: number;
}

export interface FixOptions {
  useAI?: boolean;
  maxPatches?: number;
  minConfidence?: number;
  validateFixes?: boolean;
  preserveComments?: boolean;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Automatically fix implementation bugs based on verification failures.
 * 
 * @param verifyResult - The verification result containing failures
 * @param implementation - The source code to fix
 * @param domain - The ISL domain declaration
 * @param options - Fix options
 * @returns Fix result with patches and optionally fixed implementation
 * 
 * @example
 * ```typescript
 * const result = await fix(
 *   {
 *     success: false,
 *     failures: [{
 *       type: 'postcondition',
 *       predicate: 'result.status == PENDING',
 *       expected: 'PENDING',
 *       actual: 'ACTIVE',
 *       message: 'Status should be PENDING on creation'
 *     }]
 *   },
 *   `async function createUser(email) {
 *     return db.users.create({ status: 'active' });
 *   }`,
 *   domain
 * );
 * ```
 */
export async function fix(
  verifyResult: VerifyResult,
  implementation: string,
  domain: DomainDeclaration,
  options: FixOptions = {}
): Promise<FixResult> {
  const {
    useAI = true,
    maxPatches = 10,
    minConfidence = 0.5,
    validateFixes = true,
    preserveComments = true,
  } = options;

  // Parse failures from verify result
  const failures = parseVerificationResult(verifyResult);
  
  if (failures.length === 0) {
    return {
      success: true,
      patches: [],
      newImplementation: implementation,
      verified: true,
      confidence: 1.0,
    };
  }

  // Find the behavior being fixed
  const behaviorName = verifyResult.behaviorName ?? extractBehaviorName(implementation);
  const behavior = domain.behaviors.find(b => b.name.name === behaviorName);

  if (!behavior) {
    return {
      success: false,
      patches: [],
      verified: false,
      explanation: `Could not find behavior "${behaviorName}" in domain`,
      confidence: 0,
    };
  }

  // Analyze failures
  const analyzer = new FailureAnalyzer(domain, implementation);
  const analyses = failures.map(f => analyzer.analyze(f));

  // Generate patches for each failure
  const allPatches: Patch[] = [];
  const patchContext: PatchContext = {
    implementation,
    useCustomErrors: implementation.includes('BehaviorError'),
    preserveComments,
  };

  for (const analysis of analyses) {
    const patches = generatePatchesForAnalysis(analysis, patchContext);
    allPatches.push(...patches);
  }

  // If no rule-based patches and AI is enabled, try AI fix
  if (allPatches.length === 0 && useAI && isAIAvailable()) {
    const aiGenerator = new AIFixGenerator();
    
    for (const analysis of analyses) {
      const aiResult = await aiGenerator.generateFix({
        domain,
        behavior,
        implementation,
        failure: analysis.failure,
        analysis,
      });
      
      allPatches.push(...aiResult.patches);
    }
  }

  // Filter by confidence and limit patches
  const filteredPatches = allPatches
    .filter(p => p.confidence >= minConfidence)
    .slice(0, maxPatches);

  // Merge overlapping patches
  const mergedPatches = mergePatches(filteredPatches);

  if (mergedPatches.length === 0) {
    return {
      success: false,
      patches: [],
      verified: false,
      explanation: 'Could not generate any patches for the failures',
      confidence: 0,
    };
  }

  // Apply patches
  const patcher = new CodePatcher(implementation, patchContext);
  const patchResult = patcher.applyPatches(mergedPatches);

  if (!patchResult.success && patchResult.appliedPatches.length === 0) {
    return {
      success: false,
      patches: mergedPatches,
      verified: false,
      explanation: `Failed to apply patches: ${patchResult.failedPatches.map(f => f.reason).join('; ')}`,
      confidence: 0,
    };
  }

  // Validate the fix
  let validation: ValidationResult | undefined;
  let verified = false;

  if (validateFixes) {
    const validator = new FixValidator(domain, behavior);
    
    // Validate against the first failure (primary)
    validation = await validator.validate(
      failures[0]!,
      patchResult.patchedCode,
      patchResult.appliedPatches
    );
    
    verified = validation.valid;
  }

  // Calculate overall confidence
  const avgConfidence = patchResult.appliedPatches.reduce((sum, p) => sum + p.confidence, 0) / 
    patchResult.appliedPatches.length;

  return {
    success: patchResult.appliedPatches.length > 0,
    patches: patchResult.appliedPatches,
    newImplementation: patchResult.patchedCode,
    verified,
    validation,
    explanation: generateExplanation(patchResult.appliedPatches, analyses),
    confidence: verified ? avgConfidence : avgConfidence * 0.7,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate patches based on analysis
 */
function generatePatchesForAnalysis(
  analysis: AnalysisResult,
  context: PatchContext
): Patch[] {
  switch (analysis.suggestedStrategy) {
    case 'add_precondition_check':
      return generatePreconditionPatches(analysis, context);
    case 'fix_return_value':
      return generatePostconditionPatches(analysis, context);
    case 'fix_state_mutation':
      return generateInvariantPatches(analysis, context);
    case 'add_error_handler':
      return generateErrorPatches(analysis, context);
    case 'add_timeout':
    case 'add_retry':
    case 'add_cache':
      return generateTemporalPatches(analysis, context);
    default:
      return [];
  }
}

/**
 * Extract behavior name from implementation
 */
function extractBehaviorName(implementation: string): string {
  // Try to find function name
  const funcMatch = implementation.match(/(?:async\s+)?function\s+(\w+)/);
  if (funcMatch) return funcMatch[1]!;

  // Try to find const/let assignment
  const constMatch = implementation.match(/(?:const|let)\s+(\w+)\s*=/);
  if (constMatch) return constMatch[1]!;

  // Try to find export
  const exportMatch = implementation.match(/export\s+(?:async\s+)?function\s+(\w+)/);
  if (exportMatch) return exportMatch[1]!;

  return 'Unknown';
}

/**
 * Generate explanation for applied patches
 */
function generateExplanation(patches: Patch[], analyses: AnalysisResult[]): string {
  if (patches.length === 0) {
    return 'No patches could be applied.';
  }

  const explanations: string[] = [];

  for (const analysis of analyses) {
    const relatedPatches = patches.filter(p =>
      p.description.toLowerCase().includes(analysis.failure.type)
    );

    if (relatedPatches.length > 0) {
      explanations.push(
        `Fixed ${analysis.failure.type} failure: ${analysis.rootCause.description}`
      );
    }
  }

  if (explanations.length === 0) {
    return `Applied ${patches.length} patch(es) to fix verification failures.`;
  }

  return explanations.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

// Main function
export { fix };

// Analyzer
export {
  FailureAnalyzer,
  parseVerificationResult,
  createFailure,
} from './analyzer.js';
export type {
  VerificationFailure,
  AnalysisResult,
  FailureType,
  RootCauseType,
  FixStrategy,
  SourceLocation,
  FailureContext,
  RootCause,
  CodeSegment,
} from './analyzer.js';

// Patcher
export {
  CodePatcher,
  createPatch,
  insertPatch,
  replacePatch,
  deletePatch,
  mergePatches,
  formatPatch,
} from './patcher.js';
export type {
  Patch,
  PatchResult,
  PatchContext,
} from './patcher.js';

// Validator
export {
  FixValidator,
  quickValidate,
  formatValidationResult,
} from './validator.js';
export type {
  ValidationResult,
  ValidationError,
  ValidatorOptions,
} from './validator.js';

// Strategies
export {
  generatePreconditionPatches,
  generatePostconditionPatches,
  generateInvariantPatches,
  generateErrorPatches,
  generateTemporalPatches,
} from './strategies/index.js';

// AI Generator
export {
  AIFixGenerator,
  generateAIFix,
  isAIAvailable,
} from './ai/generator.js';
export type {
  AIFixOptions,
  AIFixResult,
  AIFixContext,
} from './ai/generator.js';
