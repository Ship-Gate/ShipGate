/**
 * Golden Snapshot: Auth Domain Generated Output
 *
 * This snapshot represents the expected deterministic output for the
 * auth domain ISL specification. Any changes to codegen that affect
 * this output should be reviewed carefully.
 *
 * To update: pnpm test:snapshot
 */

export const AUTH_DOMAIN_TYPES = `/**
 * @generated - DO NOT EDIT
 * Source: examples/auth.isl
 * Generator: @isl-lang/codegen-types@1.0.0
 * Hash: a1b2c3d4
 */

// ============================================================================
// Utility Types
// ============================================================================

/** UUID string type */
export type UUID = string;

/** ISO 8601 timestamp string */
export type Timestamp = string;

// ============================================================================
// Enums
// ============================================================================

/** Enum: UserStatus */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
}

export const UserStatusValues = ['ACTIVE', 'INACTIVE', 'LOCKED'] as const;

// ============================================================================
// Entities
// ============================================================================

/** Entity: User */
export interface User {
  readonly id: UUID;
  email: string;
  name: string;
  status: UserStatus;
  readonly createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/** Input for creating a new User */
export interface UserCreateInput {
  email: string;
  name: string;
  status: UserStatus;
}

/** Input for updating a User */
export type UserUpdateInput = Partial<Pick<User, 'email' | 'name' | 'status' | 'updatedAt'>>;

// ============================================================================
// Behavior: Login
// ============================================================================

/** Input for Login */
export interface LoginInput {
  email: string;
  /** sensitive */
  password: string;
}

/** Error codes for Login */
export type LoginErrorCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED';

/** Error type for Login */
export interface LoginError {
  code: LoginErrorCode;
  message: string;
  retriable: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

/** Success type for Login */
export type LoginSuccess = User;

/** Result type for Login */
export type LoginResult =
  | { success: true; data: LoginSuccess }
  | { success: false; error: LoginError };

/** Function type for Login behavior */
export type LoginFunction = (input: LoginInput) => Promise<LoginResult>;

/** Handler interface for Login behavior */
export interface LoginHandler {
  execute(input: LoginInput): Promise<LoginResult>;
}
`;

export const AUTH_DOMAIN_VALIDATION = `/**
 * @generated - DO NOT EDIT
 * Source: examples/auth.isl
 * Generator: @isl-lang/codegen-types@1.0.0
 * Hash: a1b2c3d4
 */

import { z } from 'zod';

import type * as Types from './types.js';

// ============================================================================
// Base Schemas
// ============================================================================

export const UUIDSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();

// ============================================================================
// Enum Schemas
// ============================================================================

export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']);

// ============================================================================
// Entity Schemas
// ============================================================================

export const UserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  name: z.string(),
  status: UserStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.optional(),
});

export const UserCreateInputSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  status: UserStatusSchema,
});

export const UserUpdateInputSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  status: UserStatusSchema.optional(),
  updatedAt: TimestampSchema.optional(),
});

// ============================================================================
// Behavior Schemas
// ============================================================================

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const LoginErrorCodeSchema = z.enum(['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED']);

export const LoginErrorSchema = z.object({
  code: LoginErrorCodeSchema,
  message: z.string(),
  retriable: z.boolean(),
  retryAfter: z.number().optional(),
  details: z.record(z.unknown()).optional(),
});

export const LoginResultSchema = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true), data: UserSchema }),
  z.object({ success: z.literal(false), error: LoginErrorSchema }),
]);

// ============================================================================
// Validators
// ============================================================================

export function validateLoginInput(input: unknown): Types.LoginInput {
  return LoginInputSchema.parse(input);
}

export function isValidLoginInput(input: unknown): input is Types.LoginInput {
  return LoginInputSchema.safeParse(input).success;
}

// ============================================================================
// Schema Registry
// ============================================================================

export const SchemaRegistry = {
  User: UserSchema,
  UserStatus: UserStatusSchema,
  LoginInput: LoginInputSchema,
  LoginError: LoginErrorSchema,
  LoginResult: LoginResultSchema,
} as const;

export function validate<K extends keyof typeof SchemaRegistry>(
  schemaName: K,
  data: unknown
): z.infer<(typeof SchemaRegistry)[K]> {
  return SchemaRegistry[schemaName].parse(data);
}
`;
