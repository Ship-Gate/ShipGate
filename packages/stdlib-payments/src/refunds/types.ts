/**
 * Refunds types
 * @packageDocumentation
 */

import { PaymentId, Currency } from '../types';

// ============================================================================
// REFUND REQUEST TYPES
// ============================================================================

export interface RefundRequest {
  paymentId: PaymentId;
  amount?: bigint; // If not provided, refunds full amount
  reason?: RefundReason | string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
  reverseTransfer?: boolean;
  refundApplicationFee?: boolean;
  destination?: string; // For connected accounts
}

export type RefundReason = 
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'expired_uncaptured_charge';

// ============================================================================
// REFUND RESPONSE TYPES
// ============================================================================

export interface RefundResponse {
  refund: Refund;
}

export interface Refund {
  id: string;
  paymentId: PaymentId;
  amount: bigint;
  currency: Currency;
  status: RefundStatus;
  reason?: RefundReason | string;
  receiptNumber?: string;
  description?: string;
  failureCode?: string;
  failureMessage?: string;
  sourceTransferReversal?: string;
  transferReversal?: string;
  applicationFee?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  completedAt?: Date;
  balanceTransaction?: string;
}

export type RefundStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'requires_action';

// ============================================================================
// REFUND LIST TYPES
// ============================================================================

export interface ListRefundsRequest {
  payment?: PaymentId;
  charge?: string;
  status?: RefundStatus;
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

export interface ListRefundsResponse {
  refunds: Refund[];
  hasMore: boolean;
  totalCount?: number;
}

// ============================================================================
// REFUND CALCULATION TYPES
// ============================================================================

export interface RefundCalculation {
  maxRefundable: bigint;
  alreadyRefunded: bigint;
  availableToRefund: bigint;
  fees: {
    refundFee?: bigint;
    processingFee?: bigint;
    total: bigint;
  };
  netAmount: bigint;
}

export interface RefundEstimate {
  amount: bigint;
  fees: bigint;
  netAmount: bigint;
  currency: Currency;
  estimatedArrival: Date;
  method: 'original' | 'bank_transfer' | 'check' | 'store_credit';
}

// ============================================================================
// REFUND POLICY TYPES
// ============================================================================

export interface RefundPolicy {
  id: string;
  name: string;
  description?: string;
  timeLimit?: number; // Days after payment
  maxRefundRatio?: number; // 0.0 to 1.0
  minRefundAmount?: bigint;
  maxRefundAmount?: bigint;
  requireReason?: boolean;
  requireApproval?: boolean;
  automaticApproval?: boolean;
  restockFees?: {
    enabled: boolean;
    percentage?: number;
    fixedAmount?: bigint;
  };
  shippingFees?: {
    refundable: boolean;
    conditions?: string[];
  };
  conditions?: RefundCondition[];
  excludedProducts?: string[];
  includedProducts?: string[];
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value: any;
  message?: string;
}

export type ConditionType = 
  | 'time_since_payment'
  | 'payment_amount'
  | 'customer_tier'
  | 'product_category'
  | 'product_type'
  | 'order_total'
  | 'payment_method'
  | 'shipping_method'
  | 'custom';

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains';

// ============================================================================
// REFUND ELIGIBILITY TYPES
// ============================================================================

export interface RefundEligibility {
  eligible: boolean;
  reason?: string;
  maxAmount: bigint;
  policy?: RefundPolicy;
  conditions: EligibilityCondition[];
  requiresApproval: boolean;
  estimatedProcessingTime: number; // Days
}

export interface EligibilityCondition {
  type: string;
  satisfied: boolean;
  message: string;
  details?: any;
}

// ============================================================================
// REFUND APPROVAL TYPES
// ============================================================================

export interface RefundApproval {
  id: string;
  refundId: string;
  status: ApprovalStatus;
  reviewerId?: string;
  reviewerName?: string;
  decision?: 'approve' | 'deny';
  reason?: string;
  notes?: string;
  createdAt: Date;
  reviewedAt?: Date;
  expiresAt?: Date;
}

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired';

export interface RefundApprovalRequest {
  refundId: string;
  amount: bigint;
  reason?: string;
  customerId?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// REFUND DISPUTE TYPES
// ============================================================================

export interface RefundDispute {
  id: string;
  refundId: string;
  paymentId: PaymentId;
  reason: DisputeReason;
  status: DisputeStatus;
  amount: bigint;
  currency: Currency;
  evidence?: DisputeEvidence;
  evidenceDueBy: Date;
  isChargeRefundable: boolean;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
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

export interface DisputeEvidence {
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

// ============================================================================
// REFUND ANALYTICS TYPES
// ============================================================================

export interface RefundAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  totalRefunds: number;
  totalAmount: bigint;
  averageRefundAmount: bigint;
  refundRate: number; // Percentage of payments refunded
  reasons: RefundReasonBreakdown[];
  trends: RefundTrend[];
  policies: RefundPolicyAnalytics[];
}

export interface RefundReasonBreakdown {
  reason: string;
  count: number;
  amount: bigint;
  percentage: number;
}

export interface RefundTrend {
  date: Date;
  count: number;
  amount: bigint;
}

export interface RefundPolicyAnalytics {
  policyId: string;
  policyName: string;
  applications: number;
  approvals: number;
  denials: number;
  averageProcessingTime: number; // Hours
}
