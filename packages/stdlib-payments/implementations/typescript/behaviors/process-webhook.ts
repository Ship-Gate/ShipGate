// ============================================================================
// ProcessWebhook Behavior Implementation
// ============================================================================

import {
  WebhookEvent,
  WebhookProvider,
  WebhookEventType,
  PaymentId,
  RefundId,
  PaymentStatus,
  RefundStatus,
  Result,
} from '../types';
import { PaymentRepository } from '../repositories/payment-repository';
import { RefundRepository } from '../repositories/refund-repository';
import { WebhookEventRepository } from '../repositories/webhook-repository';
import { PaymentProviderAdapter } from '../providers';
import { PaymentMetrics } from '../metrics';
import { generateUUID } from '../utils';

// ==========================================================================
// INPUT/OUTPUT TYPES
// ==========================================================================

export interface ProcessWebhookInput {
  provider: WebhookProvider;
  eventId: string;
  eventType: string;
  signature: string;
  timestamp: Date;
  payload: string;
  headers: Record<string, string>;
}

export interface ProcessWebhookError {
  code: string;
  message: string;
  retriable: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

export type ProcessWebhookResult = Result<WebhookEvent, ProcessWebhookError>;

// ==========================================================================
// BEHAVIOR IMPLEMENTATION
// ==========================================================================

export interface ProcessWebhookConfig {
  paymentRepository: PaymentRepository;
  refundRepository: RefundRepository;
  webhookRepository: WebhookEventRepository;
  providers: Map<WebhookProvider, PaymentProviderAdapter>;
  metrics: PaymentMetrics;
  toleranceSeconds: number;
  maxRetries: number;
}

export async function processWebhook(
  input: ProcessWebhookInput,
  config: ProcessWebhookConfig
): Promise<ProcessWebhookResult> {
  config.metrics.recordWebhookReceived(input.provider, input.eventType);
  
  try {
    // 1. Get provider adapter
    const provider = config.providers.get(input.provider);
    if (!provider) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_PROVIDER',
          message: `Unknown webhook provider: ${input.provider}`,
          retriable: false,
        },
      };
    }
    
    // 2. Verify signature
    const isValid = provider.verifyWebhookSignature(input.payload, input.signature);
    if (!isValid) {
      config.metrics.recordWebhookProcessed(input.provider, input.eventType, false);
      return {
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Webhook signature verification failed',
          retriable: false,
        },
      };
    }
    
    // 3. Check timestamp tolerance
    const now = new Date();
    const timeDiffSeconds = Math.abs(now.getTime() - input.timestamp.getTime()) / 1000;
    
    if (timeDiffSeconds > config.toleranceSeconds) {
      return {
        success: false,
        error: {
          code: 'STALE_EVENT',
          message: 'Webhook event is older than tolerance window',
          retriable: false,
          details: {
            eventTimestamp: input.timestamp.toISOString(),
            toleranceSeconds: config.toleranceSeconds,
          },
        },
      };
    }
    
    // 4. Check for duplicate
    const existing = await config.webhookRepository.findByEventId(
      input.provider,
      input.eventId
    );
    
    if (existing) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_EVENT',
          message: 'Event has already been processed',
          retriable: false,
          details: {
            processedAt: existing.processedAt?.toISOString(),
          },
        },
      };
    }
    
    // 5. Parse payload
    let parsedPayload: ParsedWebhookPayload;
    try {
      parsedPayload = parsePayload(input.provider, input.payload);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MALFORMED_PAYLOAD',
          message: 'Payload cannot be parsed',
          retriable: false,
          details: {
            parseError: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      };
    }
    
    // 6. Create webhook event record
    const eventType = mapEventType(input.provider, input.eventType);
    const webhookEvent: WebhookEvent = {
      id: generateUUID(),
      provider: input.provider,
      eventType,
      eventId: input.eventId,
      payload: input.payload,
      signatureVerified: true,
      paymentId: parsedPayload.paymentId as PaymentId | undefined,
      refundId: parsedPayload.refundId as RefundId | undefined,
      processed: false,
      retryCount: 0,
      receivedAt: now,
    };
    
    // 7. Process the event
    try {
      await processEvent(webhookEvent, parsedPayload, config);
      webhookEvent.processed = true;
      webhookEvent.processedAt = new Date();
    } catch (error) {
      webhookEvent.processingError = error instanceof Error ? error.message : 'Unknown error';
      webhookEvent.retryCount += 1;
      
      await config.webhookRepository.save(webhookEvent);
      
      config.metrics.recordWebhookProcessed(input.provider, input.eventType, false);
      
      return {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: webhookEvent.processingError,
          retriable: webhookEvent.retryCount < config.maxRetries,
          retryAfter: 30,
        },
      };
    }
    
    // 8. Save event record
    await config.webhookRepository.save(webhookEvent);
    
    config.metrics.recordWebhookProcessed(input.provider, input.eventType, true);
    
    return { success: true, data: webhookEvent };
    
  } catch (error) {
    config.metrics.recordWebhookProcessed(input.provider, input.eventType, false);
    return {
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        retriable: true,
        retryAfter: 30,
      },
    };
  }
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

