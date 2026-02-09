// ============================================================================
// Test Fixtures — Programmatic ISL AST for auth & payments domains
// ============================================================================

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  TypeExpression,
  TypeConstraint,
  Annotation,
  Identifier,
  StringLiteral,
  NumberLiteral,
  InputBlock,
  OutputBlock,
  ErrorDeclaration,
  ConditionBlock,
  Condition,
  ConditionStatement,
  SourceSpan,
} from '@isl-lang/isl-core';

const SPAN: SourceSpan = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 }, source: '' };

function id(name: string): Identifier {
  return { kind: 'Identifier', name, span: SPAN };
}

function str(value: string): StringLiteral {
  return { kind: 'StringLiteral', value, span: SPAN };
}

function num(value: number): NumberLiteral {
  return { kind: 'NumberLiteral', value, span: SPAN };
}

function simpleType(name: string): TypeExpression {
  return { kind: 'SimpleType', name: id(name), span: SPAN };
}

function field(
  name: string,
  typeName: string,
  opts: { optional?: boolean; annotations?: string[]; constraints?: Array<{ name: string; value?: number | string }> } = {},
): FieldDeclaration {
  const annotations: Annotation[] = (opts.annotations ?? []).map((a) => ({
    kind: 'Annotation' as const,
    name: id(a),
    span: SPAN,
  }));

  const constraints: TypeConstraint[] = (opts.constraints ?? []).map((c) => ({
    kind: 'TypeConstraint' as const,
    name: id(c.name),
    value: c.value !== undefined
      ? typeof c.value === 'number' ? num(c.value) : str(c.value as string)
      : undefined,
    span: SPAN,
  }));

  return {
    kind: 'FieldDeclaration',
    name: id(name),
    type: simpleType(typeName),
    optional: opts.optional ?? false,
    annotations,
    constraints,
    span: SPAN,
  };
}

function errorDecl(name: string, when: string, retriable: boolean): ErrorDeclaration {
  return {
    kind: 'ErrorDeclaration',
    name: id(name),
    when: str(when),
    retriable,
    span: SPAN,
  };
}

// ============================================================================
// Auth Domain
// ============================================================================

const userStatusEnum: EnumDeclaration = {
  kind: 'EnumDeclaration',
  name: id('UserStatus'),
  variants: [id('ACTIVE'), id('INACTIVE'), id('LOCKED'), id('PENDING_VERIFICATION')],
  span: SPAN,
};

const userEntity: EntityDeclaration = {
  kind: 'EntityDeclaration',
  name: id('User'),
  fields: [
    field('id', 'UUID', { annotations: ['immutable', 'unique'] }),
    field('email', 'String', { annotations: ['unique', 'indexed'] }),
    field('password_hash', 'String', { annotations: ['secret'] }),
    field('status', 'UserStatus', { annotations: ['indexed'] }),
  ],
  span: SPAN,
};

const sessionEntity: EntityDeclaration = {
  kind: 'EntityDeclaration',
  name: id('Session'),
  fields: [
    field('id', 'UUID', { annotations: ['immutable', 'unique'] }),
    field('user_id', 'UUID', { annotations: ['immutable', 'indexed'] }),
    field('expires_at', 'Timestamp'),
    field('revoked', 'Boolean'),
    field('ip_address', 'String'),
  ],
  span: SPAN,
};

const loginPreConditions: ConditionBlock = {
  kind: 'ConditionBlock',
  conditions: [
    {
      kind: 'Condition',
      implies: false,
      statements: [
        {
          kind: 'ConditionStatement',
          expression: {
            kind: 'MemberExpression',
            object: id('email'),
            property: id('is_valid'),
            span: SPAN,
          },
          span: SPAN,
        },
        {
          kind: 'ConditionStatement',
          expression: {
            kind: 'ComparisonExpression',
            operator: '>=',
            left: {
              kind: 'MemberExpression',
              object: id('password'),
              property: id('length'),
              span: SPAN,
            },
            right: num(8),
            span: SPAN,
          },
          span: SPAN,
        },
      ],
      span: SPAN,
    },
  ],
  span: SPAN,
};

