/**
 * ISL Models - Type definitions generated from ISL specifications.
 */

// =============================================================================
// Value Types
// =============================================================================

/**
 * Email value type - validated string
 */
export type Email = string & { readonly __brand: 'Email' };

/**
 * Username value type - validated string (3-30 chars)
 */
export type Username = string & { readonly __brand: 'Username' };

/**
 * User ID value type
 */
export type UserId = string & { readonly __brand: 'UserId' };

/**
 * Pagination token
 */
export type PageToken = string & { readonly __brand: 'PageToken' };

// =============================================================================
// Enums
// =============================================================================

/**
 * User status enumeration
 */
export const UserStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/**
 * User role enumeration
 */
export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Sort order
 */
export const SortOrder = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/**
 * Change type for events
 */
export const ChangeType = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
} as const;

export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

// =============================================================================
// Entity Models
// =============================================================================

/**
 * User entity
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly status: UserStatus;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata?: Record<string, string>;
}

/**
 * User profile with extended information
 */
export interface UserProfile {
  readonly user: User;
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly location?: string;
  readonly website?: string;
}

/**
 * Paginated list response
 */
export interface PaginatedList<T> {
  readonly items: readonly T[];
  readonly nextPageToken?: string;
  readonly totalCount?: number;
}

/**
 * Audit entry
 */
export interface AuditEntry {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly actorId?: string;
  readonly timestamp: Date;
  readonly changes?: Record<string, { from?: string; to?: string }>;
}

// =============================================================================
// Input DTOs
// =============================================================================

/**
 * Input for creating a user
 */
export interface CreateUserInput {
  readonly email: string;
  readonly username: string;
  readonly role?: UserRole;
  readonly metadata?: Record<string, string>;
}

/**
 * Input for updating a user
 */
export interface UpdateUserInput {
  readonly username?: string;
  readonly status?: UserStatus;
  readonly role?: UserRole;
  readonly metadata?: Record<string, string>;
}

/**
 * Input for updating user profile
 */
export interface UpdateProfileInput {
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly location?: string;
  readonly website?: string;
}

/**
 * Input for listing users
 */
export interface ListUsersInput {
  readonly status?: UserStatus;
  readonly role?: UserRole;
  readonly pageSize?: number;
  readonly pageToken?: string;
  readonly sortBy?: string;
  readonly sortOrder?: SortOrder;
}

/**
 * Input for searching users
 */
export interface SearchUsersInput {
  readonly query: string;
  readonly fields?: readonly string[];
  readonly pageSize?: number;
  readonly pageToken?: string;
}

// =============================================================================
// WebSocket Messages
// =============================================================================

/**
 * User update event
 */
export interface UserUpdateEvent {
  readonly userId: string;
  readonly user: User;
  readonly changeType: ChangeType;
}

/**
 * WebSocket message wrapper
 */
export interface WebSocketMessage<T> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: Date;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if user is active
 */
export function isActive(user: User): boolean {
  return user.status === UserStatus.ACTIVE;
}

/**
 * Check if user is pending
 */
export function isPending(user: User): boolean {
  return user.status === UserStatus.PENDING;
}

/**
 * Check if user is suspended
 */
export function isSuspended(user: User): boolean {
  return user.status === UserStatus.SUSPENDED;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN;
}

/**
 * Parse user from API response
 */
export function parseUser(data: unknown): User {
  const obj = data as Record<string, unknown>;
  return {
    id: String(obj.id),
    email: String(obj.email),
    username: String(obj.username),
    status: obj.status as UserStatus,
    role: (obj.role as UserRole) ?? UserRole.USER,
    createdAt: new Date(obj.createdAt as string | number),
    updatedAt: new Date(obj.updatedAt as string | number),
    metadata: obj.metadata as Record<string, string> | undefined,
  };
}