interface ParsedWebhookPayload {
  paymentId?: string;
  refundId?: string;
  amount?: number;
  currency?: string;
  failureMessage?: string;
}

function parsePayload(provider: WebhookProvider, payload: string): ParsedWebhookPayload {
  const data = JSON.parse(payload);
  
  switch (provider) {
    case WebhookProvider.STRIPE:
      return parseStripePayload(data);
    case WebhookProvider.BRAINTREE:
      return parseBraintreePayload(data);
    case WebhookProvider.ADYEN:
      return parseAdyenPayload(data);
    case WebhookProvider.SQUARE:
      return parseSquarePayload(data);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function parseStripePayload(data: Record<string, unknown>): ParsedWebhookPayload {
  const object = (data.data as Record<string, unknown>)?.object as Record<string, unknown> ?? {};
  
  return {
    paymentId: (object.id as string) ?? (object.payment_intent as string),
    refundId: data.type === 'refund.created' ? (object.id as string) : undefined,
    amount: typeof object.amount === 'number' ? object.amount / 100 : undefined,
    currency: object.currency as string,
    failureMessage: (object.last_payment_error as Record<string, unknown>)?.message as string,
  };
}

function parseBraintreePayload(data: Record<string, unknown>): ParsedWebhookPayload {
  const transaction = data.transaction as Record<string, unknown> | undefined;
  return {
    paymentId: transaction?.id as string,
    amount: transaction?.amount as number,
  };
}

function parseAdyenPayload(data: Record<string, unknown>): ParsedWebhookPayload {
  const amount = data.amount as Record<string, unknown> | undefined;
  return {
    paymentId: data.pspReference as string,
    amount: amount?.value as number,
  };
}

function parseSquarePayload(data: Record<string, unknown>): ParsedWebhookPayload {
  const payment = data.payment as Record<string, unknown> | undefined;
  const amountMoney = payment?.amount_money as Record<string, unknown> | undefined;
  return {
    paymentId: payment?.id as string,
    amount: amountMoney?.amount as number,
  };
}

function mapEventType(provider: WebhookProvider, eventType: string): WebhookEventType {
  const stripeMap: Record<string, WebhookEventType> = {
    'payment_intent.created': WebhookEventType.PAYMENT_CREATED,
    'payment_intent.succeeded': WebhookEventType.PAYMENT_CAPTURED,
    'payment_intent.payment_failed': WebhookEventType.PAYMENT_FAILED,
    'charge.refunded': WebhookEventType.PAYMENT_REFUNDED,
    'charge.dispute.created': WebhookEventType.PAYMENT_DISPUTED,
    'refund.created': WebhookEventType.REFUND_CREATED,
    'refund.updated': WebhookEventType.REFUND_SUCCEEDED,
  };
  
  if (provider === WebhookProvider.STRIPE) {
    return stripeMap[eventType] ?? WebhookEventType.PAYMENT_CREATED;
  }
  
  return WebhookEventType.PAYMENT_CREATED;
}

async function processEvent(
  event: WebhookEvent,
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  switch (event.eventType) {
    case WebhookEventType.PAYMENT_CAPTURED:
      await handlePaymentCaptured(payload, config);
      break;
    case WebhookEventType.PAYMENT_FAILED:
      await handlePaymentFailed(payload, config);
      break;
    case WebhookEventType.PAYMENT_REFUNDED:
      await handlePaymentRefunded(payload, config);
      break;
    case WebhookEventType.PAYMENT_DISPUTED:
      await handlePaymentDisputed(payload, config);
      break;
    case WebhookEventType.REFUND_SUCCEEDED:
      await handleRefundSucceeded(payload, config);
      break;
    case WebhookEventType.REFUND_FAILED:
      await handleRefundFailed(payload, config);
      break;
    default:
      // Unknown event type, log but don't fail
      break;
  }
}

async function handlePaymentCaptured(
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  if (!payload.paymentId) return;
  
  const payment = await config.paymentRepository.findByProviderId(payload.paymentId);
  if (!payment) {
    throw new Error(`Payment not found: ${payload.paymentId}`);
  }
  
  await config.paymentRepository.update(payment.id, {
    status: PaymentStatus.CAPTURED,
    capturedAt: new Date(),
    capturedAmount: payload.amount ?? payment.amount,
  });
}

async function handlePaymentFailed(
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  if (!payload.paymentId) return;
  
  const payment = await config.paymentRepository.findByProviderId(payload.paymentId);
  if (!payment) {
    throw new Error(`Payment not found: ${payload.paymentId}`);
  }
  
  await config.paymentRepository.update(payment.id, {
    status: PaymentStatus.FAILED,
    failureMessage: payload.failureMessage,
  });
}

async function handlePaymentRefunded(
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  if (!payload.paymentId) return;
  
  const payment = await config.paymentRepository.findByProviderId(payload.paymentId);
  if (!payment) {
    throw new Error(`Payment not found: ${payload.paymentId}`);
  }
  
  const refundAmount = payload.amount ?? 0;
  const newRefundedAmount = payment.refundedAmount + refundAmount;
  const newStatus = newRefundedAmount >= payment.capturedAmount
    ? PaymentStatus.REFUNDED
    : PaymentStatus.PARTIALLY_REFUNDED;
  
  await config.paymentRepository.update(payment.id, {
    status: newStatus,
    refundedAmount: newRefundedAmount,
  });
}

async function handlePaymentDisputed(
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  if (!payload.paymentId) return;
  
  const payment = await config.paymentRepository.findByProviderId(payload.paymentId);
  if (!payment) {
    throw new Error(`Payment not found: ${payload.paymentId}`);
  }
  
  await config.paymentRepository.update(payment.id, {
    status: PaymentStatus.DISPUTED,
  });
}

async function handleRefundSucceeded(
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  if (!payload.refundId) return;
  
  const refund = await config.refundRepository.findByProviderId(payload.refundId);
  if (!refund) return;
  
  await config.refundRepository.update(refund.id, {
    status: RefundStatus.SUCCEEDED,
    completedAt: new Date(),
  });
}

async function handleRefundFailed(
  payload: ParsedWebhookPayload,
  config: ProcessWebhookConfig
): Promise<void> {
  if (!payload.refundId) return;
  
  const refund = await config.refundRepository.findByProviderId(payload.refundId);
  if (!refund) return;
  
  await config.refundRepository.update(refund.id, {
    status: RefundStatus.FAILED,
    failureMessage: payload.failureMessage,
    completedAt: new Date(),
  });
}
