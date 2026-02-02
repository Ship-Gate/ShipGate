/**
 * ISL Linter V2 - Rules
 *
 * Lint rules with severity classification and auto-fix suggestions.
 */

import type {
  Domain,
  Behavior,
  Expression,
  BinaryExpr,
  NumberLiteral,
  BooleanLiteral,
  Identifier,
  MemberExpr,
  PostconditionBlock,
  ActorSpec,
  SecuritySpec,
  ASTNode,
  SourceLocation,
} from '@isl-lang/parser';

import type {
  LintRule,
  LintDiagnostic,
  LintContext,
  LintFix,
  ASTPatch,
  MinimumConstraints,
} from './types.js';

import { SECURITY_PATTERNS, MINIMUM_CONSTRAINTS } from './types.js';

// ============================================================================
// Helper Functions
// ============================================================================

function matchesPatterns(name: string, patterns: readonly string[]): boolean {
  const lowerName = name.toLowerCase();
  return patterns.some((p) => lowerName.includes(p));
}

function detectSecurityCategory(name: string): keyof typeof SECURITY_PATTERNS | null {
  const lowerName = name.toLowerCase();
  for (const [category, patterns] of Object.entries(SECURITY_PATTERNS)) {
    if (patterns.some((p) => lowerName.includes(p))) {
      return category as keyof typeof SECURITY_PATTERNS;
    }
  }
  return null;
}

function getMinimumConstraints(category: keyof typeof SECURITY_PATTERNS): MinimumConstraints | undefined {
  return MINIMUM_CONSTRAINTS.find((c) => c.category === category);
}

function createDefaultLocation(file = 'unknown'): SourceLocation {
  return { file, line: 1, column: 1, endLine: 1, endColumn: 1 };
}

// ============================================================================
// Rule: Auth/Payment/Upload Minimum Constraints (ISL2-001)
// ============================================================================

