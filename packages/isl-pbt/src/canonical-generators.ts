// ============================================================================
// Canonical Generators - Production-grade generators for ISL types
// ============================================================================
//
// Provides comprehensive generators for:
// - Entities: User, Session, Account, etc.
// - Behaviors: Login, Logout, Transfer, etc.
// - Edge cases: Boundary values, malformed inputs, unicode, etc.
//
// These generators are designed to:
// 1. Produce valid inputs satisfying ISL preconditions
// 2. Generate edge cases that stress-test implementations
// 3. Be deterministic and reproducible via seed
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { PRNG, Generator, FieldConstraints } from './types.js';
import {
  BaseGenerator,
  createPRNG,
  string,
  integer,
  float,
  boolean,
  email,
  password,
  uuid,
  timestamp,
  ipAddress,
  array,
  map,
  set,
  oneOf,
  constant,
  fromEnum,
  optional,
  record,
  moneyAmount,
  duration,
} from './random.js';

// ============================================================================
// ENTITY GENERATORS
// ============================================================================

/**
 * User entity generator
 * Generates realistic user data with all common fields
 */
export function userEntity(options: {
  withId?: boolean;
  withEmail?: boolean;
  withPassword?: boolean;
  withRoles?: string[];
  withMetadata?: boolean;
} = {}): Generator<UserEntity> {
  const {
    withId = true,
    withEmail = true,
    withPassword = false,
    withRoles = ['user'],
    withMetadata = false,
  } = options;

  return new BaseGenerator(
    (prng, size) => {
      const user: UserEntity = {};

      if (withId) {
        user.id = uuid().generate(prng.fork(), size);
      }

      if (withEmail) {
        user.email = email().generate(prng.fork(), size);
      }

      if (withPassword) {
        user.password = password(8, 128).generate(prng.fork(), size);
      }

      if (withRoles.length > 0) {
        user.role = prng.pick(withRoles);
      }

      user.username = generateUsername(prng, size);
      user.createdAt = timestamp().generate(prng.fork(), size);
      user.active = prng.bool(0.9); // 90% active users

      if (withMetadata) {
        user.metadata = {
          lastLoginAt: timestamp().generate(prng.fork(), size),
          loginCount: prng.int(0, Math.min(1000, size * 10)),
          preferences: {},
        };
      }

      return user;
    },
    function* (value) {
      // Shrink by removing optional fields
      if (value.metadata) {
        yield { ...value, metadata: undefined };
      }
      if (value.role) {
        yield { ...value, role: 'user' };
      }
      // Shrink username
      if (value.username && value.username.length > 3) {
        yield { ...value, username: value.username.slice(0, 3) };
      }
    }
  );
}

export interface UserEntity {
  id?: string;
  email?: string;
  password?: string;
  username?: string;
  role?: string;
  createdAt?: string;
  active?: boolean;
  metadata?: {
    lastLoginAt?: string;
    loginCount?: number;
    preferences?: Record<string, unknown>;
  };
}

/**
 * Session entity generator
 */
export function sessionEntity(options: {
  userId?: string;
  maxDurationMs?: number;
} = {}): Generator<SessionEntity> {
  const { maxDurationMs = 86400000 } = options; // 24 hours default

  return new BaseGenerator(
    (prng, size) => ({
      sessionId: uuid().generate(prng.fork(), size),
      userId: options.userId ?? uuid().generate(prng.fork(), size),
      token: generateSecureToken(prng, 64),
      createdAt: timestamp().generate(prng.fork(), size),
      expiresAt: new Date(Date.now() + prng.int(0, maxDurationMs)).toISOString(),
      ipAddress: ipAddress().generate(prng.fork(), size),
      userAgent: generateUserAgent(prng),
      active: prng.bool(0.8),
    }),
    function* (value) {
      yield { ...value, userAgent: 'Mozilla/5.0' };
      yield { ...value, ipAddress: '127.0.0.1' };
    }
  );
}

export interface SessionEntity {
  sessionId: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  active: boolean;
}

/**
 * Account entity generator (for financial scenarios)
 */
