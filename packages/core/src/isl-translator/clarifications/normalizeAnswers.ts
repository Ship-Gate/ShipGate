/**
 * Answer Normalization
 * 
 * Normalizes user answers to canonical formats for deterministic processing
 */

import type {
  AnswerValue,
  DurationValue,
  Answer,
  OpenQuestion,
  AnswerConstraints,
} from './clarifyTypes.js';
import {
  isDurationValue,
  isBooleanAnswer,
  isNumericAnswer,
  VALID_DURATION_UNITS,
} from './clarifyTypes.js';

// ============================================================================
// NORMALIZATION RESULT
// ============================================================================

export interface NormalizedAnswer {
  questionId: string;
  value: AnswerValue;
  wasNormalized: boolean;
  normalizations: string[];
}

export interface NormalizationError {
  questionId: string;
  error: string;
}

export interface NormalizeResult {
  normalized: NormalizedAnswer[];
  errors: NormalizationError[];
}

// ============================================================================
// STRING PARSING
// ============================================================================

/**
 * Parses a boolean from various string representations
 */
export function parseBoolean(input: string | boolean): boolean | null {
  if (typeof input === 'boolean') {
    return input;
  }

  const normalized = input.toLowerCase().trim();
  
  const trueValues = ['yes', 'true', 'on', '1', 'enabled', 'enable'];
  const falseValues = ['no', 'false', 'off', '0', 'disabled', 'disable'];

  if (trueValues.includes(normalized)) {
    return true;
  }
  if (falseValues.includes(normalized)) {
    return false;
  }

  return null;
}

/**
 * Parses a duration from various string formats
 * Supports: "30m", "1h", "24h", "7d", "500ms", "30 minutes"
 */
export function parseDuration(input: string | DurationValue): DurationValue | null {
  if (isDurationValue(input)) {
    return input;
  }

  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.toLowerCase().trim();

  // Pattern: number followed by unit
  const patterns: Array<{ regex: RegExp; unit: DurationValue['unit'] }> = [
    { regex: /^(\d+(?:\.\d+)?)\s*ms$/i, unit: 'ms' },
    { regex: /^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)$/i, unit: 'seconds' },
    { regex: /^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)$/i, unit: 'minutes' },
    { regex: /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)$/i, unit: 'hours' },
    { regex: /^(\d+(?:\.\d+)?)\s*(?:d|day|days)$/i, unit: 'days' },
  ];

  for (const { regex, unit } of patterns) {
    const match = normalized.match(regex);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value >= 0) {
        return { value, unit };
      }
    }
  }

  return null;
}

/**
 * Parses a numeric value from string
 */
export function parseNumeric(input: string | number): number | null {
  if (typeof input === 'number') {
    return isNaN(input) ? null : input;
  }

  const parsed = parseFloat(input.trim());
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates an answer against constraints
 */
export function validateAnswer(
  value: AnswerValue,
  constraints?: AnswerConstraints
): { valid: boolean; error?: string } {
  if (!constraints) {
    return { valid: true };
  }

  // Numeric constraints
  if (isNumericAnswer(value)) {
    if (constraints.min !== undefined && value < constraints.min) {
      return { valid: false, error: `Value ${value} is below minimum ${constraints.min}` };
    }
    if (constraints.max !== undefined && value > constraints.max) {
      return { valid: false, error: `Value ${value} exceeds maximum ${constraints.max}` };
    }
  }

  // Duration constraints
  if (isDurationValue(value)) {
    if (constraints.min !== undefined && value.value < constraints.min) {
      return { valid: false, error: `Duration ${value.value} is below minimum ${constraints.min}` };
    }
    if (constraints.max !== undefined && value.value > constraints.max) {
      return { valid: false, error: `Duration ${value.value} exceeds maximum ${constraints.max}` };
    }
    if (constraints.allowedUnits && !constraints.allowedUnits.includes(value.unit)) {
      return { 
        valid: false, 
        error: `Unit '${value.unit}' not allowed. Allowed: ${constraints.allowedUnits.join(', ')}` 
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// MAIN NORMALIZATION
// ============================================================================

/**
 * Normalizes a single answer based on its question type
 */
export function normalizeAnswer(
  answer: Answer,
  question: OpenQuestion
): NormalizedAnswer | NormalizationError {
  const normalizations: string[] = [];
  let value = answer.value;

  // Type-specific normalization
  switch (question.type) {
    case 'rate_limit': {
      // Rate limit can be boolean (on/off) or numeric (requests per period)
      if (typeof value === 'string') {
        const boolVal = parseBoolean(value);
        if (boolVal !== null) {
          value = boolVal;
          normalizations.push(`Parsed boolean from string: "${answer.value}" -> ${value}`);
        } else {
          const numVal = parseNumeric(value);
          if (numVal !== null) {
            value = numVal;
            normalizations.push(`Parsed numeric from string: "${answer.value}" -> ${value}`);
          } else {
            return {
              questionId: answer.questionId,
              error: `Cannot parse rate_limit value: "${value}". Expected boolean or number.`,
            };
          }
        }
      }
      break;
    }

    case 'session_expiry': {
      // Session expiry expects a duration
      if (typeof value === 'string' || typeof value === 'number') {
        const duration = typeof value === 'number' 
          ? { value, unit: 'minutes' as const }
          : parseDuration(value);
        
        if (duration) {
          value = duration;
          normalizations.push(`Parsed duration: "${answer.value}" -> ${duration.value}${duration.unit}`);
        } else {
          return {
            questionId: answer.questionId,
            error: `Cannot parse session_expiry duration: "${value}"`,
          };
        }
      }
      break;
    }

    case 'audit_logging':
    case 'idempotency': {
      // These expect boolean values
      if (typeof value === 'string') {
        const boolVal = parseBoolean(value);
        if (boolVal !== null) {
          value = boolVal;
          normalizations.push(`Parsed boolean from string: "${answer.value}" -> ${value}`);
        } else {
          return {
            questionId: answer.questionId,
            error: `Cannot parse ${question.type} value: "${value}". Expected yes/no or true/false.`,
          };
        }
      } else if (typeof value !== 'boolean') {
        return {
          questionId: answer.questionId,
          error: `Invalid ${question.type} value type: expected boolean, got ${typeof value}`,
        };
      }
      break;
    }
  }

  // Validate against constraints
  const validation = validateAnswer(value, question.constraints);
  if (!validation.valid) {
    return {
      questionId: answer.questionId,
      error: validation.error || 'Constraint violation',
    };
  }

  return {
    questionId: answer.questionId,
    value,
    wasNormalized: normalizations.length > 0,
    normalizations,
  };
}

/**
 * Normalizes all answers against their questions
 */
export function normalizeAnswers(
  answers: Answer[],
  questions: OpenQuestion[]
): NormalizeResult {
  const questionMap = new Map(questions.map(q => [q.id, q]));
  const normalized: NormalizedAnswer[] = [];
  const errors: NormalizationError[] = [];

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    
    if (!question) {
      errors.push({
        questionId: answer.questionId,
        error: `No matching question found for answer ID: ${answer.questionId}`,
      });
      continue;
    }

    const result = normalizeAnswer(answer, question);
    
    if ('error' in result) {
      errors.push(result);
    } else {
      normalized.push(result);
    }
  }

  return { normalized, errors };
}
