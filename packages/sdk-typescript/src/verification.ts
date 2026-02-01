/**
 * ISL Verification - Runtime contract verification.
 */

import type { VerificationConfig } from './config';
import { PreconditionError, PostconditionError } from './errors';
import type { User, CreateUserInput, UpdateUserInput, ListUsersInput, SearchUsersInput } from './models';
import { UserStatus } from './models';

/**
 * Violation type
 */
export type ViolationType = 'PRECONDITION' | 'POSTCONDITION';

/**
 * Violation record
 */
export interface Violation {
  readonly type: ViolationType;
  readonly message: string;
  readonly contract: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly timestamp: Date;
}

/**
 * Runtime checker for ISL contracts
 */
export class RuntimeChecker {
  private readonly config: Required<VerificationConfig>;
  private readonly violations: Violation[] = [];

  constructor(config?: VerificationConfig) {
    this.config = {
      enablePreconditions: config?.enablePreconditions ?? true,
      enablePostconditions: config?.enablePostconditions ?? true,
      throwOnViolation: config?.throwOnViolation ?? true,
      logViolations: config?.logViolations ?? true,
    };
  }

  // ===========================================================================
  // Precondition Verification
  // ===========================================================================

  verifyCreateUserPreconditions(input: CreateUserInput): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      input.email.includes('@'),
      'Email must contain @',
      "email.includes('@')",
      input.email
    );

    this.checkPrecondition(
      input.email.length <= 254,
      'Email must be at most 254 characters',
      'email.length <= 254',
      input.email.length
    );

    this.checkPrecondition(
      input.username.length >= 3,
      'Username must be at least 3 characters',
      'username.length >= 3',
      input.username.length
    );

    this.checkPrecondition(
      input.username.length <= 30,
      'Username must be at most 30 characters',
      'username.length <= 30',
      input.username.length
    );
  }

  verifyGetUserPreconditions(userId: string): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      Boolean(userId && userId.trim()),
      'User ID cannot be blank',
      'userId.isNotBlank()',
      userId
    );
  }

  verifyUpdateUserPreconditions(userId: string, input: UpdateUserInput): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      Boolean(userId && userId.trim()),
      'User ID cannot be blank',
      'userId.isNotBlank()',
      userId
    );

    if (input.username !== undefined) {
      this.checkPrecondition(
        input.username.length >= 3 && input.username.length <= 30,
        'Username must be 3-30 characters',
        'username.length in 3..30',
        input.username.length
      );
    }
  }

  verifyDeleteUserPreconditions(userId: string): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      Boolean(userId && userId.trim()),
      'User ID cannot be blank',
      'userId.isNotBlank()',
      userId
    );
  }

  verifyListUsersPreconditions(input: ListUsersInput): void {
    if (!this.config.enablePreconditions) return;

    if (input.pageSize !== undefined) {
      this.checkPrecondition(
        input.pageSize >= 1 && input.pageSize <= 100,
        'Page size must be between 1 and 100',
        'pageSize in 1..100',
        input.pageSize
      );
    }
  }

  verifySearchUsersPreconditions(input: SearchUsersInput): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      input.query.length >= 2,
      'Search query must be at least 2 characters',
      'query.length >= 2',
      input.query.length
    );
  }

  // ===========================================================================
  // Postcondition Verification
  // ===========================================================================

  verifyCreateUserPostconditions(input: CreateUserInput, result: User): void {
    if (!this.config.enablePostconditions) return;

    this.checkPostcondition(
      result.email === input.email,
      'Created user email must match input email',
      'result.email === input.email',
      input.email,
      result.email
    );

    this.checkPostcondition(
      result.username === input.username,
      'Created user username must match input username',
      'result.username === input.username',
      input.username,
      result.username
    );

    this.checkPostcondition(
      result.status === UserStatus.PENDING,
      'Created user status must be PENDING',
      'result.status === UserStatus.PENDING',
      UserStatus.PENDING,
      result.status
    );

    this.checkPostcondition(
      Boolean(result.id),
      'Created user must have an ID',
      'result.id.isNotBlank()',
      'non-blank ID',
      result.id
    );
  }

  verifyGetUserPostconditions(userId: string, result: User): void {
    if (!this.config.enablePostconditions) return;

    this.checkPostcondition(
      result.id === userId,
      'Retrieved user ID must match request ID',
      'result.id === userId',
      userId,
      result.id
    );
  }

  verifyUpdateUserPostconditions(
    userId: string,
    input: UpdateUserInput,
    result: User
  ): void {
    if (!this.config.enablePostconditions) return;

    this.checkPostcondition(
      result.id === userId,
      'Updated user ID must match request ID',
      'result.id === userId',
      userId,
      result.id
    );

    if (input.username !== undefined) {
      this.checkPostcondition(
        result.username === input.username,
        'Updated user username must match input',
        'result.username === input.username',
        input.username,
        result.username
      );
    }

    if (input.status !== undefined) {
      this.checkPostcondition(
        result.status === input.status,
        'Updated user status must match input',
        'result.status === input.status',
        input.status,
        result.status
      );
    }
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  private checkPrecondition(
    condition: boolean,
    message: string,
    precondition: string,
    actualValue?: unknown
  ): void {
    if (!condition) {
      const violation: Violation = {
        type: 'PRECONDITION',
        message,
        contract: precondition,
        actual: actualValue,
        timestamp: new Date(),
      };

      this.handleViolation(violation);
    }
  }

  private checkPostcondition(
    condition: boolean,
    message: string,
    postcondition: string,
    expected?: unknown,
    actual?: unknown
  ): void {
    if (!condition) {
      const violation: Violation = {
        type: 'POSTCONDITION',
        message,
        contract: postcondition,
        expected,
        actual,
        timestamp: new Date(),
      };

      this.handleViolation(violation);
    }
  }

  private handleViolation(violation: Violation): void {
    this.violations.push(violation);

    if (this.config.logViolations) {
      console.warn(`[${violation.type} VIOLATION] ${violation.message}`, {
        contract: violation.contract,
        expected: violation.expected,
        actual: violation.actual,
      });
    }

    if (this.config.throwOnViolation) {
      if (violation.type === 'PRECONDITION') {
        throw new PreconditionError(
          violation.message,
          violation.contract,
          violation.actual
        );
      } else {
        throw new PostconditionError(
          violation.message,
          violation.contract,
          violation.expected,
          violation.actual
        );
      }
    }
  }

  getViolations(): readonly Violation[] {
    return [...this.violations];
  }

  clearViolations(): void {
    this.violations.length = 0;
  }

  hasViolations(): boolean {
    return this.violations.length > 0;
  }
}