export function accountEntity(options: {
  currencies?: string[];
  maxBalance?: number;
} = {}): Generator<AccountEntity> {
  const { currencies = ['USD', 'EUR', 'GBP'], maxBalance = 1000000 } = options;

  return new BaseGenerator(
    (prng, size) => ({
      accountId: uuid().generate(prng.fork(), size),
      ownerId: uuid().generate(prng.fork(), size),
      currency: prng.pick(currencies),
      balance: moneyAmount({ min: 0, max: Math.min(maxBalance, size * 100) }).generate(prng.fork(), size),
      status: prng.pick(['active', 'suspended', 'closed']),
      createdAt: timestamp().generate(prng.fork(), size),
      type: prng.pick(['checking', 'savings', 'business']),
    }),
    function* (value) {
      yield { ...value, balance: 0 };
      yield { ...value, status: 'active' };
      yield { ...value, type: 'checking' };
    }
  );
}

export interface AccountEntity {
  accountId: string;
  ownerId: string;
  currency: string;
  balance: number;
  status: string;
  createdAt: string;
  type: string;
}

/**
 * Transaction entity generator
 */
export function transactionEntity(options: {
  maxAmount?: number;
  currencies?: string[];
} = {}): Generator<TransactionEntity> {
  const { maxAmount = 100000, currencies = ['USD'] } = options;

  return new BaseGenerator(
    (prng, size) => ({
      transactionId: uuid().generate(prng.fork(), size),
      fromAccountId: uuid().generate(prng.fork(), size),
      toAccountId: uuid().generate(prng.fork(), size),
      amount: moneyAmount({ min: 0.01, max: Math.min(maxAmount, size * 100) }).generate(prng.fork(), size),
      currency: prng.pick(currencies),
      status: prng.pick(['pending', 'completed', 'failed', 'reversed']),
      createdAt: timestamp().generate(prng.fork(), size),
      description: generateDescription(prng, size),
      metadata: {},
    }),
    function* (value) {
      yield { ...value, amount: 0.01 };
      yield { ...value, description: '' };
      yield { ...value, status: 'pending' };
    }
  );
}

