// ============================================================================
// Login Domain Generator
// ============================================================================
// 
// Specialized generators for login behavior inputs that satisfy:
//   - email.is_valid_format
//   - password.length >= 8
//   - password.length <= 128
//
// These generators ensure all outputs satisfy ISL preconditions by construction.
// ============================================================================

import type { Generator, PRNG, FieldConstraints } from './types.js';
import { BaseGenerator, createPRNG, string, ipAddress, uuid } from './random.js';

// ============================================================================
// LOGIN INPUT CONSTRAINTS
// ============================================================================

/** 
 * Login preconditions as defined in login.isl 
 */
export interface LoginPreconditions {
  email: {
    isValidFormat: true;
  };
  password: {
    minLength: 8;
    maxLength: 128;
  };
  ipAddress?: {
    required: boolean;
  };
}

/**
 * Default login preconditions from login.isl
 */
export const DEFAULT_LOGIN_PRECONDITIONS: LoginPreconditions = {
  email: { isValidFormat: true },
  password: { minLength: 8, maxLength: 128 },
  ipAddress: { required: true },
};

// ============================================================================
// EMAIL GENERATOR (Precondition: is_valid_format)
// ============================================================================

const VALID_LOCAL_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const VALID_LOCAL_SPECIAL = '._%+-';
const VALID_DOMAINS = [
  'example.com',
  'test.org', 
  'demo.net',
  'sample.io',
  'mail.example.com',
  'corp.example.org',
];

/**
 * Generate a valid email that satisfies: email.is_valid_format
 * 
 * Email format requirements:
 * - Local part: alphanumeric with allowed special chars (._%+-)
 * - Single @ symbol
 * - Domain: valid domain name with TLD
 */
export function validEmail(options: {
  minLocalLength?: number;
  maxLocalLength?: number;
  domains?: string[];
} = {}): Generator<string> {
  const {
    minLocalLength = 1,
    maxLocalLength = 64,
    domains = VALID_DOMAINS,
  } = options;

  return new BaseGenerator(
    (prng, size) => {
      // Generate local part length based on size parameter
      const localLen = prng.int(
        minLocalLength, 
        Math.min(maxLocalLength, Math.max(minLocalLength, size))
      );
      
      // Build local part - ensure valid format
      let local = '';
      
      // First char must be alphanumeric
      local += VALID_LOCAL_CHARS[Math.floor(prng.random() * VALID_LOCAL_CHARS.length)];
      
      // Middle chars can include specials, but not consecutive dots
      const allLocalChars = VALID_LOCAL_CHARS + VALID_LOCAL_SPECIAL;
      let lastWasDot = false;
      
      for (let i = 1; i < localLen - 1; i++) {
        if (lastWasDot) {
          // Can't have consecutive dots - use alphanumeric
          local += VALID_LOCAL_CHARS[Math.floor(prng.random() * VALID_LOCAL_CHARS.length)];
          lastWasDot = false;
        } else {
          const char = allLocalChars[Math.floor(prng.random() * allLocalChars.length)];
          local += char;
          lastWasDot = char === '.';
        }
      }
      
      // Last char must be alphanumeric
      if (localLen > 1) {
        local += VALID_LOCAL_CHARS[Math.floor(prng.random() * VALID_LOCAL_CHARS.length)];
      }
      
      // Pick domain
      const domain = prng.pick(domains);
      
      return `${local}@${domain}`;
    },
    function* (email) {
      const [local, domain] = email.split('@');
      if (!local || !domain) return;
      
      // Shrink to shorter local parts while maintaining validity
      if (local.length > 1) {
        yield `${local[0]}@${domain}`;
      }
      if (local.length > 3) {
        yield `${local.slice(0, Math.ceil(local.length / 2))}@${domain}`;
      }
      
      // Try simpler domain
      if (domain !== 'example.com') {
        yield `${local}@example.com`;
      }
      
      // Simplest valid email
      if (email !== 'a@b.co') {
        yield 'a@b.co';
      }
    }
  );
}

