/**
 * ISL Linter V2 - Test Fixtures
 *
 * 10 fixture ASTs covering various lint rules and fix scenarios.
 */

import type {
  Domain,
  Behavior,
  Entity,
  InputSpec,
  OutputSpec,
  PostconditionBlock,
  ActorSpec,
  SecuritySpec,
  TemporalSpec,
  ErrorSpec,
  Field,
  Expression,
  Identifier,
  SourceLocation,
} from '@isl-lang/parser';

// ============================================================================
// Helper Functions
// ============================================================================

function loc(line = 1, column = 1, endLine = line, endColumn = column + 10): SourceLocation {
  return { file: 'test.isl', line, column, endLine, endColumn };
}

function id(name: string, line = 1): Identifier {
  return { kind: 'Identifier', name, location: loc(line) };
}

function field(name: string, typeName: string, optional = false): Field {
  return {
    kind: 'Field',
    name: id(name),
    type: { kind: 'PrimitiveType', name: typeName as 'String' | 'Int' | 'Decimal', location: loc() },
    optional,
    annotations: [],
    location: loc(),
  };
}

function inputSpec(fields: Field[]): InputSpec {
  return { kind: 'InputSpec', fields, location: loc() };
}

function outputSpec(successType: string, errors: ErrorSpec[] = []): OutputSpec {
  return {
    kind: 'OutputSpec',
    success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [id(successType)], location: loc() }, location: loc() },
    errors,
    location: loc(),
  };
}

function errorSpec(name: string, when: string, retriable = false): ErrorSpec {
  return {
    kind: 'ErrorSpec',
    name: id(name),
    when: { kind: 'StringLiteral', value: when, location: loc() },
    retriable,
    location: loc(),
  };
}

function postcondition(predicates: Expression[]): PostconditionBlock {
  return { kind: 'PostconditionBlock', condition: 'success', predicates, location: loc() };
}

function actor(name: string, constraints: Expression[] = []): ActorSpec {
  return { kind: 'ActorSpec', name: id(name), constraints, location: loc() };
}

function security(type: 'rate_limit' | 'fraud_check' | 'requires', value: string): SecuritySpec {
  return {
    kind: 'SecuritySpec',
    type,
    details: { kind: 'StringLiteral', value, location: loc() },
    location: loc(),
  };
}

function temporal(operator: 'within' | 'eventually', duration: number, unit: 'seconds' | 'minutes'): TemporalSpec {
  return {
    kind: 'TemporalSpec',
    operator,
    predicate: { kind: 'BooleanLiteral', value: true, location: loc() },
    duration: { kind: 'DurationLiteral', value: duration, unit, location: loc() },
    location: loc(),
  };
}

function comparison(left: string, op: string, right: number): Expression {
  const parts = left.split('.');
  let leftExpr: Expression = id(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    leftExpr = { kind: 'MemberExpr', object: leftExpr, property: id(parts[i]), location: loc() };
  }
  return {
    kind: 'BinaryExpr',
    operator: op as '>' | '<' | '>=' | '<=' | '==' | '!=',
    left: leftExpr,
    right: { kind: 'NumberLiteral', value: right, isFloat: false, location: loc() },
    location: loc(),
  };
}

function behavior(
  name: string,
  opts: {
    actors?: ActorSpec[];
    input?: Field[];
    output?: { success: string; errors?: ErrorSpec[] };
    preconditions?: Expression[];
    postconditions?: PostconditionBlock[];
    security?: SecuritySpec[];
    temporal?: TemporalSpec[];
    description?: string;
  } = {}
): Behavior {
  return {
    kind: 'Behavior',
    name: id(name),
    description: opts.description ? { kind: 'StringLiteral', value: opts.description, location: loc() } : undefined,
    actors: opts.actors ?? [],
    input: inputSpec(opts.input ?? []),
    output: outputSpec(opts.output?.success ?? 'Result', opts.output?.errors ?? []),
    preconditions: opts.preconditions ?? [],
    postconditions: opts.postconditions ?? [],
    invariants: [],
    temporal: opts.temporal ?? [],
    security: opts.security ?? [],
    compliance: [],
    location: loc(),
  };
}

function domain(name: string, behaviors: Behavior[], entities: Entity[] = []): Domain {
  return {
    kind: 'Domain',
    name: id(name),
    version: { kind: 'StringLiteral', value: '1.0.0', location: loc() },
    imports: [],
    types: [],
    entities,
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  };
}