export interface TransactionEntity {
  transactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// BEHAVIOR GENERATORS
// ============================================================================

/**
 * Login behavior input generator
 */
export function loginBehaviorInput(options: {
  validOnly?: boolean;
  includeIP?: boolean;
  includeDevice?: boolean;
} = {}): Generator<LoginInput> {
  const { validOnly = true, includeIP = true, includeDevice = false } = options;

  if (validOnly) {
    return new BaseGenerator(
      (prng, size) => {
        const input: LoginInput = {
          email: email().generate(prng.fork(), size),
          password: password(8, 128).generate(prng.fork(), size),
        };
        if (includeIP) {
          input.ip_address = ipAddress().generate(prng.fork(), size);
        }
        if (includeDevice) {
          input.device_id = uuid().generate(prng.fork(), size);
        }
        return input;
      },
      function* (value) {
        // Shrink email
        if (value.email.length > 5) {
          const [local, domain] = value.email.split('@');
          if (local && domain && local.length > 1) {
            yield { ...value, email: `a@${domain}` };
          }
        }
        // Shrink password to minimum
        if (value.password.length > 8) {
          yield { ...value, password: value.password.slice(0, 8) };
        }
        // Remove optional fields
        if (value.ip_address) {
          yield { ...value, ip_address: '127.0.0.1' };
        }
        if (value.device_id) {
          const { device_id, ...rest } = value;
          yield rest;
        }
      }
    );
  }

  // Include invalid inputs for negative testing
  return oneOf(
    loginBehaviorInput({ validOnly: true, includeIP, includeDevice }),
    invalidLoginInput()
  );
}

export interface LoginInput {
  email: string;
  password: string;
  ip_address?: string;
  device_id?: string;
}

/**
 * Invalid login input generator for negative testing
 */
export function invalidLoginInput(): Generator<LoginInput> {
  return oneOf(
    // Invalid email formats
    record({
      email: oneOf(
        constant(''),
        constant('invalid'),
        constant('@no-local.com'),
        constant('no-domain@'),
        constant('spaces in@email.com'),
        string({ minLength: 1, maxLength: 10 }), // random non-email
      ),
      password: password(8, 128),
    }),
    // Invalid passwords
    record({
      email: email(),
      password: oneOf(
        constant(''),
        constant('short'),
        string({ minLength: 0, maxLength: 7 }), // too short
        string({ minLength: 129, maxLength: 200 }), // too long
      ),
    })
  ) as Generator<LoginInput>;
}

/**
 * Registration behavior input generator
 */
export function registerBehaviorInput(options: {
  validOnly?: boolean;
  requireConfirmPassword?: boolean;
} = {}): Generator<RegisterInput> {
  const { validOnly = true, requireConfirmPassword = true } = options;

  return new BaseGenerator(
    (prng, size) => {
      const pwd = password(8, 128).generate(prng.fork(), size);
      const input: RegisterInput = {
        email: email().generate(prng.fork(), size),
        password: pwd,
        username: generateUsername(prng, size),
      };
      if (requireConfirmPassword) {
        input.confirm_password = pwd;
      }
      return input;
    },
    function* (value) {
      yield { ...value, username: 'a' };
      if (value.email.length > 5) {
        yield { ...value, email: 'a@b.co' };
      }
    }
  );
}

export interface RegisterInput {
  email: string;
  password: string;
  confirm_password?: string;
  username: string;
}

/**
 * Transfer behavior input generator
 */
export function transferBehaviorInput(options: {
  maxAmount?: number;
  currencies?: string[];
} = {}): Generator<TransferInput> {
  const { maxAmount = 100000, currencies = ['USD'] } = options;

  return new BaseGenerator(
    (prng, size) => ({
      from_account_id: uuid().generate(prng.fork(), size),
      to_account_id: uuid().generate(prng.fork(), size),
      amount: moneyAmount({ min: 0.01, max: Math.min(maxAmount, size * 100) }).generate(prng.fork(), size),
      currency: prng.pick(currencies),
      description: prng.bool(0.5) ? generateDescription(prng, size) : undefined,
      idempotency_key: uuid().generate(prng.fork(), size),
    }),
    function* (value) {
      yield { ...value, amount: 0.01 };
      yield { ...value, description: undefined };
    }
  );
}

export interface TransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: string;
  description?: string;
  idempotency_key: string;
}

// ============================================================================
// EDGE CASE GENERATORS
// ============================================================================

/**
 * Edge case generator configuration
 */
export interface EdgeCaseConfig {
  includeEmpty: boolean;
  includeBoundary: boolean;
  includeUnicode: boolean;
  includeInjection: boolean;
  includeOverflow: boolean;
  includeNull: boolean;
}

const DEFAULT_EDGE_CASE_CONFIG: EdgeCaseConfig = {
  includeEmpty: true,
  includeBoundary: true,
  includeUnicode: true,
  includeInjection: true,
  includeOverflow: true,
  includeNull: true,
};

/**
 * Edge case string generator
 * Generates strings that test boundary conditions and special cases
 */
export function edgeCaseString(config: Partial<EdgeCaseConfig> = {}): Generator<string> {
  const cfg = { ...DEFAULT_EDGE_CASE_CONFIG, ...config };
  const cases: Generator<string>[] = [];

  if (cfg.includeEmpty) {
    cases.push(constant(''));
    cases.push(constant(' '));
    cases.push(constant('   ')); // multiple spaces
    cases.push(constant('\t'));
    cases.push(constant('\n'));
    cases.push(constant('\r\n'));
  }

  if (cfg.includeBoundary) {
    cases.push(constant('a')); // single char
    cases.push(string({ minLength: 255, maxLength: 255 })); // common max
    cases.push(string({ minLength: 256, maxLength: 256 })); // boundary + 1
    cases.push(string({ minLength: 1000, maxLength: 1000 })); // large
  }

  if (cfg.includeUnicode) {
    cases.push(constant('日本語')); // Japanese
    cases.push(constant('中文')); // Chinese
    cases.push(constant('العربية')); // Arabic (RTL)
    cases.push(constant('🎉🚀💻')); // Emoji
    cases.push(constant('test\u0000null')); // Null byte
    cases.push(constant('café')); // Accented
    cases.push(constant('ñoño')); // Spanish
    cases.push(constant('\u200B')); // Zero-width space
    cases.push(constant('a\u0301')); // Combining character (á)
  }

  if (cfg.includeInjection) {
    cases.push(constant("'; DROP TABLE users; --")); // SQL injection
    cases.push(constant('<script>alert(1)</script>')); // XSS
    cases.push(constant('{{constructor.constructor("return this")()}}')); // Template injection
    cases.push(constant('../../../etc/passwd')); // Path traversal
    cases.push(constant('$(whoami)')); // Command injection
    cases.push(constant('${7*7}')); // Expression injection
  }

  if (cfg.includeOverflow) {
    cases.push(string({ minLength: 10000, maxLength: 10000 })); // Very large
    cases.push(constant('a'.repeat(1000000))); // 1MB string
  }

  return oneOf(...cases);
}

