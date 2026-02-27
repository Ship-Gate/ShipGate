/**
 * Clarification Rules
 * 
 * Defines how different clarification types modify the AST
 */

import type {
  Domain,
  Behavior,
  SecuritySpec,
  ObservabilitySpec,
  DurationLiteral,
  Identifier,
  NumberLiteral,
  BooleanLiteral,
  StringLiteral,
  SourceLocation,
} from '../corpus-tests/corpusRunner.js';
import type {
  QuestionType,
  AnswerValue,
  DurationValue,
  OpenQuestion,
  AppliedClarification,
} from './clarifyTypes.js';
import { isDurationValue, isBooleanAnswer, isNumericAnswer } from './clarifyTypes.js';

// ============================================================================
// AST NODE CREATORS
// ============================================================================

function mockLocation(): SourceLocation {
  return {
    file: '<clarification>',
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

function createIdentifier(name: string): Identifier {
  return { kind: 'Identifier', name, location: mockLocation() };
}

function createNumberLiteral(value: number, isFloat = false): NumberLiteral {
  return { kind: 'NumberLiteral', value, isFloat, location: mockLocation() };
}

function createBooleanLiteral(value: boolean): BooleanLiteral {
  return { kind: 'BooleanLiteral', value, location: mockLocation() };
}

function createStringLiteral(value: string): StringLiteral {
  return { kind: 'StringLiteral', value, location: mockLocation() };
}

function createDurationLiteral(duration: DurationValue): DurationLiteral {
  return {
    kind: 'DurationLiteral',
    value: duration.value,
    unit: duration.unit,
    location: mockLocation(),
  };
}

// ============================================================================
// RULE APPLICATION
// ============================================================================

export interface RuleApplicationResult {
  behavior: Behavior;
  modified: boolean;
  description: string;
}

/**
 * Apply rate limit clarification to a behavior
 */
export function applyRateLimit(
  behavior: Behavior,
  value: AnswerValue
): RuleApplicationResult {
  // Clone behavior to avoid mutation
  const newBehavior = deepCloneBehavior(behavior);

  // If value is false/0, remove rate limit
  if (value === false || value === 0) {
    newBehavior.security = newBehavior.security.filter(s => s.type !== 'rate_limit');
    return {
      behavior: newBehavior,
      modified: true,
      description: `Removed rate limiting from ${behavior.name.name}`,
    };
  }

  // If value is true, add default rate limit (100/min)
  // If value is numeric, use that value
  const limit = value === true ? 100 : (isNumericAnswer(value) ? value : 100);

  // Check if rate_limit already exists
  const existingIndex = newBehavior.security.findIndex(s => s.type === 'rate_limit');

  const rateLimitSpec: SecuritySpec = {
    kind: 'SecuritySpec',
    type: 'rate_limit',
    details: createNumberLiteral(limit),
    location: mockLocation(),
  };

  if (existingIndex >= 0) {
    newBehavior.security[existingIndex] = rateLimitSpec;
  } else {
    newBehavior.security.push(rateLimitSpec);
  }

  return {
    behavior: newBehavior,
    modified: true,
    description: `Applied rate limit of ${limit} requests to ${behavior.name.name}`,
  };
}

/**
 * Apply session expiry clarification to a behavior
 */
export function applySessionExpiry(
  behavior: Behavior,
  value: AnswerValue
): RuleApplicationResult {
  if (!isDurationValue(value)) {
    return {
      behavior,
      modified: false,
      description: 'Invalid duration value for session expiry',
    };
  }

  const newBehavior = deepCloneBehavior(behavior);

  // Add or update temporal spec for session expiry
  const temporalSpec = {
    kind: 'TemporalSpec' as const,
    operator: 'within' as const,
    predicate: {
      kind: 'CallExpr' as const,
      callee: createIdentifier('session_expires'),
      arguments: [],
      location: mockLocation(),
    },
    duration: createDurationLiteral(value),
    location: mockLocation(),
  };

  // Check if session expiry temporal spec already exists
  const existingIndex = newBehavior.temporal.findIndex(t => 
    t.operator === 'within' && 
    t.predicate.kind === 'CallExpr' &&
    (t.predicate as any).callee?.name === 'session_expires'
  );

  if (existingIndex >= 0) {
    newBehavior.temporal[existingIndex] = temporalSpec;
  } else {
    newBehavior.temporal.push(temporalSpec);
  }

  return {
    behavior: newBehavior,
    modified: true,
    description: `Set session expiry to ${value.value}${value.unit} for ${behavior.name.name}`,
  };
}

/**
 * Apply audit logging clarification to a behavior
 */
export function applyAuditLogging(
  behavior: Behavior,
  value: AnswerValue
): RuleApplicationResult {
  if (!isBooleanAnswer(value)) {
    return {
      behavior,
      modified: false,
      description: 'Invalid boolean value for audit logging',
    };
  }

  const newBehavior = deepCloneBehavior(behavior);

  // Initialize observability if needed
  if (!newBehavior.observability) {
    newBehavior.observability = {
      kind: 'ObservabilitySpec',
      metrics: [],
      traces: [],
      logs: [],
      location: mockLocation(),
    };
  }

  if (value === false) {
    // Remove audit logs
    newBehavior.observability.logs = newBehavior.observability.logs.filter(
      log => log.level !== 'info' || !log.include.some(i => i.name === 'audit')
    );
    return {
      behavior: newBehavior,
      modified: true,
      description: `Disabled audit logging for ${behavior.name.name}`,
    };
  }

  // Add audit logging
  const auditLog = {
    kind: 'LogSpec' as const,
    condition: 'always' as const,
    level: 'info' as const,
    include: [createIdentifier('audit'), createIdentifier('user'), createIdentifier('action')],
    exclude: [createIdentifier('sensitive_data')],
    location: mockLocation(),
  };

  // Check if audit log already exists
  const hasAuditLog = newBehavior.observability.logs.some(
    log => log.include.some(i => i.name === 'audit')
  );

  if (!hasAuditLog) {
    newBehavior.observability.logs.push(auditLog);
  }

  return {
    behavior: newBehavior,
    modified: true,
    description: `Enabled audit logging for ${behavior.name.name}`,
  };
}

/**
 * Apply idempotency clarification to a behavior
 */
export function applyIdempotency(
  behavior: Behavior,
  value: AnswerValue
): RuleApplicationResult {
  if (!isBooleanAnswer(value)) {
    return {
      behavior,
      modified: false,
      description: 'Invalid boolean value for idempotency',
    };
  }

  const newBehavior = deepCloneBehavior(behavior);

  // Idempotency is expressed via preconditions and postconditions
  // We add an idempotency_key check

  if (value === false) {
    // Remove idempotency preconditions/postconditions
    newBehavior.preconditions = newBehavior.preconditions.filter(p => {
      if (p.kind === 'CallExpr') {
        const callee = (p as any).callee;
        return callee?.name !== 'idempotent';
      }
      return true;
    });
    return {
      behavior: newBehavior,
      modified: true,
      description: `Disabled idempotency for ${behavior.name.name}`,
    };
  }

  // Add idempotency precondition
  const idempotencyCheck = {
    kind: 'CallExpr' as const,
    callee: createIdentifier('idempotent'),
    arguments: [
      {
        kind: 'MemberExpr' as const,
        object: createIdentifier('input'),
        property: createIdentifier('idempotency_key'),
        location: mockLocation(),
      },
    ],
    location: mockLocation(),
  };

  // Check if idempotency already exists
  const hasIdempotency = newBehavior.preconditions.some(p => {
    if (p.kind === 'CallExpr') {
      const callee = (p as any).callee;
      return callee?.name === 'idempotent';
    }
    return false;
  });

  if (!hasIdempotency) {
    newBehavior.preconditions.push(idempotencyCheck);
  }

  return {
    behavior: newBehavior,
    modified: true,
    description: `Enabled idempotency for ${behavior.name.name}`,
  };
}

// ============================================================================
// RULE DISPATCHER
// ============================================================================

/**
 * Apply a clarification rule based on question type
 */
export function applyRule(
  behavior: Behavior,
  type: QuestionType,
  value: AnswerValue
): RuleApplicationResult {
  switch (type) {
    case 'rate_limit':
      return applyRateLimit(behavior, value);
    case 'session_expiry':
      return applySessionExpiry(behavior, value);
    case 'audit_logging':
      return applyAuditLogging(behavior, value);
    case 'idempotency':
      return applyIdempotency(behavior, value);
    default:
      return {
        behavior,
        modified: false,
        description: `Unknown clarification type: ${type}`,
      };
  }
}

/**
 * Get target behaviors for a question
 */
export function getTargetBehaviors(
  ast: Domain,
  question: OpenQuestion
): Behavior[] {
  if (question.targetBehaviors && question.targetBehaviors.length > 0) {
    return ast.behaviors.filter(b => 
      question.targetBehaviors!.includes(b.name.name)
    );
  }
  // Default: apply to all behaviors
  return ast.behaviors;
}

// ============================================================================
// DEEP CLONE
// ============================================================================

/**
 * Deep clone a behavior to avoid mutations
 */
function deepCloneBehavior(behavior: Behavior): Behavior {
  return JSON.parse(JSON.stringify(behavior));
}

/**
 * Deep clone a domain to avoid mutations
 */
export function deepCloneDomain(domain: Domain): Domain {
  return JSON.parse(JSON.stringify(domain));
}