// ============================================================================
// Fixture 1: Auth behavior missing constraints (ISL2-001)
// ============================================================================

export const fixture1_authMissingConstraints: Domain = domain('AuthMissingConstraints', [
  behavior('authenticateUser', {
    input: [field('email', 'String'), field('password', 'String')],
    output: { success: 'AuthToken' },
    // Missing: actors, preconditions, postconditions, security
  }),
]);

// ============================================================================
// Fixture 2: Payment behavior missing fraud check (ISL2-001)
// ============================================================================

export const fixture2_paymentMissingFraudCheck: Domain = domain('PaymentMissingFraudCheck', [
  behavior('processPayment', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('amount', 'Decimal'), field('currency', 'String')],
    output: { success: 'PaymentResult' },
    preconditions: [comparison('input.amount', '>', 0)],
    postconditions: [postcondition([comparison('result.success', '==', 1)])],
    security: [security('rate_limit', '10 per minute')],
    // Missing: fraud_check
  }),
]);

// ============================================================================
// Fixture 3: Upload behavior missing size validation (ISL2-001)
// ============================================================================

export const fixture3_uploadMissingValidation: Domain = domain('UploadMissingValidation', [
  behavior('uploadFile', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('fileName', 'String'), field('fileSize', 'Int'), field('contentType', 'String')],
    output: { success: 'UploadResult' },
    // Missing: preconditions for file size/type
    postconditions: [postcondition([comparison('result.id', '!=', 0)])],
  }),
]);

// ============================================================================
// Fixture 4: Critical behavior missing postconditions (ISL2-002)
// ============================================================================

export const fixture4_missingPostconditions: Domain = domain('MissingPostconditions', [
  behavior('createUser', {
    actors: [actor('Admin', [id('hasRole_admin')])],
    input: [field('email', 'String'), field('name', 'String')],
    output: { success: 'User' },
    preconditions: [comparison('input.email.length', '>', 0)],
    // Missing: postconditions
  }),
  behavior('deleteAccount', {
    actors: [actor('User', [id('authenticated'), id('isOwner')])],
    input: [field('accountId', 'String')],
    output: { success: 'Boolean' },
    preconditions: [comparison('input.accountId.length', '>', 0)],
    // Missing: postconditions
  }),
]);

// ============================================================================
// Fixture 5: Ambiguous actor/subject (ISL2-003)
// ============================================================================

export const fixture5_ambiguousActor: Domain = domain('AmbiguousActor', [
  // No actors at all for security-sensitive behavior
  behavior('approveTransaction', {
    input: [field('transactionId', 'String')],
    output: { success: 'Boolean' },
    preconditions: [comparison('input.transactionId.length', '>', 0)],
    postconditions: [postcondition([comparison('result', '==', 1)])],
  }),
  // Actor without constraints
  behavior('grantPermission', {
    actors: [actor('User')], // No constraints
    input: [field('userId', 'String'), field('permission', 'String')],
    output: { success: 'Boolean' },
    postconditions: [postcondition([comparison('result', '==', 1)])],
  }),
]);

// ============================================================================
// Fixture 6: Impossible constraints (ISL2-004)
// ============================================================================

export const fixture6_impossibleConstraints: Domain = domain('ImpossibleConstraints', [
  behavior('impossiblePrecondition', {
    input: [field('value', 'Int')],
    output: { success: 'Boolean' },
    preconditions: [
      // x != x is always false
      {
        kind: 'BinaryExpr',
        operator: '!=',
        left: { kind: 'MemberExpr', object: id('input'), property: id('value'), location: loc() },
        right: { kind: 'MemberExpr', object: id('input'), property: id('value'), location: loc() },
        location: loc(),
      },
    ],
    postconditions: [postcondition([comparison('result', '==', 1)])],
  }),
  behavior('contradictoryConstraints', {
    input: [field('amount', 'Int')],
    output: { success: 'Boolean' },
    preconditions: [
      // 5 < 3 is always false
      {
        kind: 'BinaryExpr',
        operator: '<',
        left: { kind: 'NumberLiteral', value: 5, isFloat: false, location: loc() },
        right: { kind: 'NumberLiteral', value: 3, isFloat: false, location: loc() },
        location: loc(),
      },
    ],
    postconditions: [postcondition([comparison('result', '==', 1)])],
  }),
]);

// ============================================================================
// Fixture 7: Missing error specifications (ISL2-005)
// ============================================================================