/**
 * Edge case number generator
 */
export function edgeCaseNumber(config: Partial<EdgeCaseConfig> = {}): Generator<number> {
  const cfg = { ...DEFAULT_EDGE_CASE_CONFIG, ...config };
  const cases: Generator<number>[] = [];

  if (cfg.includeBoundary) {
    cases.push(constant(0));
    cases.push(constant(-0));
    cases.push(constant(1));
    cases.push(constant(-1));
    cases.push(constant(Number.MAX_SAFE_INTEGER));
    cases.push(constant(Number.MIN_SAFE_INTEGER));
    cases.push(constant(Number.MAX_VALUE));
    cases.push(constant(Number.MIN_VALUE));
    cases.push(constant(0.1 + 0.2)); // Floating point precision
    cases.push(constant(999999999999999)); // Large but safe
  }

  if (cfg.includeOverflow) {
    cases.push(constant(Infinity));
    cases.push(constant(-Infinity));
    cases.push(constant(NaN));
  }

  return oneOf(...cases);
}

/**
 * Edge case email generator
 */
export function edgeCaseEmail(config: Partial<EdgeCaseConfig> = {}): Generator<string> {
  const cfg = { ...DEFAULT_EDGE_CASE_CONFIG, ...config };
  const cases: Generator<string>[] = [];

  // Valid but unusual emails
  cases.push(constant('a@b.co')); // Minimal
  cases.push(constant('test+tag@example.com')); // Plus addressing
  cases.push(constant('test.name@example.com')); // Dots in local
  cases.push(constant('"test space"@example.com')); // Quoted local
  cases.push(constant('test@subdomain.example.com')); // Subdomain
  cases.push(constant('test@123.123.123.123')); // IP address domain

  if (cfg.includeEmpty) {
    cases.push(constant(''));
  }

  if (cfg.includeBoundary) {
    // 64 char local part (RFC limit)
    cases.push(constant('a'.repeat(64) + '@example.com'));
    // Very long domain
    cases.push(constant('a@' + 'x'.repeat(63) + '.com'));
  }

  if (cfg.includeUnicode) {
    cases.push(constant('tëst@example.com')); // Accented
    cases.push(constant('test@例え.jp')); // IDN
  }

  // Invalid formats for negative testing
  cases.push(constant('@example.com')); // Missing local
  cases.push(constant('test@')); // Missing domain
  cases.push(constant('test')); // No @
  cases.push(constant('test@@example.com')); // Double @
  cases.push(constant('test @example.com')); // Space

  return oneOf(...cases);
}

/**
 * Edge case money amount generator
 */
export function edgeCaseMoney(config: Partial<EdgeCaseConfig> = {}): Generator<number> {
  const cfg = { ...DEFAULT_EDGE_CASE_CONFIG, ...config };
  const cases: Generator<number>[] = [];

  if (cfg.includeBoundary) {
    cases.push(constant(0)); // Zero
    cases.push(constant(0.01)); // Minimum cent
    cases.push(constant(0.001)); // Sub-cent (invalid)
    cases.push(constant(0.005)); // Rounding boundary
    cases.push(constant(0.995)); // Rounding boundary
    cases.push(constant(1)); // One dollar
    cases.push(constant(100)); // Hundred
    cases.push(constant(999.99)); // Just under 1000
    cases.push(constant(1000)); // Thousand
    cases.push(constant(999999.99)); // Near max typical
  }

  if (cfg.includeOverflow) {
    cases.push(constant(Number.MAX_SAFE_INTEGER));
    cases.push(constant(9999999999999.99)); // 13 digits
  }

  // Negative (typically invalid for money)
  cases.push(constant(-0.01));
  cases.push(constant(-1));
  cases.push(constant(-1000));

  return oneOf(...cases);
}

