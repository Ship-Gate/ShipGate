/**
 * Payment Processing Handlers
 * Implements the behavioral contracts from spec/payments.isl
 */

import { v4 as uuid } from 'uuid';
import {
  type Customer,
  type Payment,
  type Refund,
  type Subscription,
  type ApiResponse,
  PaymentStatus,
  PaymentMethod,
  SubscriptionStatus,
  RefundReason,
} from '../types.js';
import { customers, payments, refunds, subscriptions, logAuditEvent } from '../store.js';

// ============================================
// Mock Payment Processor
// ============================================

interface ProcessorResult {
  success: boolean;
  error_code?: string;
  error_message?: string;
}

/** @stub — Intentional demo mock; not production payment processing */
async function processPaymentWithMockProcessor(
  amount: number,
  card_last4?: string
): Promise<ProcessorResult> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Mock card behaviors based on last4
  if (card_last4 === '0002') {
    return {
      success: false,
      error_code: 'INSUFFICIENT_FUNDS',
      error_message: 'Card declined due to insufficient funds',
    };
  }

  if (card_last4 === '0003') {
    return {
      success: false,
      error_code: 'CARD_DECLINED',
      error_message: 'Card was declined by the issuer',
    };
  }

  if (card_last4 === '0004') {
    return {
      success: false,
      error_code: 'EXPIRED_CARD',
      error_message: 'Card has expired',
    };
  }

  // Default: successful payment
  return { success: true };
}

// Idempotency cache (in production, use Redis or similar)
const idempotencyCache = new Map<string, Payment>();

// ============================================
// CreatePayment Handler
// ============================================

export interface CreatePaymentInput {
  customer_id: string;
  amount: number;
  currency: string;
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotency_key?: string;
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<ApiResponse<Payment>> {
  // Check idempotency
  if (input.idempotency_key && idempotencyCache.has(input.idempotency_key)) {
    return {
      success: true,
      data: idempotencyCache.get(input.idempotency_key)!,
    };
  }

  // Preconditions
  if (input.amount <= 0) {
    return {
      success: false,
      error: {
        code: 'AMOUNT_TOO_SMALL',
        message: 'Amount must be greater than 0',
        retriable: false,
      },
    };
  }

  if (input.amount < 0.5) {
    return {
      success: false,
      error: {
        code: 'AMOUNT_TOO_SMALL',
        message: 'Amount is below minimum charge amount',
        retriable: false,
      },
    };
  }

  if (input.amount > 999999.99) {
    return {
      success: false,
      error: {
        code: 'AMOUNT_TOO_LARGE',
        message: 'Amount exceeds maximum charge amount',
        retriable: false,
      },
    };
  }

  if (!input.currency || input.currency.length !== 3) {
    return {
      success: false,
      error: {
        code: 'INVALID_CURRENCY',
        message: 'Currency must be a 3-letter ISO code',
        retriable: false,
      },
    };
  }

  const customer = customers.get(input.customer_id);
  if (!customer) {
    return {
      success: false,
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer does not exist',
        retriable: false,
      },
    };
  }

  const payment_method_id = input.payment_method_id || customer.default_payment_method_id;
  if (!payment_method_id) {
    return {
      success: false,
      error: {
        code: 'PAYMENT_METHOD_NOT_FOUND',
        message: 'Payment method does not exist or not attached to customer',
        retriable: false,
      },
    };
  }

  const now = new Date();

  // Create pending payment
  let payment = payments.create({
    id: uuid(),
    customer_id: input.customer_id,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    status: PaymentStatus.PROCESSING,
    payment_method_id,
    description: input.description,
    metadata: input.metadata,
    refunded_amount: 0,
    created_at: now,
    updated_at: now,
  });

  // Mock card last4 based on payment method ID
  const card_last4 = payment_method_id.includes('4242')
    ? '4242'
    : payment_method_id.includes('0002')
    ? '0002'
    : payment_method_id.includes('0003')
    ? '0003'
    : '4242';

  // Process payment
  const result = await processPaymentWithMockProcessor(input.amount, card_last4);

