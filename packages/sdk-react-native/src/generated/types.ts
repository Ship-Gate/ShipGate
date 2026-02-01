/**
 * Generated Types - ISL type definitions for React Native
 * 
 * This file would be auto-generated from ISL schemas by the codegen tool.
 * Below are example types that match common ISL patterns.
 */

// Base types
export type UUID = string;
export type Email = string;
export type URL = string;
export type ISODateTime = string;
export type Currency = number;

// User entity
export interface User {
  id: UUID;
  email: Email;
  username: string;
  displayName: string | null;
  avatarUrl: URL | null;
  status: UserStatus;
  role: UserRole;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastLoginAt: ISODateTime | null;
}

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface Session {
  id: UUID;
  userId: UUID;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

// Input types
export interface CreateUserInput {
  email: Email;
  username: string;
  password: string;
  displayName?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: URL | null;
}

export interface LoginInput {
  email: Email;
  password: string;
  deviceId?: string;
}

export interface RegisterInput {
  email: Email;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Error types (matching ISL error specifications)
export type CreateUserError =
  | { code: 'DUPLICATE_EMAIL'; message: string }
  | { code: 'DUPLICATE_USERNAME'; message: string }
  | { code: 'INVALID_INPUT'; message: string; errors: FieldError[] }
  | { code: 'RATE_LIMITED'; message: string; retryAfter: number };

export type LoginError =
  | { code: 'INVALID_CREDENTIALS'; message: string }
  | { code: 'ACCOUNT_LOCKED'; message: string; lockedUntil: ISODateTime }
  | { code: 'ACCOUNT_SUSPENDED'; message: string }
  | { code: 'MFA_REQUIRED'; message: string; mfaToken: string };

export type UpdateUserError =
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'UNAUTHORIZED'; message: string }
  | { code: 'INVALID_INPUT'; message: string; errors: FieldError[] };

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

// Filter types
export interface UserFilters {
  status?: UserStatus;
  role?: UserRole;
  search?: string;
  createdAfter?: ISODateTime;
  createdBefore?: ISODateTime;
}

// Event types (for real-time subscriptions)
export type UserEvent =
  | { type: 'USER_CREATED'; user: User }
  | { type: 'USER_UPDATED'; user: User; changes: Partial<User> }
  | { type: 'USER_DELETED'; userId: UUID }
  | { type: 'USER_STATUS_CHANGED'; userId: UUID; oldStatus: UserStatus; newStatus: UserStatus };

// Notification types
export interface Notification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: ISODateTime;
}

export type NotificationType =
  | 'SYSTEM'
  | 'USER_MENTION'
  | 'COMMENT'
  | 'LIKE'
  | 'FOLLOW'
  | 'MESSAGE';

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: ISODateTime;
  };
}

// File upload types
export interface UploadedFile {
  id: UUID;
  url: URL;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: ISODateTime;
}

export interface FileUploadInput {
  file: {
    uri: string;
    name: string;
    type: string;
  };
  folder?: string;
}

// Settings types
export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
    showOnlineStatus: boolean;
  };
  preferences: {
    theme: 'LIGHT' | 'DARK' | 'SYSTEM';
    language: string;
    timezone: string;
  };
}