export const minimumConstraintsRule: LintRule = {
  id: 'ISL2-001',
  name: 'minimum-constraints',
  description: 'Security-sensitive behaviors (auth, payment, upload) require minimum constraints',
  severity: 'error',
  category: 'safety',
  tags: ['security', 'auth', 'payment', 'upload'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      const category = detectSecurityCategory(behavior.name.name);

      if (!category) continue;

      const requirements = getMinimumConstraints(category);
      if (!requirements) continue;

      const issues: string[] = [];
      const fixes: LintFix[] = [];

      // Check required blocks
      if (requirements.requiredBlocks.includes('actors')) {
        if (!behavior.actors || behavior.actors.length === 0) {
          issues.push('missing actors specification');
          fixes.push(
            createFix({
              id: `add-actors-${behavior.name.name}`,
              title: 'Add actors block',
              description: 'Add an actors block requiring authenticated users',
              patches: [
                createPatch.insert(
                  `behaviors[${i}].actors`,
                  createActorSpec('User', ['authenticated']),
                  'last',
                  'Add User actor with authenticated constraint'
                ),
              ],
              isAutomaticallySafe: false,
              priority: 10,
              category: 'add-block',
            })
          );
        }
      }

      if (requirements.requiredBlocks.includes('preconditions')) {
        const minPre = requirements.minPreconditions ?? 1;
        if (behavior.preconditions.length < minPre) {
          issues.push(`requires at least ${minPre} precondition(s), found ${behavior.preconditions.length}`);
          fixes.push(
            createFix({
              id: `add-precondition-${behavior.name.name}`,
              title: 'Add precondition',
              description: `Add required precondition for ${category} behavior`,
              patches: [
                createPatch.insert(
                  `behaviors[${i}].preconditions`,
                  createValidationPrecondition(category),
                  'last',
                  'Add validation precondition'
                ),
              ],
              isAutomaticallySafe: false,
              priority: 8,
              category: 'add-constraint',
            })
          );
        }
      }

      if (requirements.requiredBlocks.includes('postconditions')) {
        const minPost = requirements.minPostconditions ?? 1;
        const totalPostconditions = behavior.postconditions.reduce(
          (acc, pc) => acc + pc.predicates.length,
          0
        );
        if (totalPostconditions < minPost) {
          issues.push(`requires at least ${minPost} postcondition(s), found ${totalPostconditions}`);
          fixes.push(
            createFix({
              id: `add-postcondition-${behavior.name.name}`,
              title: 'Add postcondition',
              description: 'Add success postcondition',
              patches: [
                createPatch.insert(
                  `behaviors[${i}].postconditions`,
                  createSuccessPostcondition(),
                  'last',
                  'Add success implies postcondition block'
                ),
              ],
              isAutomaticallySafe: false,
              priority: 8,
              category: 'add-block',
            })
          );
        }
      }

      if (requirements.requiredBlocks.includes('security')) {
        if (behavior.security.length === 0) {
          issues.push('missing security specification');
          const securityFixes: ASTPatch[] = [];

          if (requirements.requiresRateLimit) {
            securityFixes.push(
              createPatch.insert(
                `behaviors[${i}].security`,
                createSecuritySpec('rate_limit', '5 per minute'),
                'last',
                'Add rate limiting'
              )
            );
          }
          if (requirements.requiresFraudCheck) {
            securityFixes.push(
              createPatch.insert(
                `behaviors[${i}].security`,
                createSecuritySpec('fraud_check', 'enabled'),
                'last',
                'Add fraud check'
              )
            );
          }

          if (securityFixes.length > 0) {
            fixes.push(
              createFix({
                id: `add-security-${behavior.name.name}`,
                title: 'Add security constraints',
                description: 'Add required security specifications',
                patches: securityFixes,
                isAutomaticallySafe: false,
                priority: 10,
                category: 'add-block',
              })
            );
          }
        }
      }

      // Check specific requirements
      if (requirements.requiresRateLimit && !hasRateLimit(behavior)) {
        issues.push('requires rate limiting');
      }

      if (requirements.requiresFraudCheck && !hasFraudCheck(behavior)) {
        issues.push('requires fraud check');
      }

      if (issues.length > 0) {
        diagnostics.push(
          report({
            node: behavior,
            elementName: behavior.name.name,
            message: `${capitalize(category)} behavior "${behavior.name.name}" has insufficient constraints: ${issues.join(', ')}`,
            fixes: fixes.length > 0 ? fixes : undefined,
            tags: ['security', category],
            meta: {
              category,
              issues,
            },
          })
        );
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Missing Postconditions (ISL2-002) - ERROR
// ============================================================================

export const missingPostconditionsRule: LintRule = {
  id: 'ISL2-002',
  name: 'missing-postconditions',
  description: 'Critical behaviors must have postconditions to verify expected outcomes',
  severity: 'error',
  category: 'completeness',
  tags: ['postcondition', 'verification'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    const criticalPatterns = [
      'create',
      'update',
      'delete',
      'remove',
      'transfer',
      'send',
      'assign',
      'change',
      'approve',
      'reject',
      'cancel',
      'confirm',
      'process',
      'execute',
    ];

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      const name = behavior.name.name.toLowerCase();

      const isCritical = criticalPatterns.some((p) => name.includes(p));

      if (isCritical) {
        const hasPostconditions =
          behavior.postconditions.length > 0 &&
          behavior.postconditions.some((pc) => pc.predicates.length > 0);

        if (!hasPostconditions) {
          diagnostics.push(
            report({
              node: behavior,
              elementName: behavior.name.name,
              message: `Critical behavior "${behavior.name.name}" has no postconditions. Without postconditions, the behavior's effects cannot be verified.`,
              fixes: [
                createFix({
                  id: `add-postconditions-${behavior.name.name}`,
                  title: 'Add success postcondition',
                  description: 'Add a postcondition block with success condition',
                  patches: [
                    createPatch.insert(
                      `behaviors[${i}].postconditions`,
                      createSuccessPostcondition(),
                      'last',
                      'Add success postcondition block'
                    ),
                  ],
                  isAutomaticallySafe: false,
                  priority: 10,
                  category: 'add-block',
                }),
              ],
              tags: ['postcondition', 'critical'],
              meta: {
                detectedPatterns: criticalPatterns.filter((p) => name.includes(p)),
              },
            })
          );
        }
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Ambiguous Actor/Subject (ISL2-003) - WARNING
// ============================================================================

export const ambiguousActorRule: LintRule = {
  id: 'ISL2-003',
  name: 'ambiguous-actor',
  description: 'Behaviors should clearly specify who can perform them and under what conditions',
  severity: 'warning',
  category: 'clarity',
  tags: ['actor', 'authorization'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    const actorSuggestingPatterns = [
      'admin',
      'user',
      'owner',
      'manager',
      'approve',
      'reject',
      'grant',
      'revoke',
      'assign',
      'moderate',
    ];

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      const hasActors = behavior.actors && behavior.actors.length > 0;
      const name = behavior.name.name.toLowerCase();

      if (!hasActors) {
        // Check if the behavior name suggests it should have actors
        const suggestsActor = actorSuggestingPatterns.some((p) => name.includes(p));
        const isSecuritySensitive = detectSecurityCategory(behavior.name.name) !== null;

        if (suggestsActor || isSecuritySensitive) {
          diagnostics.push(
            report({
              node: behavior,
              elementName: behavior.name.name,
              message: `Behavior "${behavior.name.name}" has no actor specification. It's unclear who is authorized to perform this action.`,
              fixes: [
                createFix({
                  id: `add-actor-${behavior.name.name}`,
                  title: 'Add User actor',
                  description: 'Add an actor block requiring authenticated users',
                  patches: [
                    createPatch.insert(
                      `behaviors[${i}].actors`,
                      createActorSpec('User', ['authenticated']),
                      'last',
                      'Add authenticated User actor'
                    ),
                  ],
                  isAutomaticallySafe: false,
                  priority: 8,
                  category: 'add-block',
                }),
                createFix({
                  id: `add-admin-actor-${behavior.name.name}`,
                  title: 'Add Admin actor',
                  description: 'Add an actor block requiring admin role',
                  patches: [
                    createPatch.insert(
                      `behaviors[${i}].actors`,
                      createActorSpec('Admin', ["hasRole('admin')"]),
                      'last',
                      'Add Admin actor with role constraint'
                    ),
                  ],
                  isAutomaticallySafe: false,
                  priority: 7,
                  category: 'add-block',
                }),
              ],
              tags: ['actor', 'authorization'],
            })
          );
        }
      } else if (behavior.actors) {
        // Check for actors without constraints
        for (let j = 0; j < behavior.actors.length; j++) {
          const actor = behavior.actors[j];
          if (actor.constraints.length === 0) {
            diagnostics.push(
              report({
                node: actor,
                elementName: `${behavior.name.name}.${actor.name.name}`,
                message: `Actor "${actor.name.name}" in behavior "${behavior.name.name}" has no constraints. Any ${actor.name.name} can perform this action without authorization checks.`,
                fixes: [
                  createFix({
                    id: `add-constraint-${behavior.name.name}-${actor.name.name}`,
                    title: 'Add authenticated constraint',
                    description: 'Require the actor to be authenticated',
                    patches: [
                      createPatch.modify(
                        `behaviors[${i}].actors[${j}].constraints`,
                        { push: createIdentifier('authenticated') },
                        'Add authenticated constraint'
                      ),
                    ],
                    isAutomaticallySafe: false,
                    priority: 8,
                    category: 'add-constraint',
                  }),
                ],
                tags: ['actor', 'constraint'],
              })
            );
          }
        }
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Impossible Constraints (ISL2-004) - ERROR
// ============================================================================

export const impossibleConstraintsRule: LintRule = {
  id: 'ISL2-004',
  name: 'impossible-constraints',
  description: 'Detect constraints that can never be satisfied',
  severity: 'error',
  category: 'correctness',
  tags: ['constraint', 'logic'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];

      // Check preconditions
      for (let j = 0; j < behavior.preconditions.length; j++) {
        const precondition = behavior.preconditions[j];
        const issues = checkForImpossibleConstraint(precondition);

        for (const issue of issues) {
          diagnostics.push(
            report({
              node: precondition,
              elementName: behavior.name.name,
              message: `Impossible precondition in "${behavior.name.name}": ${issue}`,
              fixes: [
                createFix({
                  id: `remove-impossible-pre-${behavior.name.name}-${j}`,
                  title: 'Remove impossible constraint',
                  description: 'Remove this constraint that can never be satisfied',
                  patches: [
                    createPatch.remove(`behaviors[${i}].preconditions`, 'Remove impossible precondition', j),
                  ],
                  isAutomaticallySafe: false,
                  priority: 5,
                  category: 'remove-element',
                }),
              ],
              tags: ['constraint', 'impossible'],
            })
          );
        }
      }

      // Check postconditions
      for (let j = 0; j < behavior.postconditions.length; j++) {
        const postcondition = behavior.postconditions[j];
        for (let k = 0; k < postcondition.predicates.length; k++) {
          const predicate = postcondition.predicates[k];
          const issues = checkForImpossibleConstraint(predicate);

          for (const issue of issues) {
            diagnostics.push(
              report({
                node: predicate,
                elementName: behavior.name.name,
                message: `Impossible postcondition in "${behavior.name.name}": ${issue}`,
                tags: ['constraint', 'impossible'],
              })
            );
          }
        }
      }
    }

    // Check entity invariants
    for (let i = 0; i < domain.entities.length; i++) {
      const entity = domain.entities[i];
      for (let j = 0; j < entity.invariants.length; j++) {
        const invariant = entity.invariants[j];
        const issues = checkForImpossibleConstraint(invariant);

        for (const issue of issues) {
          diagnostics.push(
            report({
              node: invariant,
              elementName: entity.name.name,
              message: `Impossible invariant in entity "${entity.name.name}": ${issue}`,
              tags: ['constraint', 'impossible', 'invariant'],
            })
          );
        }
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Missing Error Specifications (ISL2-005) - WARNING
// ============================================================================

export const missingErrorSpecRule: LintRule = {
  id: 'ISL2-005',
  name: 'missing-error-spec',
  description: 'Non-query behaviors should specify possible error conditions',
  severity: 'warning',
  category: 'completeness',
  tags: ['error', 'output'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      const name = behavior.name.name.toLowerCase();

      // Skip behaviors that are simple queries
      const isQuery =
        name.startsWith('get') ||
        name.startsWith('list') ||
        name.startsWith('find') ||
        name.startsWith('search') ||
        name.startsWith('fetch');

      if (isQuery) continue;

      const hasErrors = behavior.output.errors.length > 0;

      if (!hasErrors) {
        diagnostics.push(
          report({
            node: behavior.output,
            elementName: behavior.name.name,
            message: `Behavior "${behavior.name.name}" has no error specifications. Consider what could go wrong.`,
            fixes: [
              createFix({
                id: `add-error-${behavior.name.name}`,
                title: 'Add common error cases',
                description: 'Add NOT_FOUND and VALIDATION_ERROR cases',
                patches: [
                  createPatch.insert(
                    `behaviors[${i}].output.errors`,
                    createErrorSpec('NOT_FOUND', 'Resource not found', false),
                    'last',
                    'Add NOT_FOUND error'
                  ),
                  createPatch.insert(
                    `behaviors[${i}].output.errors`,
                    createErrorSpec('VALIDATION_ERROR', 'Invalid input', false),
                    'last',
                    'Add VALIDATION_ERROR'
                  ),
                ],
                isAutomaticallySafe: false,
                priority: 6,
                category: 'add-block',
              }),
            ],
            tags: ['error', 'output'],
          })
        );
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Unconstrained Numeric Input (ISL2-006) - WARNING
// ============================================================================

export const unconstrainedNumericInputRule: LintRule = {
  id: 'ISL2-006',
  name: 'unconstrained-numeric-input',
  description: 'Numeric inputs should have validation constraints',
  severity: 'warning',
  category: 'best-practice',
  tags: ['input', 'validation'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    const numericFieldPatterns = ['amount', 'price', 'quantity', 'count', 'size', 'limit', 'offset', 'page'];

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];

      for (const field of behavior.input.fields) {
        const fieldName = field.name.name.toLowerCase();
        const fieldType = getTypeName(field.type);

        if (fieldType !== 'Int' && fieldType !== 'Decimal') continue;
        if (!numericFieldPatterns.some((p) => fieldName.includes(p))) continue;

        // Check if validated in preconditions
        const isValidated = behavior.preconditions.some((pre) =>
          expressionReferencesField(pre, field.name.name)
        );

        if (!isValidated) {
          diagnostics.push(
            report({
              node: field,
              elementName: `${behavior.name.name}.input.${field.name.name}`,
              message: `Numeric input "${field.name.name}" in "${behavior.name.name}" has no validation. It could accept negative or unreasonable values.`,
              fixes: [
                createFix({
                  id: `add-validation-${behavior.name.name}-${field.name.name}`,
                  title: 'Add positive constraint',
                  description: `Require ${field.name.name} > 0`,
                  patches: [
                    createPatch.insert(
                      `behaviors[${i}].preconditions`,
                      createComparisonExpression(`input.${field.name.name}`, '>', 0),
                      'last',
                      `Add ${field.name.name} > 0 constraint`
                    ),
                  ],
                  isAutomaticallySafe: false,
                  priority: 6,
                  category: 'add-constraint',
                }),
              ],
              tags: ['input', 'validation', 'numeric'],
            })
          );
        }
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Duplicate Preconditions (ISL2-007) - INFO
// ============================================================================

export const duplicatePreconditionsRule: LintRule = {
  id: 'ISL2-007',
  name: 'duplicate-preconditions',
  description: 'Detect redundant or duplicate preconditions',
  severity: 'info',
  category: 'best-practice',
  tags: ['precondition', 'redundancy'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      const seen = new Map<string, number>();

      for (let j = 0; j < behavior.preconditions.length; j++) {
        const pre = behavior.preconditions[j];
        const key = expressionToString(pre);

        if (seen.has(key)) {
          diagnostics.push(
            report({
              node: pre,
              elementName: behavior.name.name,
              message: `Duplicate precondition in "${behavior.name.name}": same constraint appears at index ${seen.get(key)} and ${j}`,
              fixes: [
                createFix({
                  id: `remove-duplicate-${behavior.name.name}-${j}`,
                  title: 'Remove duplicate',
                  description: 'Remove the duplicate precondition',
                  patches: [createPatch.remove(`behaviors[${i}].preconditions`, 'Remove duplicate', j)],
                  isAutomaticallySafe: true,
                  priority: 5,
                  category: 'remove-element',
                }),
              ],
              tags: ['duplicate', 'precondition'],
            })
          );
        } else {
          seen.set(key, j);
        }
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Rule: Missing Temporal Constraints (ISL2-008) - HINT
// ============================================================================

export const missingTemporalConstraintsRule: LintRule = {
  id: 'ISL2-008',
  name: 'missing-temporal-constraints',
  description: 'Async or long-running behaviors should have temporal constraints',
  severity: 'hint',
  category: 'best-practice',
  tags: ['temporal', 'async'],

  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report, createPatch, createFix } = context;

    const asyncPatterns = [
      'async',
      'process',
      'queue',
      'schedule',
      'batch',
      'webhook',
      'notify',
      'send',
      'email',
      'sms',
    ];

    for (let i = 0; i < domain.behaviors.length; i++) {
      const behavior = domain.behaviors[i];
      const name = behavior.name.name.toLowerCase();

      const isAsync = asyncPatterns.some((p) => name.includes(p));

      if (isAsync && behavior.temporal.length === 0) {
        diagnostics.push(
          report({
            node: behavior,
            elementName: behavior.name.name,
            message: `Async behavior "${behavior.name.name}" has no temporal constraints. Consider adding timeout or deadline specifications.`,
            fixes: [
              createFix({
                id: `add-temporal-${behavior.name.name}`,
                title: 'Add timeout constraint',
                description: 'Add a timeout of 30 seconds',
                patches: [
                  createPatch.insert(
                    `behaviors[${i}].temporal`,
                    createTemporalSpec('within', 30, 'seconds'),
                    'last',
                    'Add 30 second timeout'
                  ),
                ],
                isAutomaticallySafe: false,
                priority: 4,
                category: 'add-constraint',
              }),
            ],
            tags: ['temporal', 'timeout'],
          })
        );
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// Helper: Create AST Nodes
// ============================================================================

function createActorSpec(name: string, constraints: string[]): ActorSpec {
  return {
    kind: 'ActorSpec',
    name: createIdentifier(name),
    constraints: constraints.map((c) => createIdentifier(c)),
    location: createDefaultLocation(),
  };
}

function createIdentifier(name: string): Identifier {
  return {
    kind: 'Identifier',
    name,
    location: createDefaultLocation(),
  };
}

function createSuccessPostcondition(): PostconditionBlock {
  return {
    kind: 'PostconditionBlock',
    condition: 'success',
    predicates: [
      {
        kind: 'BinaryExpr',
        operator: '!=',
        left: {
          kind: 'MemberExpr',
          object: { kind: 'ResultExpr', location: createDefaultLocation() },
          property: createIdentifier('id'),
          location: createDefaultLocation(),
        },
        right: { kind: 'NullLiteral', location: createDefaultLocation() },
        location: createDefaultLocation(),
      } as BinaryExpr,
    ],
    location: createDefaultLocation(),
  };
}

function createSecuritySpec(type: 'rate_limit' | 'fraud_check' | 'requires', value: string): SecuritySpec {
  return {
    kind: 'SecuritySpec',
    type,
    details: {
      kind: 'StringLiteral',
      value,
      location: createDefaultLocation(),
    },
    location: createDefaultLocation(),
  };
}

function createErrorSpec(name: string, when: string, retriable: boolean): ASTNode {
  return {
    kind: 'ErrorSpec',
    name: createIdentifier(name),
    when: { kind: 'StringLiteral', value: when, location: createDefaultLocation() },
    retriable,
    location: createDefaultLocation(),
  } as ASTNode;
}

function createValidationPrecondition(category: keyof typeof SECURITY_PATTERNS): Expression {
  switch (category) {
    case 'auth':
      return createComparisonExpression('input.password.length', '>=', 8);
    case 'payment':
      return createComparisonExpression('input.amount', '>', 0);
    case 'upload':
      return createComparisonExpression('input.file.size', '<=', 10485760); // 10MB
    default:
      return createComparisonExpression('input != null', '==', true);
  }
}

function createComparisonExpression(left: string, op: string, right: number | boolean): BinaryExpr {
  const leftParts = left.split('.');
  let leftExpr: Expression;

  if (leftParts.length === 1) {
    leftExpr = createIdentifier(leftParts[0]);
  } else {
    leftExpr = leftParts.reduce((acc, part, idx) => {
      if (idx === 0) {
        return createIdentifier(part);
      }
      return {
        kind: 'MemberExpr',
        object: acc,
        property: createIdentifier(part),
        location: createDefaultLocation(),
      } as MemberExpr;
    }, {} as Expression);
  }

  return {
    kind: 'BinaryExpr',
    operator: op as BinaryExpr['operator'],
    left: leftExpr,
    right:
      typeof right === 'number'
        ? { kind: 'NumberLiteral', value: right, isFloat: false, location: createDefaultLocation() }
        : { kind: 'BooleanLiteral', value: right, location: createDefaultLocation() },
    location: createDefaultLocation(),
  };
}

function createTemporalSpec(
  operator: 'within' | 'eventually' | 'always',
  value: number,
  unit: 'ms' | 'seconds' | 'minutes'
): ASTNode {
  return {
    kind: 'TemporalSpec',
    operator,
    predicate: { kind: 'BooleanLiteral', value: true, location: createDefaultLocation() },
    duration: { kind: 'DurationLiteral', value, unit, location: createDefaultLocation() },
    location: createDefaultLocation(),
  } as ASTNode;
}

// ============================================================================
// Helper: Constraint Checking
// ============================================================================

function checkForImpossibleConstraint(expr: Expression): string[] {
  const issues: string[] = [];

  if (expr.kind === 'BinaryExpr') {
    const binary = expr as BinaryExpr;

    // Check for x != x (always false)
    if (binary.operator === '!=' && areExpressionsEqual(binary.left, binary.right)) {
      issues.push('Comparing value to itself with != is always false');
    }

    // Check for x < x or x > x (always false)
    if ((binary.operator === '<' || binary.operator === '>') && areExpressionsEqual(binary.left, binary.right)) {
      issues.push(`Comparing value to itself with ${binary.operator} is always false`);
    }

    // Check for contradictory numeric comparisons
    if (isNumericLiteral(binary.left) && isNumericLiteral(binary.right)) {
      const left = (binary.left as NumberLiteral).value;
      const right = (binary.right as NumberLiteral).value;

      if (binary.operator === '==' && left !== right) {
        issues.push(`${left} == ${right} is always false`);
      }
      if (binary.operator === '!=' && left === right) {
        issues.push(`${left} != ${right} is always false`);
      }
      if (binary.operator === '<' && left >= right) {
        issues.push(`${left} < ${right} is always false`);
      }
      if (binary.operator === '>' && left <= right) {
        issues.push(`${left} > ${right} is always false`);
      }
    }

    // Recursively check 'and' expressions
    if (binary.operator === 'and') {
      issues.push(...checkForImpossibleConstraint(binary.left));
      issues.push(...checkForImpossibleConstraint(binary.right));

      const contradiction = findContradiction(binary.left, binary.right);
      if (contradiction) {
        issues.push(contradiction);
      }
    }
  }

  return issues;
}

function areExpressionsEqual(a: Expression, b: Expression): boolean {
  if (a.kind !== b.kind) return false;

  if (a.kind === 'Identifier' && b.kind === 'Identifier') {
    return (a as Identifier).name === (b as Identifier).name;
  }

  if (a.kind === 'MemberExpr' && b.kind === 'MemberExpr') {
    const aMember = a as MemberExpr;
    const bMember = b as MemberExpr;
    return areExpressionsEqual(aMember.object, bMember.object) && aMember.property.name === bMember.property.name;
  }

  if (a.kind === 'NumberLiteral' && b.kind === 'NumberLiteral') {
    return (a as NumberLiteral).value === (b as NumberLiteral).value;
  }

  return false;
}

function isNumericLiteral(expr: Expression): expr is NumberLiteral {
  return expr.kind === 'NumberLiteral';
}

function findContradiction(left: Expression, right: Expression): string | null {
  if (left.kind !== 'BinaryExpr' || right.kind !== 'BinaryExpr') return null;

  const leftBin = left as BinaryExpr;
  const rightBin = right as BinaryExpr;

  if (!areExpressionsEqual(leftBin.left, rightBin.left)) return null;

  if (isNumericLiteral(leftBin.right) && isNumericLiteral(rightBin.right)) {
    const leftVal = (leftBin.right as NumberLiteral).value;
    const rightVal = (rightBin.right as NumberLiteral).value;

    if (
      (leftBin.operator === '>' || leftBin.operator === '>=') &&
      (rightBin.operator === '<' || rightBin.operator === '<=')
    ) {
      if (leftVal >= rightVal) {
        return `Contradictory constraints: value must be both > ${leftVal} and < ${rightVal}`;
      }
    }
  }

  return null;
}

// ============================================================================
// Helper: Utilities
// ============================================================================

function hasRateLimit(behavior: Behavior): boolean {
  return behavior.security.some((s) => s.type === 'rate_limit');
}

function hasFraudCheck(behavior: Behavior): boolean {
  return behavior.security.some((s) => s.type === 'fraud_check');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getTypeName(type: import('@isl-lang/parser').TypeDefinition): string {
  if (type.kind === 'PrimitiveType') return type.name;
  if (type.kind === 'ReferenceType') {
    return type.name.parts.map((p) => p.name).join('.');
  }
  return type.kind;
}

function expressionReferencesField(expr: Expression, fieldName: string): boolean {
  if (expr.kind === 'Identifier') {
    return (expr as Identifier).name === fieldName;
  }
  if (expr.kind === 'MemberExpr') {
    const member = expr as MemberExpr;
    if (
      member.object.kind === 'InputExpr' ||
      (member.object.kind === 'Identifier' && (member.object as Identifier).name === 'input')
    ) {
      return member.property.name === fieldName;
    }
    return expressionReferencesField(member.object, fieldName);
  }
  if (expr.kind === 'BinaryExpr') {
    const binary = expr as BinaryExpr;
    return expressionReferencesField(binary.left, fieldName) || expressionReferencesField(binary.right, fieldName);
  }
  return false;
}

function expressionToString(expr: Expression): string {
  if (expr.kind === 'Identifier') return (expr as Identifier).name;
  if (expr.kind === 'NumberLiteral') return String((expr as NumberLiteral).value);
  if (expr.kind === 'BooleanLiteral') return String((expr as BooleanLiteral).value);
  if (expr.kind === 'MemberExpr') {
    const m = expr as MemberExpr;
    return `${expressionToString(m.object)}.${m.property.name}`;
  }
  if (expr.kind === 'BinaryExpr') {
    const b = expr as BinaryExpr;
    return `(${expressionToString(b.left)} ${b.operator} ${expressionToString(b.right)})`;
  }
  return expr.kind;
}

// ============================================================================
// All Rules Export
// ============================================================================

export const ALL_RULES: LintRule[] = [
  minimumConstraintsRule,
  missingPostconditionsRule,
  ambiguousActorRule,
  impossibleConstraintsRule,
  missingErrorSpecRule,
  unconstrainedNumericInputRule,
  duplicatePreconditionsRule,
  missingTemporalConstraintsRule,
];

export const RULES_BY_ID = new Map<string, LintRule>(ALL_RULES.map((rule) => [rule.id, rule]));

export const RULES_BY_NAME = new Map<string, LintRule>(ALL_RULES.map((rule) => [rule.name, rule]));
