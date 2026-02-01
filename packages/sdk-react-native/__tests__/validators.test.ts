/**
 * Validator tests
 */
import { describe, it, expect } from 'vitest';
import {
  createValidator,
  combineValidators,
  Schemas,
  Validators,
  validateObject,
} from '../src/validation/validators';
import {
  CreateUserInputSchema,
  LoginInputSchema,
  validateCreateUserInput,
} from '../src/generated/schemas';

describe('createValidator', () => {
  it('should validate valid input', () => {
    const validator = createValidator(CreateUserInputSchema);
    const result = validator({
      email: 'test@example.com',
      username: 'testuser',
      password: 'Password123',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return errors for invalid input', () => {
    const validator = createValidator(CreateUserInputSchema);
    const result = validator({
      email: 'invalid-email',
      username: 'ab', // too short
      password: '123', // too short, no letters
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should validate email format', () => {
    const validator = createValidator(Schemas.Email);

    expect(validator('test@example.com').valid).toBe(true);
    expect(validator('invalid').valid).toBe(false);
    expect(validator('').valid).toBe(false);
  });

  it('should validate username format', () => {
    const validator = createValidator(Schemas.Username);

    expect(validator('valid_user123').valid).toBe(true);
    expect(validator('ab').valid).toBe(false); // too short
    expect(validator('invalid-user').valid).toBe(false); // contains hyphen
    expect(validator('a'.repeat(31)).valid).toBe(false); // too long
  });
});

describe('combineValidators', () => {
  it('should combine multiple validators', () => {
    const emailValidator = createValidator(Schemas.Email);
    const usernameValidator = createValidator(Schemas.Username);

    const combined = combineValidators(
      (input: { email: string }) => emailValidator(input.email),
      (input: { username: string }) => usernameValidator(input.username)
    );

    const validResult = combined({
      email: 'test@example.com',
      username: 'validuser',
    });
    expect(validResult.valid).toBe(true);

    const invalidResult = combined({
      email: 'invalid',
      username: 'ab',
    });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Validators', () => {
  describe('required', () => {
    it('should validate non-empty values', () => {
      expect(Validators.required('value').valid).toBe(true);
      expect(Validators.required(123).valid).toBe(true);
      expect(Validators.required({}).valid).toBe(true);
    });

    it('should reject empty values', () => {
      expect(Validators.required('').valid).toBe(false);
      expect(Validators.required(null).valid).toBe(false);
      expect(Validators.required(undefined).valid).toBe(false);
    });
  });

  describe('length', () => {
    it('should validate string length', () => {
      const validator = Validators.length(3, 10);

      expect(validator('abc').valid).toBe(true);
      expect(validator('abcdefghij').valid).toBe(true);
      expect(validator('ab').valid).toBe(false);
      expect(validator('abcdefghijk').valid).toBe(false);
    });
  });

  describe('pattern', () => {
    it('should validate against regex', () => {
      const alphaNumeric = Validators.pattern(/^[a-z0-9]+$/, 'Must be alphanumeric');

      expect(alphaNumeric('abc123').valid).toBe(true);
      expect(alphaNumeric('ABC').valid).toBe(false);
      expect(alphaNumeric('abc-123').valid).toBe(false);
    });
  });

  describe('range', () => {
    it('should validate number range', () => {
      const validator = Validators.range(1, 100);

      expect(validator(1).valid).toBe(true);
      expect(validator(50).valid).toBe(true);
      expect(validator(100).valid).toBe(true);
      expect(validator(0).valid).toBe(false);
      expect(validator(101).valid).toBe(false);
    });
  });

  describe('oneOf', () => {
    it('should validate value is in allowed list', () => {
      const validator = Validators.oneOf(['ACTIVE', 'PENDING', 'SUSPENDED']);

      expect(validator('ACTIVE').valid).toBe(true);
      expect(validator('DELETED').valid).toBe(false);
    });
  });

  describe('custom', () => {
    it('should use custom validation function', () => {
      const isEven = Validators.custom<number>(
        (n) => n % 2 === 0,
        'Must be even'
      );

      expect(isEven(2).valid).toBe(true);
      expect(isEven(4).valid).toBe(true);
      expect(isEven(3).valid).toBe(false);
    });
  });
});

describe('validateObject', () => {
  it('should validate object fields', () => {
    const result = validateObject(
      { name: 'ab', age: 150 },
      {
        name: Validators.length(3, 50),
        age: Validators.range(0, 120),
      }
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors?.find(e => e.field === 'name')).toBeDefined();
    expect(result.errors?.find(e => e.field === 'age')).toBeDefined();
  });

  it('should pass valid objects', () => {
    const result = validateObject(
      { name: 'John', age: 30 },
      {
        name: Validators.length(3, 50),
        age: Validators.range(0, 120),
      }
    );

    expect(result.valid).toBe(true);
  });
});

describe('Generated validators', () => {
  it('should validate CreateUserInput', () => {
    const valid = validateCreateUserInput({
      email: 'test@example.com',
      username: 'testuser',
      password: 'Password123',
    });
    expect(valid.valid).toBe(true);

    const invalid = validateCreateUserInput({
      email: 'not-an-email',
      username: 'ab',
      password: '123',
    });
    expect(invalid.valid).toBe(false);
  });
});
