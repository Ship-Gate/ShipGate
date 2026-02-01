/**
 * ISL Clarification Engine
 * 
 * Takes open questions + answers and produces an updated AST.
 * Deterministic: same inputs always produce same outputs.
 */

import type {
  ClarifySpecInput,
  ClarifySpecOutput,
  OpenQuestion,
  Answer,
  AppliedClarification,
  UnresolvedQuestion,
  AnswerValue,
} from './clarifyTypes.js';
import type { Domain, Behavior } from '../corpus-tests/corpusRunner.js';
import { normalizeAnswers, type NormalizedAnswer } from './normalizeAnswers.js';
import { applyRule, getTargetBehaviors, deepCloneDomain } from './clarifyRules.js';

// ============================================================================
// MAIN CLARIFICATION FUNCTION
// ============================================================================

/**
 * Clarify a spec by applying answers to open questions
 * 
 * @param input - The AST, open questions, and answers
 * @returns Updated AST with applied clarifications and unresolved questions
 * 
 * @example
 * ```typescript
 * const result = clarifySpec({
 *   ast: myDomain,
 *   openQuestions: [
 *     { id: 'q1', type: 'rate_limit', text: 'Enable rate limiting?' },
 *     { id: 'q2', type: 'audit_logging', text: 'Enable audit logs?' },
 *   ],
 *   answers: [
 *     { questionId: 'q1', value: 100 },
 *     { questionId: 'q2', value: true },
 *   ],
 * });
 * // result.ast - updated with rate_limit=100 and audit logging enabled
 * // result.applied - list of applied clarifications
 * // result.unresolved - empty (all answered)
 * ```
 */
export function clarifySpec(input: ClarifySpecInput): ClarifySpecOutput {
  const { ast, openQuestions, answers } = input;

  // Clone AST to avoid mutation
  let updatedAst = deepCloneDomain(ast);

  const applied: AppliedClarification[] = [];
  const unresolved: UnresolvedQuestion[] = [];

  // Create answer map for quick lookup
  const answerMap = new Map<string, Answer>(
    answers.map(a => [a.questionId, a])
  );

  // Normalize all answers
  const normalization = normalizeAnswers(answers, openQuestions);

  // Track normalization errors
  for (const error of normalization.errors) {
    unresolved.push({
      questionId: error.questionId,
      reason: 'invalid_answer',
      details: error.error,
    });
  }

  // Create normalized answer map
  const normalizedMap = new Map<string, NormalizedAnswer>(
    normalization.normalized.map(n => [n.questionId, n])
  );

  // Process questions in deterministic order (sorted by ID)
  const sortedQuestions = [...openQuestions].sort((a, b) => a.id.localeCompare(b.id));

  for (const question of sortedQuestions) {
    const normalized = normalizedMap.get(question.id);

    // Check if question was answered
    if (!normalized) {
      // Check if there's an error for this question
      const hasError = unresolved.some(u => u.questionId === question.id);
      if (!hasError) {
        // Check if we have a default value
        if (question.defaultValue !== undefined) {
          // Apply default value
          const result = applyQuestionToAst(updatedAst, question, question.defaultValue);
          updatedAst = result.ast;
          if (result.applied) {
            applied.push({
              ...result.applied,
              description: `${result.applied.description} (using default)`,
            });
          }
        } else {
          unresolved.push({
            questionId: question.id,
            reason: 'no_answer',
            details: `No answer provided for: ${question.text}`,
          });
        }
      }
      continue;
    }

    // Apply the normalized answer
    const result = applyQuestionToAst(updatedAst, question, normalized.value);
    updatedAst = result.ast;
    
    if (result.applied) {
      applied.push(result.applied);
    }
  }

  return {
    ast: updatedAst,
    applied,
    unresolved,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ApplyResult {
  ast: Domain;
  applied: AppliedClarification | null;
}

/**
 * Apply a single question's answer to the AST
 */
function applyQuestionToAst(
  ast: Domain,
  question: OpenQuestion,
  value: AnswerValue
): ApplyResult {
  // Get target behaviors
  const targetBehaviors = getTargetBehaviors(ast, question);

  if (targetBehaviors.length === 0) {
    return { ast, applied: null };
  }

  // Clone AST
  const newAst = deepCloneDomain(ast);
  const modifiedBehaviors: string[] = [];
  const descriptions: string[] = [];

  // Apply rule to each target behavior
  for (const behavior of targetBehaviors) {
    const behaviorIndex = newAst.behaviors.findIndex(
      b => b.name.name === behavior.name.name
    );

    if (behaviorIndex < 0) {
      continue;
    }

    const result = applyRule(newAst.behaviors[behaviorIndex], question.type, value);
    
    if (result.modified) {
      newAst.behaviors[behaviorIndex] = result.behavior;
      modifiedBehaviors.push(behavior.name.name);
      descriptions.push(result.description);
    }
  }

  if (modifiedBehaviors.length === 0) {
    return { ast, applied: null };
  }

  return {
    ast: newAst,
    applied: {
      questionId: question.id,
      type: question.type,
      modifiedBehaviors,
      description: descriptions.join('; '),
    },
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create an open question helper
 */
export function createQuestion(
  id: string,
  type: OpenQuestion['type'],
  text: string,
  options?: Partial<OpenQuestion>
): OpenQuestion {
  return {
    id,
    type,
    text,
    ...options,
  };
}

/**
 * Create an answer helper
 */
export function createAnswer(questionId: string, value: AnswerValue): Answer {
  return { questionId, value };
}

/**
 * Check if a clarification was applied for a specific question
 */
export function wasApplied(
  output: ClarifySpecOutput,
  questionId: string
): boolean {
  return output.applied.some(a => a.questionId === questionId);
}

/**
 * Check if a question is unresolved
 */
export function isUnresolved(
  output: ClarifySpecOutput,
  questionId: string
): boolean {
  return output.unresolved.some(u => u.questionId === questionId);
}

/**
 * Get the count of applied clarifications
 */
export function appliedCount(output: ClarifySpecOutput): number {
  return output.applied.length;
}

/**
 * Get the count of unresolved questions
 */
export function unresolvedCount(output: ClarifySpecOutput): number {
  return output.unresolved.length;
}