/**
 * Edge case array generator
 */
export function edgeCaseArray<T>(elementGen: Generator<T>, config: Partial<EdgeCaseConfig> = {}): Generator<T[]> {
  const cfg = { ...DEFAULT_EDGE_CASE_CONFIG, ...config };
  const cases: Generator<T[]>[] = [];

  if (cfg.includeEmpty) {
    cases.push(constant([]));
  }

  if (cfg.includeBoundary) {
    cases.push(array(elementGen, { minLength: 1, maxLength: 1 })); // Single element
    cases.push(array(elementGen, { minLength: 100, maxLength: 100 })); // Large
  }

  if (cfg.includeOverflow) {
    cases.push(array(elementGen, { minLength: 1000, maxLength: 1000 })); // Very large
  }

  // Add duplicates case
  cases.push(
    new BaseGenerator(
      (prng, size) => {
        const element = elementGen.generate(prng.fork(), size);
        const count = prng.int(2, Math.min(10, size));
        return Array(count).fill(element);
      },
      () => []
    )
  );

  return oneOf(...cases);
}

// ============================================================================
// COMPOSITE EDGE CASE GENERATOR
// ============================================================================

/**
 * Generate edge case inputs for any behavior based on its input spec
 */
export function edgeCaseInputs(
  inputSpec: Array<{ name: string; type: string; constraints?: FieldConstraints }>,
  config: Partial<EdgeCaseConfig> = {}
): Generator<Record<string, unknown>> {
  return new BaseGenerator(
    (prng, size) => {
      const input: Record<string, unknown> = {};

      for (const field of inputSpec) {
        input[field.name] = generateEdgeCaseValue(field.type, field.constraints, prng, size, config);
      }

      return input;
    },
    function* (value) {
      // Shrink by replacing edge cases with simple valid values
      for (const key of Object.keys(value)) {
        yield { ...value, [key]: getSimpleValue(value[key]) };
      }
    }
  );
}

function generateEdgeCaseValue(
  type: string,
  constraints: FieldConstraints | undefined,
  prng: PRNG,
  size: number,
  config: Partial<EdgeCaseConfig>
): unknown {
  switch (type.toLowerCase()) {
    case 'string':
      return edgeCaseString(config).generate(prng.fork(), size);
    case 'email':
      return edgeCaseEmail(config).generate(prng.fork(), size);
    case 'money':
    case 'decimal':
      return edgeCaseMoney(config).generate(prng.fork(), size);
    case 'int':
    case 'integer':
    case 'number':
      return edgeCaseNumber(config).generate(prng.fork(), size);
    case 'password':
      return edgeCaseString({ ...config, includeInjection: true }).generate(prng.fork(), size);
    default:
      return edgeCaseString(config).generate(prng.fork(), size);
  }
}

function getSimpleValue(value: unknown): unknown {
  if (typeof value === 'string') return 'a';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return [];
  if (typeof value === 'object' && value !== null) return {};
  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateUsername(prng: PRNG, size: number): string {
  const prefixes = ['user', 'test', 'demo', 'dev', 'admin', 'guest'];
  const prefix = prng.pick(prefixes);
  const suffix = prng.int(1, Math.min(9999, size * 100));
  return `${prefix}${suffix}`;
}

function generateSecureToken(prng: PRNG, length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(prng.random() * chars.length)];
  }
  return result;
}

function generateUserAgent(prng: PRNG): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    'Mozilla/5.0 (Android 11; Mobile)',
  ];
  return prng.pick(agents);
}

function generateDescription(prng: PRNG, size: number): string {
  const words = ['payment', 'transfer', 'refund', 'subscription', 'invoice', 'fee'];
  const count = prng.int(1, Math.min(5, size));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(prng.pick(words));
  }
  return result.join(' ');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_EDGE_CASE_CONFIG,
};