// ============================================================================
// PASSWORD GENERATOR (Preconditions: length >= 8 AND length <= 128)
// ============================================================================

const PASSWORD_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const PASSWORD_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PASSWORD_DIGITS = '0123456789';
const PASSWORD_SPECIAL = '!@#$%^&*()-_=+';
const PASSWORD_ALL = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS + PASSWORD_SPECIAL;

/**
 * Generate a valid password that satisfies:
 *   - password.length >= minLength (default: 8)
 *   - password.length <= maxLength (default: 128)
 * 
 * Generated passwords include mix of character types for realism.
 */
export function validPassword(options: {
  minLength?: number;
  maxLength?: number;
  requireLower?: boolean;
  requireUpper?: boolean;
  requireDigit?: boolean;
  requireSpecial?: boolean;
} = {}): Generator<string> {
  const {
    minLength = 8,
    maxLength = 128,
    requireLower = true,
    requireUpper = true,
    requireDigit = true,
    requireSpecial = false,
  } = options;

  // Calculate minimum required length for required character types
  const minRequired = (requireLower ? 1 : 0) + 
                     (requireUpper ? 1 : 0) + 
                     (requireDigit ? 1 : 0) + 
                     (requireSpecial ? 1 : 0);
  
  const effectiveMinLength = Math.max(minLength, minRequired);

  return new BaseGenerator(
    (prng, size) => {
      // Generate length within constraints, scaled by size
      const targetLen = prng.int(
        effectiveMinLength,
        Math.min(maxLength, Math.max(effectiveMinLength, size + 8))
      );
      
      const chars: string[] = [];
      
      // Add required character types first
      if (requireLower) {
        chars.push(PASSWORD_LOWER[Math.floor(prng.random() * PASSWORD_LOWER.length)]!);
      }
      if (requireUpper) {
        chars.push(PASSWORD_UPPER[Math.floor(prng.random() * PASSWORD_UPPER.length)]!);
      }
      if (requireDigit) {
        chars.push(PASSWORD_DIGITS[Math.floor(prng.random() * PASSWORD_DIGITS.length)]!);
      }
      if (requireSpecial) {
        chars.push(PASSWORD_SPECIAL[Math.floor(prng.random() * PASSWORD_SPECIAL.length)]!);
      }
      
      // Fill remaining length with random characters
      while (chars.length < targetLen) {
        chars.push(PASSWORD_ALL[Math.floor(prng.random() * PASSWORD_ALL.length)]!);
      }
      
      // Shuffle to avoid predictable positions
      return prng.shuffle(chars).join('');
    },
    function* (password) {
      // Only shrink if above minimum length
      if (password.length <= effectiveMinLength) return;
      
      // Shrink to minimum length while keeping some character diversity
      yield password.slice(0, effectiveMinLength);
      
      // Progressive shrinking towards minimum
      for (let len = password.length - 1; len > effectiveMinLength; len--) {
        yield password.slice(0, len);
      }
      
      // Try a simple password at minimum length
      const simple = 'aA1!' + 'x'.repeat(Math.max(0, effectiveMinLength - 4));
      if (password !== simple && simple.length >= minLength) {
        yield simple;
      }
    }
  );
}

// ============================================================================
// LOGIN INPUT GENERATOR
// ============================================================================

/**
 * Login input type matching the login.isl specification
 */
export interface LoginInput {
  email: string;
  password: string;
  ip_address?: string;
}

