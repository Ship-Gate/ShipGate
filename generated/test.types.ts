/**
 * Generated from ISL domain: Test
 * DO NOT EDIT - This file is auto-generated
 */

/** Entity: User */
export interface User {
  /** immutable */
  readonly id: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  exists(id: string): Promise<boolean>;
  create(data: Omit<User, 'id'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

/** Behavior: CreateUser */
export type CreateUserErrorCode =
  | 'INVALID_EMAIL';

export interface CreateUserError {
  code: CreateUserErrorCode;
  message: string;
  retriable?: boolean;
  retryAfter?: number;
}

export type CreateUserResult =
  | { success: true; data: User }
  | { success: false; error: CreateUserError };

export interface CreateUserBehavior {
  execute(input: void): Promise<CreateUserResult>;
}

export type CreateUserFunction = (input: void) => Promise<CreateUserResult>;