  if (result.success) {
    payment = payments.update(payment.id, {
      status: PaymentStatus.SUCCEEDED,
      updated_at: new Date(),
    })!;

    logAuditEvent({
      type: 'payment.succeeded',
      resource_type: 'payment',
      resource_id: payment.id,
      action: 'CHARGE',
      metadata: { amount: input.amount, currency: input.currency },
    });

    // Cache for idempotency
    if (input.idempotency_key) {
      idempotencyCache.set(input.idempotency_key, payment);
    }

    return { success: true, data: payment };
  } else {
    payment = payments.update(payment.id, {
      status: PaymentStatus.FAILED,
      failure_code: result.error_code,
      failure_message: result.error_message,
      updated_at: new Date(),
    })!;

    logAuditEvent({
      type: 'payment.failed',
      resource_type: 'payment',
      resource_id: payment.id,
      action: 'CHARGE_FAILED',
      metadata: { error_code: result.error_code },
    });

    const retriable = result.error_code !== 'EXPIRED_CARD';

    return {
      success: false,
      error: {
        code: result.error_code!,
        message: result.error_message!,
        retriable,
        retry_after: retriable ? 5 : undefined,
      },
    };
  }
}

// ============================================
// CreateRefund Handler
// ============================================

export interface CreateRefundInput {
  payment_id: string;
  amount?: number;
  reason: RefundReason;
  metadata?: Record<string, string>;
}

export async function createRefund(
  input: CreateRefundInput
): Promise<ApiResponse<Refund>> {
  const payment = payments.get(input.payment_id);

  if (!payment) {
    return {
      success: false,
      error: {
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment does not exist',
        retriable: false,
      },
    };
  }

  if (payment.status === PaymentStatus.REFUNDED) {
    return {
      success: false,
      error: {
        code: 'ALREADY_REFUNDED',
        message: 'Payment has already been fully refunded',
        retriable: false,
      },
    };
  }

  if (
    payment.status !== PaymentStatus.SUCCEEDED &&
    payment.status !== PaymentStatus.PARTIALLY_REFUNDED
  ) {
    return {
      success: false,
      error: {
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment is not in a refundable state',
        retriable: false,
      },
    };
  }

  const refundable_amount = payment.amount - payment.refunded_amount;
  const refund_amount = input.amount ?? refundable_amount;

  if (refund_amount <= 0) {
    return {
      success: false,
      error: {
        code: 'REFUND_AMOUNT_EXCEEDS_PAYMENT',
        message: 'Refund amount must be greater than 0',
        retriable: false,
      },
    };
  }

  if (refund_amount > refundable_amount) {
    return {
      success: false,
      error: {
        code: 'REFUND_AMOUNT_EXCEEDS_PAYMENT',
        message: 'Refund amount exceeds remaining refundable amount',
        retriable: false,
      },
    };
  }

  const now = new Date();

  const refund = refunds.create({
    id: uuid(),
    payment_id: input.payment_id,
    amount: refund_amount,
    reason: input.reason,
    status: PaymentStatus.SUCCEEDED,
    created_at: now,
  });

  const new_refunded_amount = payment.refunded_amount + refund_amount;
  const new_status =
    new_refunded_amount >= payment.amount
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;

  payments.update(payment.id, {
    refunded_amount: new_refunded_amount,
    status: new_status,
    updated_at: now,
  });

  logAuditEvent({
    type: 'payment.refunded',
    resource_type: 'refund',
    resource_id: refund.id,
    action: 'REFUND',
    metadata: { amount: refund_amount, reason: input.reason },
  });

  return { success: true, data: refund };
}

// ============================================
// CreateSubscription Handler
// ============================================

export interface CreateSubscriptionInput {
  customer_id: string;
  plan_id: string;
  payment_method_id?: string;
  trial_days?: number;
  metadata?: Record<string, string>;
}