export const fixture7_missingErrorSpecs: Domain = domain('MissingErrorSpecs', [
  behavior('updateProfile', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('name', 'String'), field('bio', 'String')],
    output: { success: 'Profile' }, // No errors defined
    preconditions: [comparison('input.name.length', '>', 0)],
    postconditions: [postcondition([comparison('result.id', '!=', 0)])],
  }),
  behavior('transferFunds', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('toAccount', 'String'), field('amount', 'Decimal')],
    output: { success: 'Transfer' }, // No errors defined for financial operation
    preconditions: [comparison('input.amount', '>', 0)],
    postconditions: [postcondition([comparison('result.id', '!=', 0)])],
  }),
]);

// ============================================================================
// Fixture 8: Unconstrained numeric input (ISL2-006)
// ============================================================================

export const fixture8_unconstrainedNumeric: Domain = domain('UnconstrainedNumeric', [
  behavior('setPrice', {
    actors: [actor('Admin', [id('authenticated')])],
    input: [field('productId', 'String'), field('price', 'Decimal')], // price not validated
    output: { success: 'Product' },
    preconditions: [comparison('input.productId.length', '>', 0)], // Only validates productId
    postconditions: [postcondition([comparison('result.id', '!=', 0)])],
  }),
  behavior('orderItems', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('itemId', 'String'), field('quantity', 'Int')], // quantity not validated
    output: { success: 'Order' },
    preconditions: [comparison('input.itemId.length', '>', 0)], // Only validates itemId
    postconditions: [postcondition([comparison('result.id', '!=', 0)])],
  }),
]);

// ============================================================================
// Fixture 9: Duplicate preconditions (ISL2-007)
// ============================================================================

export const fixture9_duplicatePreconditions: Domain = domain('DuplicatePreconditions', [
  behavior('processWithDuplicates', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('value', 'Int')],
    output: { success: 'Result' },
    preconditions: [
      comparison('input.value', '>', 0),
      comparison('input.value', '<', 100),
      comparison('input.value', '>', 0), // Duplicate
    ],
    postconditions: [postcondition([comparison('result.id', '!=', 0)])],
  }),
]);

// ============================================================================
// Fixture 10: Missing temporal constraints (ISL2-008)
// ============================================================================

export const fixture10_missingTemporal: Domain = domain('MissingTemporal', [
  behavior('sendNotification', {
    actors: [actor('System')],
    input: [field('userId', 'String'), field('message', 'String')],
    output: { success: 'NotificationResult' },
    preconditions: [comparison('input.message.length', '>', 0)],
    postconditions: [postcondition([comparison('result.sent', '==', 1)])],
    // Missing: temporal constraints for async operation
  }),
  behavior('processWebhook', {
    actors: [actor('System')],
    input: [field('payload', 'String'), field('signature', 'String')],
    output: { success: 'WebhookResult' },
    preconditions: [comparison('input.payload.length', '>', 0)],
    postconditions: [postcondition([comparison('result.processed', '==', 1)])],
    // Missing: temporal constraints for webhook processing
  }),
]);

// ============================================================================
// Valid Fixture: Well-formed domain (should pass all rules)
// ============================================================================

export const fixtureValid_wellFormed: Domain = domain('WellFormedDomain', [
  behavior('login', {
    actors: [actor('User', [id('authenticated')])],
    input: [field('email', 'String'), field('password', 'String')],
    output: {
      success: 'AuthToken',
      errors: [
        errorSpec('INVALID_CREDENTIALS', 'Invalid email or password'),
        errorSpec('ACCOUNT_LOCKED', 'Account is locked', true),
      ],
    },
    preconditions: [comparison('input.email.length', '>', 0), comparison('input.password.length', '>=', 8)],
    postconditions: [postcondition([comparison('result.token.length', '>', 0)])],
    security: [security('rate_limit', '5 per minute')],
    temporal: [temporal('within', 30, 'seconds')],
  }),
]);

// ============================================================================
// All Fixtures Export
// ============================================================================

export const ALL_FIXTURES = {
  fixture1_authMissingConstraints,
  fixture2_paymentMissingFraudCheck,
  fixture3_uploadMissingValidation,
  fixture4_missingPostconditions,
  fixture5_ambiguousActor,
  fixture6_impossibleConstraints,
  fixture7_missingErrorSpecs,
  fixture8_unconstrainedNumeric,
  fixture9_duplicatePreconditions,
  fixture10_missingTemporal,
  fixtureValid_wellFormed,
};

export type FixtureKey = keyof typeof ALL_FIXTURES;