const loginBehavior: BehaviorDeclaration = {
  kind: 'BehaviorDeclaration',
  name: id('Login'),
  input: {
    kind: 'InputBlock',
    fields: [
      field('email', 'String'),
      field('password', 'String', { annotations: ['sensitive'] }),
      field('ip_address', 'String'),
    ],
    span: SPAN,
  },
  output: {
    kind: 'OutputBlock',
    success: simpleType('Session'),
    errors: [
      errorDecl('INVALID_CREDENTIALS', 'Email or password is incorrect', true),
      errorDecl('USER_NOT_FOUND', 'No user exists with this email', false),
      errorDecl('USER_LOCKED', 'User account is locked', true),
    ],
    span: SPAN,
  },
  preconditions: loginPreConditions,
  span: SPAN,
};

const registerPreConditions: ConditionBlock = {
  kind: 'ConditionBlock',
  conditions: [
    {
      kind: 'Condition',
      implies: false,
      statements: [
        {
          kind: 'ConditionStatement',
          expression: {
            kind: 'MemberExpression',
            object: id('email'),
            property: id('is_valid'),
            span: SPAN,
          },
          span: SPAN,
        },
        {
          kind: 'ConditionStatement',
          expression: {
            kind: 'ComparisonExpression',
            operator: '>=',
            left: {
              kind: 'MemberExpression',
              object: id('password'),
              property: id('length'),
              span: SPAN,
            },
            right: num(8),
            span: SPAN,
          },
          span: SPAN,
        },
        {
          kind: 'ConditionStatement',
          expression: {
            kind: 'ComparisonExpression',
            operator: '==',
            left: id('password'),
            right: id('confirm_password'),
            span: SPAN,
          },
          span: SPAN,
        },
      ],
      span: SPAN,
    },
  ],
  span: SPAN,
};

const registerBehavior: BehaviorDeclaration = {
  kind: 'BehaviorDeclaration',
  name: id('Register'),
  input: {
    kind: 'InputBlock',
    fields: [
      field('email', 'String'),
      field('password', 'String', { annotations: ['sensitive'] }),
      field('confirm_password', 'String', { annotations: ['sensitive'] }),
    ],
    span: SPAN,
  },
  output: {
    kind: 'OutputBlock',
    success: simpleType('User'),
    errors: [
      errorDecl('EMAIL_ALREADY_EXISTS', 'A user with this email already exists', false),
      errorDecl('PASSWORDS_DO_NOT_MATCH', 'Password and confirmation do not match', true),
    ],
    span: SPAN,
  },
  preconditions: registerPreConditions,
  span: SPAN,
};

export const authDomain: DomainDeclaration = {
  kind: 'DomainDeclaration',
  name: id('UserAuthentication'),
  version: str('1.0.0'),
  uses: [],
  imports: [],
  entities: [userEntity, sessionEntity],
  types: [],
  enums: [userStatusEnum],
  behaviors: [loginBehavior, registerBehavior],
  invariants: [],
  span: SPAN,
};

// ============================================================================
// Payments Domain
// ============================================================================

const accountEntity: EntityDeclaration = {
  kind: 'EntityDeclaration',
  name: id('Account'),
  fields: [
    field('id', 'UUID'),
    field('balance', 'Decimal'),
    field('isActive', 'Boolean'),
  ],
  span: SPAN,
};

const transferPreConditions: ConditionBlock = {
  kind: 'ConditionBlock',
  conditions: [
    {
      kind: 'Condition',
      implies: false,
      statements: [
        {
          kind: 'ConditionStatement',
          expression: {
            kind: 'ComparisonExpression',
            operator: '>',
            left: id('amount'),
            right: num(0),
            span: SPAN,
          },
          span: SPAN,
        },
      ],
      span: SPAN,
    },
  ],
  span: SPAN,
};

const transferBehavior: BehaviorDeclaration = {
  kind: 'BehaviorDeclaration',
  name: id('TransferFunds'),
  input: {
    kind: 'InputBlock',
    fields: [
      field('senderId', 'UUID'),
      field('receiverId', 'UUID'),
      field('amount', 'Decimal'),
    ],
    span: SPAN,
  },
  output: {
    kind: 'OutputBlock',
    success: simpleType('Account'),
    errors: [],
    span: SPAN,
  },
  preconditions: transferPreConditions,
  span: SPAN,
};

export const paymentsDomain: DomainDeclaration = {
  kind: 'DomainDeclaration',
  name: id('Payments'),
  version: str('1.0.0'),
  uses: [],
  imports: [],
  entities: [accountEntity],
  types: [],
  enums: [],
  behaviors: [transferBehavior],
  invariants: [],
  span: SPAN,
};