export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  const customer = customers.get(input.customer_id);

  if (!customer) {
    return {
      success: false,
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer does not exist',
        retriable: false,
      },
    };
  }

  if (!input.plan_id || input.plan_id.length === 0) {
    return {
      success: false,
      error: {
        code: 'PLAN_NOT_FOUND',
        message: 'Plan does not exist',
        retriable: false,
      },
    };
  }

  // Check for existing active subscription
  const existingSub = subscriptions.findBy(
    (s) =>
      s.customer_id === input.customer_id &&
      s.plan_id === input.plan_id &&
      s.status !== SubscriptionStatus.CANCELED
  );

  if (existingSub) {
    return {
      success: false,
      error: {
        code: 'ALREADY_SUBSCRIBED',
        message: 'Customer already has an active subscription to this plan',
        retriable: false,
      },
    };
  }

  // Check payment method
  const has_payment_method =
    input.payment_method_id || customer.default_payment_method_id;
  if (!has_payment_method && (!input.trial_days || input.trial_days === 0)) {
    return {
      success: false,
      error: {
        code: 'PAYMENT_METHOD_REQUIRED',
        message: 'No payment method on file',
        retriable: false,
      },
    };
  }

  const now = new Date();
  const trial_end =
    input.trial_days && input.trial_days > 0
      ? new Date(now.getTime() + input.trial_days * 24 * 60 * 60 * 1000)
      : undefined;

  const period_end = trial_end || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const subscription = subscriptions.create({
    id: uuid(),
    customer_id: input.customer_id,
    plan_id: input.plan_id,
    status: trial_end ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
    current_period_start: now,
    current_period_end: period_end,
    cancel_at_period_end: false,
    trial_end,
    created_at: now,
  });

  logAuditEvent({
    type: 'subscription.created',
    resource_type: 'subscription',
    resource_id: subscription.id,
    action: 'CREATE',
    metadata: { plan_id: input.plan_id, trial_days: input.trial_days },
  });

  return { success: true, data: subscription };
}

// ============================================
// CancelSubscription Handler
// ============================================

export interface CancelSubscriptionInput {
  subscription_id: string;
  cancel_immediately?: boolean;
  reason?: string;
}

export async function cancelSubscription(
  input: CancelSubscriptionInput
): Promise<ApiResponse<Subscription>> {
  const subscription = subscriptions.get(input.subscription_id);

  if (!subscription) {
    return {
      success: false,
      error: {
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription does not exist',
        retriable: false,
      },
    };
  }

  if (subscription.status === SubscriptionStatus.CANCELED) {
    return {
      success: false,
      error: {
        code: 'ALREADY_CANCELED',
        message: 'Subscription is already canceled',
        retriable: false,
      },
    };
  }

  const now = new Date();

  let updated: Subscription;
  if (input.cancel_immediately) {
    updated = subscriptions.update(subscription.id, {
      status: SubscriptionStatus.CANCELED,
      canceled_at: now,
      cancel_at_period_end: false,
    })!;
  } else {
    updated = subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })!;
  }

  logAuditEvent({
    type: 'subscription.canceled',
    resource_type: 'subscription',
    resource_id: subscription.id,
    action: 'CANCEL',
    metadata: { immediately: input.cancel_immediately, reason: input.reason },
  });

  return { success: true, data: updated };
}

// ============================================
// GetPaymentHistory Handler
// ============================================

export interface GetPaymentHistoryInput {
  customer_id: string;
  limit?: number;
  starting_after?: string;
  status?: PaymentStatus;
}

export interface PaymentHistoryResult {
  payments: Payment[];
  has_more: boolean;
}

export async function getPaymentHistory(
  input: GetPaymentHistoryInput
): Promise<ApiResponse<PaymentHistoryResult>> {
  const customer = customers.get(input.customer_id);

  if (!customer) {
    return {
      success: false,
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer does not exist',
        retriable: false,
      },
    };
  }

  const limit = Math.min(input.limit ?? 10, 100);

  let customerPayments = payments.findAll((p) => p.customer_id === input.customer_id);

  // Filter by status if provided
  if (input.status) {
    customerPayments = customerPayments.filter((p) => p.status === input.status);
  }

  // Sort by created_at descending
  customerPayments.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  // Handle cursor pagination
  if (input.starting_after) {
    const cursorIndex = customerPayments.findIndex((p) => p.id === input.starting_after);
    if (cursorIndex >= 0) {
      customerPayments = customerPayments.slice(cursorIndex + 1);
    }
  }

  const has_more = customerPayments.length > limit;
  const result = customerPayments.slice(0, limit);

  return {
    success: true,
    data: {
      payments: result,
      has_more,
    },
  };
}

// ============================================
// Helper: Create Customer
// ============================================

export async function createCustomer(
  email: string,
  name?: string,
  default_payment_method_id?: string
): Promise<Customer> {
  const customer = customers.create({
    id: uuid(),
    email,
    name,
    default_payment_method_id,
    created_at: new Date(),
  });

  logAuditEvent({
    type: 'customer.created',
    resource_type: 'customer',
    resource_id: customer.id,
    action: 'CREATE',
  });

  return customer;
}