/**
 * Create a generator for Login inputs that satisfies all preconditions:
 *   pre { email.is_valid_format }
 *   pre { password.length >= 8 }
 *   pre { password.length <= 128 }
 * 
 * All generated inputs are guaranteed to pass precondition checks.
 * 
 * @example
 * ```typescript
 * const gen = createLoginInputGenerator();
 * const prng = createPRNG(12345);
 * 
 * // Generate valid login inputs
 * for (let i = 0; i < 100; i++) {
 *   const input = gen.generate(prng.fork(), i);
 *   console.log(input);
 *   // { email: "abc@example.com", password: "xK3!mNpQ", ip_address: "192.168.1.1" }
 * }
 * ```
 */
export function createLoginInputGenerator(options: {
  preconditions?: Partial<LoginPreconditions>;
  includeIpAddress?: boolean;
} = {}): Generator<LoginInput> {
  const { 
    preconditions = DEFAULT_LOGIN_PRECONDITIONS,
    includeIpAddress = true,
  } = options;

  const emailGen = validEmail();
  const passwordGen = validPassword({
    minLength: preconditions.password?.minLength ?? 8,
    maxLength: preconditions.password?.maxLength ?? 128,
  });
  const ipGen = ipAddress();

  return new BaseGenerator(
    (prng, size) => {
      const input: LoginInput = {
        email: emailGen.generate(prng.fork(), size),
        password: passwordGen.generate(prng.fork(), size),
      };

      if (includeIpAddress) {
        input.ip_address = ipGen.generate(prng.fork(), size);
      }

      return input;
    },
    function* (input) {
      // Shrink email
      for (const shrunkEmail of emailGen.shrink(input.email)) {
        yield { ...input, email: shrunkEmail };
      }

      // Shrink password (while respecting min length)
      for (const shrunkPassword of passwordGen.shrink(input.password)) {
        yield { ...input, password: shrunkPassword };
      }

      // Shrink IP (optional field can be removed)
      if (input.ip_address && !options.preconditions?.ipAddress?.required) {
        yield { email: input.email, password: input.password };
      }
    }
  );
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that an input satisfies login preconditions
 */
export function validateLoginPreconditions(
  input: LoginInput,
  preconditions: LoginPreconditions = DEFAULT_LOGIN_PRECONDITIONS
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check email format
  if (preconditions.email.isValidFormat) {
    if (!isValidEmailFormat(input.email)) {
      violations.push('email.is_valid_format: Invalid email format');
    }
  }

  // Check password length >= min
  if (input.password.length < preconditions.password.minLength) {
    violations.push(
      `password.length >= ${preconditions.password.minLength}: ` +
      `Got ${input.password.length}`
    );
  }

  // Check password length <= max
  if (input.password.length > preconditions.password.maxLength) {
    violations.push(
      `password.length <= ${preconditions.password.maxLength}: ` +
      `Got ${input.password.length}`
    );
  }

  // Check IP address if required
  if (preconditions.ipAddress?.required && !input.ip_address) {
    violations.push('ip_address != null: IP address is required');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Check if email has valid format (RFC 5321 simplified)
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // Basic format check: local@domain
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex === email.length - 1) return false;
  
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  
  // Local part checks
  if (local.length === 0 || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;
  
  // Domain checks
  if (domain.length === 0 || domain.length > 255) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  
  // Character validation
  const localRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  const domainRegex = /^[a-zA-Z0-9.-]+$/;
  
  return localRegex.test(local) && domainRegex.test(domain);
}

// ============================================================================
// INVALID INPUT GENERATORS (for negative testing)
// ============================================================================

/**
 * Generator for invalid emails (violates email.is_valid_format)
 * Useful for testing error handling paths.
 */
export function invalidEmail(): Generator<string> {
  const invalidPatterns = [
    '',                          // Empty
    '@',                         // Just @
    'no-at-sign',                // Missing @
    '@domain.com',               // Missing local
    'user@',                     // Missing domain
    'user@domain',               // Missing TLD
    'user@@domain.com',          // Double @
    'user@domain..com',          // Double dot in domain
    '.user@domain.com',          // Leading dot in local
    'user.@domain.com',          // Trailing dot in local
    'user..name@domain.com',     // Double dot in local
    'user@-domain.com',          // Leading hyphen in domain
    'user@domain-.com',          // Trailing hyphen in domain segment
    'user name@domain.com',      // Space in local
    'user@domain .com',          // Space in domain
  ];

  return new BaseGenerator(
    (prng) => prng.pick(invalidPatterns),
    function* (value) {
      // Shrink towards simpler invalid emails
      if (value !== '') yield '';
      if (value !== '@') yield '@';
      if (value !== 'x') yield 'x';
    }
  );
}

/**
 * Generator for invalid passwords (violates length constraints)
 * Useful for testing error handling paths.
 */
export function invalidPassword(constraints: {
  minLength: number;
  maxLength: number;
}): Generator<string> {
  const { minLength, maxLength } = constraints;

  return new BaseGenerator(
    (prng, size) => {
      // Decide whether to generate too short or too long
      const tooShort = prng.bool(0.5);
      
      if (tooShort) {
        // Generate password shorter than minLength
        const len = prng.int(0, Math.max(0, minLength - 1));
        let result = '';
        for (let i = 0; i < len; i++) {
          result += PASSWORD_ALL[Math.floor(prng.random() * PASSWORD_ALL.length)];
        }
        return result;
      } else {
        // Generate password longer than maxLength
        const len = prng.int(maxLength + 1, maxLength + 50);
        let result = '';
        for (let i = 0; i < len; i++) {
          result += PASSWORD_ALL[Math.floor(prng.random() * PASSWORD_ALL.length)];
        }
        return result;
      }
    },
    function* (password) {
      // Shrink to simplest invalid cases
      if (password.length < minLength) {
        // Too short - shrink towards empty
        yield '';
        if (password.length > 0) {
          yield password[0]!;
        }
      } else {
        // Too long - shrink towards barely-over
        yield password.slice(0, maxLength + 1);
      }
    }
  );
}

/**
 * Generator for invalid login inputs (for negative testing)
 * Generates inputs that violate at least one precondition.
 */
export function invalidLoginInput(constraints: {
  minPasswordLength: number;
  maxPasswordLength: number;
} = { minPasswordLength: 8, maxPasswordLength: 128 }): Generator<LoginInput> {
  const badEmailGen = invalidEmail();
  const badPasswordGen = invalidPassword({
    minLength: constraints.minPasswordLength,
    maxLength: constraints.maxPasswordLength,
  });
  const goodEmailGen = validEmail();
  const goodPasswordGen = validPassword({
    minLength: constraints.minPasswordLength,
    maxLength: constraints.maxPasswordLength,
  });
  const ipGen = ipAddress();

  return new BaseGenerator(
    (prng, size) => {
      // Randomly choose which precondition to violate
      const violationType = prng.pick(['email', 'password', 'both'] as const);
      
      const input: LoginInput = {
        email: violationType === 'password' 
          ? goodEmailGen.generate(prng.fork(), size)
          : badEmailGen.generate(prng.fork(), size),
        password: violationType === 'email'
          ? goodPasswordGen.generate(prng.fork(), size)
          : badPasswordGen.generate(prng.fork(), size),
        ip_address: ipGen.generate(prng.fork(), size),
      };

      return input;
    },
    function* (input) {
      // Shrink to simpler invalid inputs
      const validation = validateLoginPreconditions(input);
      
      // Keep shrinking while still invalid
      if (validation.violations.some(v => v.includes('email'))) {
        for (const shrunkEmail of badEmailGen.shrink(input.email)) {
          yield { ...input, email: shrunkEmail };
        }
      }
      
      if (validation.violations.some(v => v.includes('password'))) {
        for (const shrunkPassword of badPasswordGen.shrink(input.password)) {
          yield { ...input, password: shrunkPassword };
        }
      }
    }
  );
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================
// All functions are exported inline with their definitions.
// See index.ts for the public API exports.
