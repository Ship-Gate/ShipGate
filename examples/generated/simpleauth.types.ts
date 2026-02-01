/**
 * Generated from ISL domain: SimpleAuth
 * DO NOT EDIT - This file is auto-generated
 */

/** Enum: UserStatus */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
}

/** Entity: User */
export interface User {
  /** immutable, unique */
  readonly id: string;
  /** unique */
  email: string;
  status: UserStatus;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  exists(id: string): Promise<boolean>;
  create(data: Omit<User, 'id'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

/** Behavior: Login */
export interface LoginInput {
  email: string;
  /** sensitive */
  password: string;
}

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS';

export interface LoginError {
  code: LoginErrorCode;
  message: string;
  retriable?: boolean;
  retryAfter?: number;
}

export type LoginResult =
  | { success: true; data: User }
  | { success: false; error: LoginError };

export interface LoginBehavior {
  execute(input: LoginInput): Promise<LoginResult>;
}

export type LoginFunction = (input: LoginInput) => Promise<LoginResult>;
