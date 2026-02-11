/**
 * Charges types
 * @packageDocumentation
 */

import { PaymentId, PaymentMethodId, CustomerId, Currency, PaymentStatus } from '../types';

// ============================================================================
// CHARGE REQUEST TYPES
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
  statementDescriptor?: string;
  receiptEmail?: string;
  shipping?: ShippingDetails;
  offSession?: boolean;
  setupFutureUsage?: 'off_session' | 'on_session';
}

export interface ShippingDetails {
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  carrier?: string;
  trackingNumber?: string;
}

// ============================================================================
// CHARGE RESPONSE TYPES
// ============================================================================

export interface ChargeResponse {
  charge: Charge;
  requiresAction?: boolean;
  nextAction?: NextAction;
}

export interface Charge {
  id: PaymentId;
  amount: bigint;
  currency: Currency;
  status: ChargeStatus;
  paymentMethodId: PaymentMethodId;
  customerId?: CustomerId;
  description?: string;
  statementDescriptor?: string;
  receiptEmail?: string;
  receiptUrl?: string;
  receiptNumber?: string;
  failureCode?: string;
  failureMessage?: string;
  fraudDetails?: FraudDetails;
  outcome?: Outcome;
  paid: boolean;
  captured: boolean;
  capturedAmount?: bigint;
  authorizedAmount?: bigint;
  refundedAmount?: bigint;
  dispute?: Dispute;
  reviews?: Review[];
  transfer?: Transfer;
  applicationFeeAmount?: bigint;
  balanceTransaction?: string;
  sourceTransfer?: string;
  destination?: string;
  transferGroup?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updated: Date;
}

export type ChargeStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'requires_action'
  | 'requires_payment_method'
  | 'requires_capture'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded';

export interface NextAction {
  type: 'redirect_to_url' | 'use_stripe_sdk' | 'verify_with_microdeposits' | 'authorize_with_url';
  redirectUrl?: string;
  sdkData?: Record<string, any>;
  authorizeUrl?: string;
  microdepositVerification?: {
    amounts: [number, number];
    verificationMethod: 'descriptor_code' | 'amounts';
  };
}

export interface FraudDetails {
  stripeReport?: 'fraudulent' | 'safe';
  userReport?: 'fraudulent' | 'safe';
}

export interface Outcome {
  networkStatus: 'approved_by_network' | 'declined_by_network' | 'not_sent_to_network' | 'reversed_after_approval';
  reason?: string;
  riskLevel: 'normal' | 'elevated' | 'highest';
  riskScore?: number;
  sellerMessage: string;
  type: 'authorized' | 'issuer_declined' | 'blocked' | 'invalid' | 'manual_review';
}

export interface Dispute {
  id: string;
  amount: bigint;
  currency: Currency;
  reason: DisputeReason;
  status: DisputeStatus;
  evidence?: Evidence;
  evidenceDueBy: Date;
  isChargeRefundable: boolean;
  metadata?: Record<string, string>;
  created: Date;
}

export type DisputeReason = 
  | 'duplicate'
  | 'fraudulent'
  | 'subscription_canceled'
  | 'product_unacceptable'
  | 'product_not_received'
  | 'unrecognized'
  | 'credit_not_processed'
  | 'general'
  | 'incorrect_account_details'
  | 'insufficient_funds'
  | 'bank_cannot_process'
  | 'debit_not_authorized'
  | 'customer_initiated';

export type DisputeStatus = 
  | 'warning_needs_response'
  | 'warning_under_review'
  | 'warning_closed'
  | 'needs_response'
  | 'under_review'
  | 'charge_refunded'
  | 'lost'
  | 'won';

export interface Evidence {
  accessActivityLog?: string;
  billingAddress?: string;
  cancellationPolicy?: string;
  cancellationPolicyDisclosure?: string;
  cancellationRebuttal?: string;
  customerCommunication?: string;
  customerEmailAddress?: string;
  customerName?: string;
  customerPurchaseIp?: string;
  customerSignature?: string;
  duplicateChargeDocumentation?: string;
  duplicateChargeExplanation?: string;
  duplicateChargeId?: string;
  productDescription?: string;
  receipt?: string;
  refundPolicy?: string;
  refundPolicyDisclosure?: string;
  refundRefusalExplanation?: string;
  serviceDate?: string;
  serviceDocumentation?: string;
  shippingAddress?: string;
  shippingCarrier?: string;
  shippingDate?: string;
  shippingDocumentation?: string;
  shippingTrackingNumber?: string;
  uncategorizedFile?: string;
  uncategorizedText?: string;
}

export interface Review {
  id: string;
  charge: PaymentId;
  created: Date;
  livemode: boolean;
  open: boolean;
  reason: ReviewReason;
}

export type ReviewReason = 
  | 'approved'
  | 'list'
  | 'manual'
  | 'rule'
  | 'watchlist';

export interface Transfer {
  id: string;
  amount: bigint;
  currency: Currency;
  destination: string;
  destinationPayment?: string;
  reversals?: string[];
  sourceTransaction?: string;
  transferGroup?: string;
  metadata?: Record<string, string>;
  created: Date;
}

// ============================================================================
// CAPTURE TYPES
// ============================================================================

export interface CaptureRequest {
  chargeId: PaymentId;
  amount?: bigint; // If not provided, captures full authorized amount
  statementDescriptor?: string;
  metadata?: Record<string, string>;
  transferGroup?: string;
  applicationFeeAmount?: bigint;
  transferData?: TransferData;
}

export interface TransferData {
  destination: string;
  amount?: bigint;
  transferGroup?: string;
}

export interface CaptureResponse {
  capture: Capture;
}

export interface Capture {
  id: string;
  amount: bigint;
  currency: Currency;
  charge: PaymentId;
  paymentMethodId: PaymentMethodId;
  status: CaptureStatus;
  failureCode?: string;
  failureMessage?: string;
  applicationFeeAmount?: bigint;
  balanceTransaction?: string;
  destination?: string;
  transferGroup?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
}

export type CaptureStatus = 
  | 'succeeded'
  | 'pending'
  | 'failed';

// ============================================================================
// VOID TYPES
// ============================================================================

export interface VoidRequest {
  chargeId: PaymentId;
  reason?: VoidReason;
  metadata?: Record<string, string>;
}

export type VoidReason = 
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'abandoned'
  | 'unknown';

export interface VoidResponse {
  void: Void;
}

export interface Void {
  id: string;
  charge: PaymentId;
  amount: bigint;
  currency: Currency;
  status: VoidStatus;
  reason?: VoidReason;
  metadata?: Record<string, string>;
  createdAt: Date;
}

export type VoidStatus = 
  | 'succeeded'
  | 'failed';

// ============================================================================
// CHARGE LIST TYPES
// ============================================================================

export interface ListChargesRequest {
  customer?: CustomerId;
  paymentMethod?: PaymentMethodId;
  created?: DateFilter;
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
}

export interface DateFilter {
  gt?: Date;
  gte?: Date;
  lt?: Date;
  lte?: Date;
}

export interface ListChargesResponse {
  charges: Charge[];
  hasMore: boolean;
  totalCount?: number;
}

// ============================================================================
// CHARGE UPDATE TYPES
// ============================================================================

export interface UpdateChargeRequest {
  chargeId: PaymentId;
  description?: string;
  metadata?: Record<string, string>;
  fraudDetails?: {
    userReport?: 'fraudulent' | 'safe';
  };
  transferGroup?: string;
}

export interface UpdateChargeResponse {
  charge: Charge;
}
