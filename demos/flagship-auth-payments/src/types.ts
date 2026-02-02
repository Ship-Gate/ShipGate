/**
 * Type definitions for the flagship demo
 * These correspond to the ISL spec definitions
 */

// ============================================
// Auth Types (from auth.isl)
// ============================================

export type UserId = string;
export type SessionId = string;

export enum OAuthProvider {
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  MICROSOFT = 'MICROSOFT',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface User {
  id: UserId;
  email: string;
  display_name?: string;
  avatar_url?: string;
  oauth_provider: OAuthProvider;
  oauth_id: string;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface Session {
  id: SessionId;
  user_id: UserId;
  status: SessionStatus;
  ip_address: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
}

// ============================================
// Payment Types (from payments.isl)
// ============================================

export type PaymentId = string;
export type CustomerId = string;
export type SubscriptionId = string;

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum PaymentMethod {
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WALLET = 'WALLET',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  PAUSED = 'PAUSED',
  TRIALING = 'TRIALING',
}

export enum RefundReason {
  REQUESTED_BY_CUSTOMER = 'REQUESTED_BY_CUSTOMER',
  DUPLICATE = 'DUPLICATE',
  FRAUDULENT = 'FRAUDULENT',
  OTHER = 'OTHER',
}

export interface Customer {
  id: CustomerId;
  email: string;
  name?: string;
  default_payment_method_id?: string;
  created_at: Date;
  metadata?: Record<string, string>;
}

export interface Payment {
  id: PaymentId;
  customer_id: CustomerId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method_id: string;
  description?: string;
  metadata?: Record<string, string>;
  refunded_amount: number;
  failure_code?: string;
  failure_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Refund {
  id: string;
  payment_id: PaymentId;
  amount: number;
  reason: RefundReason;
  status: PaymentStatus;
  created_at: Date;
}

export interface Subscription {
  id: SubscriptionId;
  customer_id: CustomerId;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  trial_end?: Date;
  created_at: Date;
  canceled_at?: Date;
}

// ============================================
// Upload Types (from uploads.isl)
// ============================================

export type FileId = string;

export enum FileStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADING = 'UPLOADING',
  SCANNING = 'SCANNING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  QUARANTINED = 'QUARANTINED',
  DELETED = 'DELETED',
}

export enum FileCategory {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  ARCHIVE = 'ARCHIVE',
  OTHER = 'OTHER',
}

export enum ScanResult {
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  SUSPICIOUS = 'SUSPICIOUS',
  SCAN_FAILED = 'SCAN_FAILED',
}

export interface FileRecord {
  id: FileId;
  user_id: UserId;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  category: FileCategory;
  status: FileStatus;
  storage_path: string;
  public_url?: string;
  checksum_sha256: string;
  scan_result?: ScanResult;
  metadata?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

export interface UploadSession {
  id: string;
  file_id: FileId;
  user_id: UserId;
  presigned_url: string;
  expires_at: Date;
  created_at: Date;
  completed: boolean;
}

// ============================================
// API Response Types
// ============================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    retriable?: boolean;
    retry_after?: number;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
