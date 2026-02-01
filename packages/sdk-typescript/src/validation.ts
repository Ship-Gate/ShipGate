/**
 * ISL Validation - Input validation utilities.
 */

import { ValidationError } from './errors';
import type { CreateUserInput, UpdateUserInput, ListUsersInput, SearchUsersInput } from './models';

/**
 * Validation result
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[]; field?: string };

/**
 * Create a valid result
 */
export function valid(): ValidationResult {
  return { valid: true };
}

/**
 * Create an invalid result
 */
export function invalid(errors: string[], field?: string): ValidationResult {
  return { valid: false, errors, field };
}

/**
 * Combine multiple validation results
 */
export function combine(...results: ValidationResult[]): ValidationResult {
  const allErrors: string[] = [];
  let firstField: string | undefined;

  for (const result of results) {
    if (!result.valid) {
      allErrors.push(...result.errors);
      if (!firstField && result.field) {
        firstField = result.field;
      }
    }
  }

  return allErrors.length === 0 ? valid() : invalid(allErrors, firstField);
}

/**
 * Validators for ISL types
 */
export const validators = {
  /**
   * Validate email format
   */
  email(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email) {
      errors.push('Email cannot be empty');
    } else {
      if (!email.includes('@')) {
        errors.push('Email must contain @');
      }
      if (email.length > 254) {
        errors.push('Email must be at most 254 characters');
      }
      if (email.length < 3) {
        errors.push('Email must be at least 3 characters');
      }
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        errors.push('Invalid email format');
      }
    }

    return errors.length === 0 ? valid() : invalid(errors, 'email');
  },

  /**
   * Validate username format
   */
  username(username: string): ValidationResult {
    const errors: string[] = [];
    const reserved = ['admin', 'root', 'system', 'null', 'undefined', 'api', 'www'];

    if (!username) {
      errors.push('Username cannot be empty');
    } else {
      if (username.length < 3) {
        errors.push('Username must be at least 3 characters');
      }
      if (username.length > 30) {
        errors.push('Username must be at most 30 characters');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        errors.push('Username can only contain letters, numbers, underscores, and hyphens');
      }
      if (reserved.includes(username.toLowerCase())) {
        errors.push(`Username '${username}' is reserved`);
      }
    }

    return errors.length === 0 ? valid() : invalid(errors, 'username');
  },

  /**
   * Validate user ID
   */
  userId(userId: string): ValidationResult {
    if (!userId || !userId.trim()) {
      return invalid(['User ID cannot be blank'], 'userId');
    }
    return valid();
  },

  /**
   * Validate page size
   */
  pageSize(size: number): ValidationResult {
    if (size < 1) {
      return invalid(['Page size must be at least 1'], 'pageSize');
    }
    if (size > 100) {
      return invalid(['Page size must be at most 100'], 'pageSize');
    }
    return valid();
  },

  /**
   * Validate CreateUserInput
   */
  createUserInput(input: CreateUserInput): ValidationResult {
    return combine(validators.email(input.email), validators.username(input.username));
  },

  /**
   * Validate UpdateUserInput
   */
  updateUserInput(input: UpdateUserInput): ValidationResult {
    const results: ValidationResult[] = [];

    if (input.username !== undefined) {
      results.push(validators.username(input.username));
    }

    return results.length === 0 ? valid() : combine(...results);
  },

  /**
   * Validate ListUsersInput
   */
  listUsersInput(input: ListUsersInput): ValidationResult {
    const errors: string[] = [];
    const validSortFields = ['createdAt', 'updatedAt', 'email', 'username', 'status'];

    if (input.pageSize !== undefined) {
      const pageSizeResult = validators.pageSize(input.pageSize);
      if (!pageSizeResult.valid) {
        errors.push(...pageSizeResult.errors);
      }
    }

    if (input.sortBy !== undefined && !validSortFields.includes(input.sortBy)) {
      errors.push(`sort_by must be one of: ${validSortFields.join(', ')}`);
    }

    return errors.length === 0 ? valid() : invalid(errors);
  },

  /**
   * Validate SearchUsersInput
   */
  searchUsersInput(input: SearchUsersInput): ValidationResult {
    const errors: string[] = [];
    const validFields = ['email', 'username'];

    if (!input.query || input.query.length < 2) {
      errors.push('Search query must be at least 2 characters');
    }
    if (input.query && input.query.length > 100) {
      errors.push('Search query must be at most 100 characters');
    }

    if (input.fields) {
      const invalidFields = input.fields.filter((f) => !validFields.includes(f));
      if (invalidFields.length > 0) {
        errors.push(`Invalid search fields: ${invalidFields.join(', ')}`);
      }
    }

    if (input.pageSize !== undefined) {
      const pageSizeResult = validators.pageSize(input.pageSize);
      if (!pageSizeResult.valid) {
        errors.push(...pageSizeResult.errors);
      }
    }

    return errors.length === 0 ? valid() : invalid(errors, 'query');
  },
};

/**
 * Validate and throw if invalid
 */
export function validate<T>(
  value: T,
  validator: (value: T) => ValidationResult
): T {
  const result = validator(value);
  if (!result.valid) {
    throw new ValidationError(
      result.errors.join('; '),
      result.field,
      value
    );
  }
  return value;
}

/**
 * Validate or return result
 */
export function validateResult<T>(
  value: T,
  validator: (value: T) => ValidationResult
): ValidationResult {
  return validator(value);
}
