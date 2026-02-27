// ============================================================================
// Payment Types - TypeScript Definitions
// ============================================================================

// ==========================================================================
// CORE TYPES
// ==========================================================================

export type PaymentId = string & { readonly __brand: 'PaymentId' };
export type RefundId = string & { readonly __brand: 'RefundId' };
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };
export type PaymentMethodToken = string & { readonly __brand: 'PaymentMethodToken' };

export interface Money {
  amount: number;
  currency: Currency;
}

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | string;

// ==========================================================================
// PAYMENT STATUS LIFECYCLE
// ==========================================================================

export enum PaymentStatus {
  PENDING = 'PENDING',
  REQUIRES_ACTION = 'REQUIRES_ACTION',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  DISPUTED = 'DISPUTED',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

// ==========================================================================
// PAYMENT METHOD TYPES
// ==========================================================================

export enum CardBrand {
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  AMEX = 'AMEX',
  DISCOVER = 'DISCOVER',
  DINERS = 'DINERS',
  JCB = 'JCB',
  UNIONPAY = 'UNIONPAY',
  UNKNOWN = 'UNKNOWN',
}

export enum BankAccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
}

export enum WalletProvider {
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
  PAYPAL = 'PAYPAL',
  STRIPE_LINK = 'STRIPE_LINK',
}

export interface CardPaymentMethod {
  type: 'card';
  token: PaymentMethodToken;
  brand: CardBrand;
  lastFour: string;
  expMonth: number;
  expYear: number;
  fingerprint?: string;
}

export interface BankAccountPaymentMethod {
  type: 'bank_account';
  token: PaymentMethodToken;
  bankName: string;
  routingLastFour: string;
  accountLastFour: string;
  accountType: BankAccountType;
}

export interface WalletPaymentMethod {
  type: 'wallet';
  token: PaymentMethodToken;
  provider: WalletProvider;
  walletId: string;
}

export type PaymentMethod =
  | CardPaymentMethod
  | BankAccountPaymentMethod
  | WalletPaymentMethod;

// ==========================================================================
// PAYMENT ENTITY
// ==========================================================================

export interface Payment {
  id: PaymentId;
  idempotencyKey: IdempotencyKey;
  
  amount: number;
  currency: Currency;
  capturedAmount: number;
  refundedAmount: number;
  
  paymentMethod: PaymentMethod;
  
  status: PaymentStatus;
  failureCode?: PaymentErrorCode;
  failureMessage?: string;
  
  provider: WebhookProvider;
  providerPaymentId: string;
  
  customerId?: string;
  customerEmail?: string;
  
  description?: string;
  metadata?: Record<string, string>;
  
  pciMetadata: PCIMetadata;
  fraudSignals?: FraudSignals;
  
  createdAt: Date;
  updatedAt: Date;
  authorizedAt?: Date;
  capturedAt?: Date;
}

// ==========================================================================
// REFUND ENTITY
// ==========================================================================

export interface Refund {
  id: RefundId;
  paymentId: PaymentId;
  idempotencyKey: IdempotencyKey;
  
  amount: number;
  currency: Currency;
  reason?: string;
  
  status: RefundStatus;
  failureCode?: RefundErrorCode;
  failureMessage?: string;
  
  providerRefundId?: string;
  
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ==========================================================================
// WEBHOOK TYPES
// ==========================================================================

export enum WebhookProvider {
  STRIPE = 'STRIPE',
  BRAINTREE = 'BRAINTREE',
  ADYEN = 'ADYEN',
  SQUARE = 'SQUARE',
}

export enum WebhookEventType {
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_AUTHORIZED = 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  PAYMENT_DISPUTED = 'PAYMENT_DISPUTED',
  REFUND_CREATED = 'REFUND_CREATED',
  REFUND_SUCCEEDED = 'REFUND_SUCCEEDED',
  REFUND_FAILED = 'REFUND_FAILED',
}

export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  eventType: WebhookEventType;
  eventId: string;
  
  payload: string;
  signatureVerified: boolean;
  
  paymentId?: PaymentId;
  refundId?: RefundId;
  
  processed: boolean;
  processingError?: string;
  retryCount: number;
  
  receivedAt: Date;
  processedAt?: Date;
}

// ==========================================================================
// COMPLIANCE TYPES
// ==========================================================================

export interface PCIMetadata {
  tokenizationMethod: string;
  tokenizedAt: Date;
  providerReference: string;
  complianceLevel: 1 | 2 | 3 | 4;
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface FraudSignals {
  riskScore: number;
  riskLevel: RiskLevel;
  checksPerformed: string[];
  ipAddress?: string;
  deviceFingerprint?: string;
}

// ==========================================================================
// ERROR TYPES
// ==========================================================================

export enum PaymentErrorCode {
  CARD_DECLINED = 'CARD_DECLINED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_CARD = 'INVALID_CARD',
  EXPIRED_CARD = 'EXPIRED_CARD',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  FRAUD_DETECTED = 'FRAUD_DETECTED',
  RATE_LIMITED = 'RATE_LIMITED',
  DUPLICATE_REQUEST = 'DUPLICATE_REQUEST',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  CURRENCY_NOT_SUPPORTED = 'CURRENCY_NOT_SUPPORTED',
  PAYMENT_METHOD_NOT_SUPPORTED = 'PAYMENT_METHOD_NOT_SUPPORTED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',
}

export enum RefundErrorCode {
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_NOT_CAPTURED = 'PAYMENT_NOT_CAPTURED',
  AMOUNT_EXCEEDS_AVAILABLE = 'AMOUNT_EXCEEDS_AVAILABLE',
  REFUND_ALREADY_PENDING = 'REFUND_ALREADY_PENDING',
  REFUND_WINDOW_EXPIRED = 'REFUND_WINDOW_EXPIRED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
}

// ==========================================================================
// IDEMPOTENCY
// ==========================================================================

export interface IdempotencyRecord {
  key: IdempotencyKey;
  requestHash: string;
  response: string;
  paymentId?: PaymentId;
  createdAt: Date;
  expiresAt: Date;
}

// ==========================================================================
// RESULT TYPES
// ==========================================================================

export type Result<T, E> = 
  | { success: true; data: T }
  | { success: false; error: E };

export interface PaymentError {
  code: PaymentErrorCode;
  message: string;
  retriable: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

export interface RefundError {
  code: RefundErrorCode;
  message: string;
  retriable: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
}
