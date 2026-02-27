/**
 * Subscription-specific types.
 */

import { Money } from '../money.js';
import type {
  SubscriptionId,
  CustomerId,
  PlanId,
  PriceId,
  PaymentMethodId,
  InvoiceId,
  Currency,
  SubscriptionStatus,
  CollectionMethod,
  BillingProvider,
  CancellationDetails,
  CancellationReason,
  PauseCollection,
  DiscountInfo,
  ProrationBehavior,
} from '../types.js';

// ============================================================================
// SUBSCRIPTION ENTITY
// ============================================================================

export interface Subscription {
  id: SubscriptionId;
  customerId: CustomerId;
  planId: PlanId;
  priceId?: PriceId;
  status: SubscriptionStatus;

  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingCycleAnchor: Date;

  trialStart?: Date;
  trialEnd?: Date;

  canceledAt?: Date;
  cancelAt?: Date;
  cancelAtPeriodEnd: boolean;
  cancellationDetails?: CancellationDetails;

  quantity: number;
  discountId?: string;
  discount?: DiscountInfo;

  collectionMethod: CollectionMethod;
  defaultPaymentMethodId?: PaymentMethodId;
  latestInvoiceId?: InvoiceId;

  pauseCollection?: PauseCollection;

  metadata?: Record<string, string>;

  providerSubscriptionId?: string;
  provider: BillingProvider;

  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
}

// ============================================================================
// INPUT / OUTPUT
// ============================================================================

export interface CreateSubscriptionInput {
  customerId: CustomerId;
  planId: PlanId;
  priceId?: PriceId;
  paymentMethodId?: PaymentMethodId;
  quantity?: number;
  trialDays?: number;
  trialEnd?: Date;
  couponCode?: string;
  collectionMethod?: CollectionMethod;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionResult {
  subscription: Subscription;
  latestInvoice?: import('../invoice/types.js').Invoice;
  pendingSetupIntent?: string;
}

export interface CancelSubscriptionInput {
  subscriptionId: SubscriptionId;
  cancelImmediately?: boolean;
  cancelAt?: Date;
  prorate?: boolean;
  cancellationDetails?: {
    reason?: CancellationReason;
    feedback?: string;
  };
}

export interface CancelSubscriptionResult {
  subscription: Subscription;
  proratedCredit?: Money;
  finalInvoice?: import('../invoice/types.js').Invoice;
}

export interface ChangePlanInput {
  subscriptionId: SubscriptionId;
  newPlanId: PlanId;
  newPriceId?: PriceId;
  quantity?: number;
  prorationBehavior?: ProrationBehavior;
}

export interface ChangePlanResult {
  subscription: Subscription;
  prorations?: import('../invoice/types.js').LineItem[];
  invoice?: import('../invoice/types.js').Invoice;
}
