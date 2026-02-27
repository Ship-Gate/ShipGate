/**
 * Core payment types and interfaces
 * @packageDocumentation
 */

// ============================================================================
// PRIMITIVE TYPES
// ============================================================================

export type PaymentId = string;
export type InvoiceId = string;
export type SubscriptionId = string;
export type CustomerId = string;
export type PaymentMethodId = string;

export type Currency = string; // ISO 4217 currency code (3 letters)

// ============================================================================
// ENUMS
// ============================================================================

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
  REQUIRES_ACTION = 'REQUIRES_ACTION'
}

export enum PaymentMethodType {
  CARD = 'CARD',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  PAYPAL = 'PAYPAL',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
  CRYPTO = 'CRYPTO'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
  TRIALING = 'TRIALING',
  EXPIRED = 'EXPIRED'
}

export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum CheckoutStatus {
  OPEN = 'OPEN',
  EXPIRED = 'EXPIRED',
  COMPLETE = 'COMPLETE',
  PROCESSING = 'PROCESSING'
}

export enum GatewayProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  MOCK = 'mock'
}

// ============================================================================
// MONEY TYPES
// ============================================================================

export interface Money {
  amount: bigint; // Amount in smallest currency unit (cents)
  currency: Currency;
}

export interface MoneyOptions {
  rounding?: 'half_even' | 'half_up' | 'down';
  precision?: number;
}

// ============================================================================
// PAYMENT METHOD TYPES
// ============================================================================

export interface PaymentMethodInfo {
  id: PaymentMethodId;
  type: PaymentMethodType;
  isDefault?: boolean;
  card?: CardInfo;
  bankAccount?: BankAccountInfo;
  paypal?: PaypalInfo;
  digitalWallet?: DigitalWalletInfo;
  metadata?: Record<string, string>;
}

export interface CardInfo {
  token: string; // Tokenized card data from gateway
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  fingerprint?: string;
  country?: string;
}

export interface BankAccountInfo {
  token: string;
  last4?: string;
  bankName?: string;
  accountType?: 'checking' | 'savings';
  country?: string;
}

export interface PaypalInfo {
  token: string;
  email?: string;
  payerId?: string;
}

export interface DigitalWalletInfo {
  token: string;
  type: 'apple_pay' | 'google_pay';
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface Payment {
  id: PaymentId;
  customerId?: CustomerId;
  amount: bigint;
  currency: Currency;
  status: PaymentStatus;
  paymentMethodId: PaymentMethodId;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  refundAmount?: bigint;
  refundedAt?: Date;
  capturedAmount?: bigint;
  authorizedAt?: Date;
  gatewayProvider: GatewayProvider;
  gatewayPaymentId: string;
}

export interface PaymentMethod {
  id: PaymentMethodId;
  customerId: CustomerId;
  type: PaymentMethodType;
  isDefault: boolean;
  card?: CardInfo;
  bankAccount?: BankAccountInfo;
  paypal?: PaypalInfo;
  digitalWallet?: DigitalWalletInfo;
  createdAt: Date;
  metadata?: Record<string, string>;
}

export interface Invoice {
  id: InvoiceId;
  customerId: CustomerId;
  amount: bigint;
  currency: Currency;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
  metadata?: Record<string, string>;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: bigint;
  total: bigint;
  metadata?: Record<string, string>;
}

export interface Subscription {
  id: SubscriptionId;
  customerId: CustomerId;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  paymentMethodId?: PaymentMethodId;
  createdAt: Date;
  metadata?: Record<string, string>;
}

// ============================================================================
// CHECKOUT TYPES
// ============================================================================

export interface CheckoutSession {
  id: string;
  status: CheckoutStatus;
  currency: Currency;
  amount?: bigint;
  lineItems?: CheckoutLineItem[];
  customerId?: CustomerId;
  paymentMethodId?: PaymentMethodId;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
  gatewayProvider: GatewayProvider;
  gatewaySessionId: string;
  metadata?: Record<string, string>;
}

export interface CheckoutLineItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: bigint;
  amount: bigint;
  currency: Currency;
  metadata?: Record<string, string>;
}

