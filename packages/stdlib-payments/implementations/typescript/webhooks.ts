// ============================================================================
// Webhook Processing - Handle Payment Provider Webhooks
// ============================================================================

import {
  WebhookEvent,
  WebhookProvider,
  WebhookEventType,
  PaymentId,
  PaymentStatus,
  RefundStatus,
  Result,
} from './types';
import { PaymentRepository } from './repositories/payment-repository';
import { RefundRepository } from './repositories/refund-repository';
import { WebhookEventRepository } from './repositories/webhook-repository';
import { PaymentProviderAdapter } from './providers';
import { InvalidSignatureError, StaleEventError } from './errors';
import { generateUUID } from './utils';

// ==========================================================================
// WEBHOOK PROCESSOR
// ==========================================================================

export interface WebhookProcessorConfig {
  paymentRepository: PaymentRepository;
  refundRepository: RefundRepository;
  webhookRepository: WebhookEventRepository;
  providers: Map<WebhookProvider, PaymentProviderAdapter>;
  
  // Configuration
  toleranceSeconds: number;
  maxRetries: number;
}

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

export class WebhookProcessor {
  private readonly config: WebhookProcessorConfig;
  
  constructor(config: WebhookProcessorConfig) {
    this.config = config;
  }
  
  async process(
    input: ProcessWebhookInput
  ): Promise<Result<WebhookEvent, ProcessWebhookError>> {
    // 1. Verify provider is known
    const provider = this.config.providers.get(input.provider);
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
      return {
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Webhook signature verification failed',
          retriable: false,
        },
      };
    }
    
    // 3. Check timestamp tolerance (replay protection)
    const now = new Date();
    const timeDiffSeconds = Math.abs(now.getTime() - input.timestamp.getTime()) / 1000;
    if (timeDiffSeconds > this.config.toleranceSeconds) {
      return {
        success: false,
        error: {
          code: 'STALE_EVENT',
          message: 'Webhook event is older than tolerance window',
          retriable: false,
          details: {
            eventTimestamp: input.timestamp.toISOString(),
            toleranceSeconds: this.config.toleranceSeconds,
          },
        },
      };
    }
    
    // 4. Check for duplicate (idempotency)
    const existing = await this.config.webhookRepository.findByEventId(
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
          details: { processedAt: existing.processedAt?.toISOString() },
        },
      };
    }
    
    // 5. Parse payload
    let parsedPayload: WebhookPayload;
    try {
      parsedPayload = this.parsePayload(input.provider, input.payload);
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
    const webhookEvent: WebhookEvent = {
      id: generateUUID(),
      provider: input.provider,
      eventType: this.mapEventType(input.provider, input.eventType),
      eventId: input.eventId,
      payload: input.payload,
      signatureVerified: true,
      paymentId: parsedPayload.paymentId as PaymentId | undefined,
      refundId: parsedPayload.refundId,
      processed: false,
      retryCount: 0,
      receivedAt: now,
    };
    
    // 7. Process the event
    try {
      await this.processEvent(webhookEvent, parsedPayload);
      webhookEvent.processed = true;
      webhookEvent.processedAt = new Date();
    } catch (error) {
      webhookEvent.processingError = error instanceof Error ? error.message : 'Unknown error';
      webhookEvent.retryCount += 1;
      
      await this.config.webhookRepository.save(webhookEvent);
      
      return {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: webhookEvent.processingError,
          retriable: webhookEvent.retryCount < this.config.maxRetries,
          retryAfter: 30,
        },
      };
    }
    
    // 8. Save event record
    await this.config.webhookRepository.save(webhookEvent);
    
    return { success: true, data: webhookEvent };
  }
  
  private async processEvent(
    event: WebhookEvent,
    payload: WebhookPayload
  ): Promise<void> {
    switch (event.eventType) {
      case WebhookEventType.PAYMENT_CAPTURED:
        await this.handlePaymentCaptured(payload);
        break;
      case WebhookEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(payload);
        break;
      case WebhookEventType.PAYMENT_REFUNDED:
        await this.handlePaymentRefunded(payload);
        break;
      case WebhookEventType.PAYMENT_DISPUTED:
        await this.handlePaymentDisputed(payload);
        break;
      case WebhookEventType.REFUND_SUCCEEDED:
        await this.handleRefundSucceeded(payload);
        break;
      case WebhookEventType.REFUND_FAILED:
        await this.handleRefundFailed(payload);
        break;
      default:
        // Log unknown event type but don't fail
        break;
    }
  }
  
  private async handlePaymentCaptured(payload: WebhookPayload): Promise<void> {
    if (!payload.paymentId) return;
    
    const payment = await this.config.paymentRepository.findByProviderId(
      payload.paymentId
    );
    if (!payment) {
      throw new Error(`Payment not found: ${payload.paymentId}`);
    }
    
    payment.status = PaymentStatus.CAPTURED;
    payment.capturedAt = new Date();
    payment.capturedAmount = payload.amount ?? payment.amount;
    payment.updatedAt = new Date();
    
    await this.config.paymentRepository.save(payment);
  }
  
  private async handlePaymentFailed(payload: WebhookPayload): Promise<void> {
    if (!payload.paymentId) return;
    
    const payment = await this.config.paymentRepository.findByProviderId(
      payload.paymentId
    );
    if (!payment) {
      throw new Error(`Payment not found: ${payload.paymentId}`);
    }
    
    payment.status = PaymentStatus.FAILED;
    payment.failureMessage = payload.failureMessage;
    payment.updatedAt = new Date();
    
    await this.config.paymentRepository.save(payment);
  }
  
  private async handlePaymentRefunded(payload: WebhookPayload): Promise<void> {
    if (!payload.paymentId) return;
    
    const payment = await this.config.paymentRepository.findByProviderId(
      payload.paymentId
    );
    if (!payment) {
      throw new Error(`Payment not found: ${payload.paymentId}`);
    }
    
    const refundAmount = payload.amount ?? 0;
    payment.refundedAmount += refundAmount;
    
    if (payment.refundedAmount >= payment.capturedAmount) {
      payment.status = PaymentStatus.REFUNDED;
    } else {
      payment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }
    
    payment.updatedAt = new Date();
    await this.config.paymentRepository.save(payment);
  }
  
  private async handlePaymentDisputed(payload: WebhookPayload): Promise<void> {
    if (!payload.paymentId) return;
    
    const payment = await this.config.paymentRepository.findByProviderId(
      payload.paymentId
    );
    if (!payment) {
      throw new Error(`Payment not found: ${payload.paymentId}`);
    }
    
    payment.status = PaymentStatus.DISPUTED;
    payment.updatedAt = new Date();
    
    await this.config.paymentRepository.save(payment);
    
    // Trigger dispute alert (would be handled by notification service)
  }
  
  private async handleRefundSucceeded(payload: WebhookPayload): Promise<void> {
    if (!payload.refundId) return;
    
    const refund = await this.config.refundRepository.findByProviderId(
      payload.refundId
    );
    if (!refund) return;
    
    refund.status = RefundStatus.SUCCEEDED;
    refund.completedAt = new Date();
    refund.updatedAt = new Date();
    
    await this.config.refundRepository.save(refund);
  }
  
  private async handleRefundFailed(payload: WebhookPayload): Promise<void> {
    if (!payload.refundId) return;
    
    const refund = await this.config.refundRepository.findByProviderId(
      payload.refundId
    );
    if (!refund) return;
    
    refund.status = RefundStatus.FAILED;
    refund.failureMessage = payload.failureMessage;
    refund.completedAt = new Date();
    refund.updatedAt = new Date();
    
    await this.config.refundRepository.save(refund);
  }
  
  private parsePayload(provider: WebhookProvider, payload: string): WebhookPayload {
    const data = JSON.parse(payload);
    
    switch (provider) {
      case WebhookProvider.STRIPE:
        return this.parseStripePayload(data);
      case WebhookProvider.BRAINTREE:
        return this.parseBraintreePayload(data);
      case WebhookProvider.ADYEN:
        return this.parseAdyenPayload(data);
      case WebhookProvider.SQUARE:
        return this.parseSquarePayload(data);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  private parseStripePayload(data: Record<string, unknown>): WebhookPayload {
    const object = data.data?.object as Record<string, unknown> ?? {};
    
    return {
      paymentId: (object.id as string) ?? (object.payment_intent as string),
      refundId: data.type === 'refund.created' ? (object.id as string) : undefined,
      amount: typeof object.amount === 'number' ? object.amount / 100 : undefined,
      currency: object.currency as string,
      failureMessage: object.last_payment_error?.message as string,
    };
  }
  
  private parseBraintreePayload(data: Record<string, unknown>): WebhookPayload {
    return {
      paymentId: data.transaction?.id as string,
      amount: data.transaction?.amount as number,
    };
  }
  
  private parseAdyenPayload(data: Record<string, unknown>): WebhookPayload {
    return {
      paymentId: data.pspReference as string,
      amount: data.amount?.value as number,
    };
  }
  
  private parseSquarePayload(data: Record<string, unknown>): WebhookPayload {
    return {
      paymentId: data.payment?.id as string,
      amount: data.payment?.amount_money?.amount as number,
    };
  }
  
  private mapEventType(provider: WebhookProvider, eventType: string): WebhookEventType {
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
    
    // Add mappings for other providers
    return WebhookEventType.PAYMENT_CREATED;
  }
}

interface WebhookPayload {
  paymentId?: string;
  refundId?: string;
  amount?: number;
  currency?: string;
  failureMessage?: string;
}

// ==========================================================================
// WEBHOOK SIGNATURE VERIFICATION UTILITIES
// ==========================================================================

export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const sig = parts.find(p => p.startsWith('v1='))?.slice(3);
  
  if (!timestamp || !sig) {
    return false;
  }
  
  // Check timestamp (5 minute tolerance)
  const timestampMs = parseInt(timestamp, 10) * 1000;
  if (Math.abs(Date.now() - timestampMs) > 300000) {
    return false;
  }
  
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

export function verifyBraintreeSignature(
  payload: string,
  signature: string,
  publicKey: string,
  privateKey: string
): boolean {
  // Braintree uses a different signature scheme
  // Implementation would use the official Braintree SDK
  return false;
}

export function verifyAdyenSignature(
  payload: string,
  signature: string,
  hmacKey: string
): boolean {
  const crypto = require('crypto');
  
  const expectedSig = crypto
    .createHmac('sha256', Buffer.from(hmacKey, 'hex'))
    .update(payload)
    .digest('base64');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}