export interface Cart {
  id: string;
  customerId?: CustomerId;
  items: CartItem[];
  currency: Currency;
  subtotal: bigint;
  tax: bigint;
  discount: bigint;
  total: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: bigint;
  amount: bigint;
  currency: Currency;
  metadata?: Record<string, string>;
}

// ============================================================================
// CHARGE TYPES
// ============================================================================

export interface ChargeRequest {
  amount: bigint;
  currency: Currency;
  paymentMethodId: PaymentMethodId;
  customerId?: CustomerId;
  description?: string;
  capture?: boolean; // Default: true
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface ChargeResponse {
  payment: Payment;
  requiresAction?: boolean;
  nextAction?: NextAction;
}

export interface NextAction {
  type: 'redirect_to_url' | 'use_stripe_sdk' | 'verify_with_microdeposits';
  redirectUrl?: string;
  sdkData?: Record<string, any>;
}

export interface Receipt {
  id: string;
  paymentId: PaymentId;
  amount: bigint;
  currency: Currency;
  status: PaymentStatus;
  receiptUrl?: string;
  receiptNumber?: string;
  createdAt: Date;
}

// ============================================================================
// REFUND TYPES
// ============================================================================

export interface Refund {
  id: string;
  paymentId: PaymentId;
  amount: bigint;
  currency: Currency;
  status: RefundStatus;
  reason?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
  gatewayRefundId: string;
}

export interface RefundRequest {
  paymentId: PaymentId;
  amount?: bigint; // If not provided, refunds full amount
  reason?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface RefundPolicy {
  id: string;
  name: string;
  timeLimit?: number; // Days after payment
  maxRefundRatio?: number; // 0.0 to 1.0
  requireReason?: boolean;
  automaticApproval?: boolean;
  conditions?: RefundCondition[];
}

export interface RefundCondition {
  type: 'time_since_payment' | 'payment_amount' | 'customer_tier' | 'product_category';
  operator: 'less_than' | 'greater_than' | 'equals' | 'in' | 'not_in';
  value: any;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WebhookEvent {
  id: string;
  provider: GatewayProvider;
  type: string;
  data: Record<string, any>;
  signature?: string;
  timestamp: Date;
  processed: boolean;
  processingError?: string;
  retryCount: number;
}

export interface WebhookSignature {
  signature: string;
  timestamp: string;
  payload: string;
}

export interface WebhookHandler {
  handle(event: WebhookEvent): Promise<void>;
}

// ============================================================================
// GATEWAY TYPES
// ============================================================================

export interface GatewayConfig {
  provider: GatewayProvider;
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
  sandbox?: boolean;
  options?: Record<string, any>;
}

export interface GatewayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: GatewayError;
}

export interface GatewayError {
  code: string;
  message: string;
  type?: string;
  param?: string;
  details?: Record<string, any>;
}

export interface GatewayAdapter {
  createCharge(request: ChargeRequest): Promise<GatewayResponse<ChargeResponse>>;
  captureCharge(paymentId: PaymentId, amount?: bigint): Promise<GatewayResponse<Payment>>;
  voidCharge(paymentId: PaymentId): Promise<GatewayResponse<Payment>>;
  createRefund(request: RefundRequest): Promise<GatewayResponse<Refund>>;
  retrievePayment(paymentId: PaymentId): Promise<GatewayResponse<Payment>>;
  createCheckoutSession(session: Omit<CheckoutSession, 'id' | 'gatewaySessionId' | 'createdAt' | 'completedAt'>): Promise<GatewayResponse<CheckoutSession>>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface PaymentError extends Error {
  code: string;
  type: 'card_error' | 'validation_error' | 'api_error' | 'gateway_error' | 'idempotency_error';
  param?: string;
  paymentId?: PaymentId;
}

export interface ValidationError extends Error {
  field: string;
  value: any;
  constraint: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface PaymentsConfig {
  defaultCurrency: Currency;
  supportedCurrencies: Currency[];
  gateways: Record<GatewayProvider, GatewayConfig>;
  webhookUrl?: string;
  idempotencyTTL?: number; // Seconds
  sessionTimeout?: number; // Minutes
  autoCapture?: boolean;
  testMode?: boolean;
}
