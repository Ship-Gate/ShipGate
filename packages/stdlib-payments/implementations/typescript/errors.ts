// ============================================================================
// Payment Errors - Custom Error Classes
// ============================================================================

import { PaymentErrorCode, RefundErrorCode } from './types';

// ==========================================================================
// BASE ERROR CLASS
// ==========================================================================

export abstract class PaymentBaseError extends Error {
  abstract readonly code: string;
  abstract readonly retriable: boolean;
  readonly retryAfter?: number;
  readonly details?: Record<string, unknown>;
  
  constructor(
    message: string,
    options?: {
      retryAfter?: number;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.retryAfter = options?.retryAfter;
    this.details = options?.details;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      retryAfter: this.retryAfter,
      details: this.details,
    };
  }
}

// ==========================================================================
// PAYMENT ERRORS
// ==========================================================================

export class CardDeclinedError extends PaymentBaseError {
  readonly code = PaymentErrorCode.CARD_DECLINED;
  readonly retriable = false;
  
  constructor(
    declineCode: string,
    declineMessage: string,
    options?: { cause?: Error }
  ) {
    super(`Card declined: ${declineMessage}`, {
      details: { declineCode, declineMessage },
      cause: options?.cause,
    });
  }
}

export class InsufficientFundsError extends PaymentBaseError {
  readonly code = PaymentErrorCode.INSUFFICIENT_FUNDS;
  readonly retriable = true;
  
  constructor(options?: { cause?: Error }) {
    super('Card has insufficient funds', {
      retryAfter: 3600, // 1 hour
      cause: options?.cause,
    });
  }
}

export class InvalidCardError extends PaymentBaseError {
  readonly code = PaymentErrorCode.INVALID_CARD;
  readonly retriable = false;
  
  constructor(reason?: string, options?: { cause?: Error }) {
    super(reason ?? 'Invalid card number or details', {
      cause: options?.cause,
    });
  }
}

export class ExpiredCardError extends PaymentBaseError {
  readonly code = PaymentErrorCode.EXPIRED_CARD;
  readonly retriable = false;
  
  constructor(options?: { cause?: Error }) {
    super('Card has expired', { cause: options?.cause });
  }
}

export class AuthenticationRequiredError extends PaymentBaseError {
  readonly code = PaymentErrorCode.AUTHENTICATION_REQUIRED;
  readonly retriable = true;
  readonly actionUrl: string;
  readonly actionType: string;
  
  constructor(
    actionUrl: string,
    actionType: string,
    options?: { cause?: Error }
  ) {
    super('Additional authentication required (3DS/SCA)', {
      details: { actionUrl, actionType },
      cause: options?.cause,
    });
    this.actionUrl = actionUrl;
    this.actionType = actionType;
  }
}

export class FraudDetectedError extends PaymentBaseError {
  readonly code = PaymentErrorCode.FRAUD_DETECTED;
  readonly retriable = false;
  readonly riskScore: number;
  readonly riskFactors: string[];
  
  constructor(
    riskScore: number,
    riskFactors: string[],
    options?: { cause?: Error }
  ) {
    super('Transaction flagged as potentially fraudulent', {
      details: { riskScore, riskFactors },
      cause: options?.cause,
    });
    this.riskScore = riskScore;
    this.riskFactors = riskFactors;
  }
}

export class DuplicateRequestError extends PaymentBaseError {
  readonly code = PaymentErrorCode.DUPLICATE_REQUEST;
  readonly retriable = false;
  readonly existingPaymentId: string;
  
  constructor(existingPaymentId: string, options?: { cause?: Error }) {
    super('Idempotency key already used with different parameters', {
      details: { existingPaymentId },
      cause: options?.cause,
    });
    this.existingPaymentId = existingPaymentId;
  }
}

export class IdempotencyConflictError extends PaymentBaseError {
  readonly code = PaymentErrorCode.IDEMPOTENCY_CONFLICT;
  readonly retriable = true;
  
  constructor(options?: { cause?: Error }) {
    super('Concurrent request with same idempotency key', {
      retryAfter: 1,
      cause: options?.cause,
    });
  }
}

export class RateLimitedError extends PaymentBaseError {
  readonly code = PaymentErrorCode.RATE_LIMITED;
  readonly retriable = true;
  
  constructor(retryAfterSeconds: number, options?: { cause?: Error }) {
    super('Too many requests', {
      retryAfter: retryAfterSeconds,
      cause: options?.cause,
    });
  }
}

export class ProviderUnavailableError extends PaymentBaseError {
  readonly code = PaymentErrorCode.PROVIDER_UNAVAILABLE;
  readonly retriable = true;
  
  constructor(providerName: string, options?: { cause?: Error }) {
    super(`Payment provider ${providerName} temporarily unavailable`, {
      retryAfter: 30,
      details: { provider: providerName },
      cause: options?.cause,
    });
  }
}

export class InvalidAmountError extends PaymentBaseError {
  readonly code = PaymentErrorCode.INVALID_AMOUNT;
  readonly retriable = false;
  
  constructor(
    message: string,
    details?: { minAmount?: number; maxAmount?: number },
    options?: { cause?: Error }
  ) {
    super(message, {
      details,
      cause: options?.cause,
    });
  }
}

export class CurrencyNotSupportedError extends PaymentBaseError {
  readonly code = PaymentErrorCode.CURRENCY_NOT_SUPPORTED;
  readonly retriable = false;
  
  constructor(currency: string, options?: { cause?: Error }) {
    super(`Currency ${currency} is not supported`, {
      details: { currency },
      cause: options?.cause,
    });
  }
}

// ==========================================================================
// REFUND ERRORS
// ==========================================================================

export class PaymentNotFoundError extends PaymentBaseError {
  readonly code = RefundErrorCode.PAYMENT_NOT_FOUND;
  readonly retriable = false;
  
  constructor(paymentId: string, options?: { cause?: Error }) {
    super(`Payment ${paymentId} not found`, {
      details: { paymentId },
      cause: options?.cause,
    });
  }
}

export class PaymentNotRefundableError extends PaymentBaseError {
  readonly code = RefundErrorCode.PAYMENT_NOT_CAPTURED;
  readonly retriable = false;
  readonly currentStatus: string;
  readonly refundableStatuses: string[];
  
  constructor(
    currentStatus: string,
    refundableStatuses: string[],
    options?: { cause?: Error }
  ) {
    super(`Payment is not in a refundable status. Current: ${currentStatus}`, {
      details: { currentStatus, refundableStatuses },
      cause: options?.cause,
    });
    this.currentStatus = currentStatus;
    this.refundableStatuses = refundableStatuses;
  }
}

export class AmountExceedsAvailableError extends PaymentBaseError {
  readonly code = RefundErrorCode.AMOUNT_EXCEEDS_AVAILABLE;
  readonly retriable = false;
  readonly availableForRefund: number;
  readonly alreadyRefunded: number;
  readonly requested: number;
  
  constructor(
    availableForRefund: number,
    alreadyRefunded: number,
    requested: number,
    options?: { cause?: Error }
  ) {
    super(
      `Refund amount ${requested} exceeds available ${availableForRefund}`,
      {
        details: { availableForRefund, alreadyRefunded, requested },
        cause: options?.cause,
      }
    );
    this.availableForRefund = availableForRefund;
    this.alreadyRefunded = alreadyRefunded;
    this.requested = requested;
  }
}

export class RefundWindowExpiredError extends PaymentBaseError {
  readonly code = RefundErrorCode.REFUND_WINDOW_EXPIRED;
  readonly retriable = false;
  readonly capturedAt: Date;
  readonly refundDeadline: Date;
  
  constructor(
    capturedAt: Date,
    refundDeadline: Date,
    options?: { cause?: Error }
  ) {
    super('Refund window has expired (180 days)', {
      details: {
        capturedAt: capturedAt.toISOString(),
        refundDeadline: refundDeadline.toISOString(),
      },
      cause: options?.cause,
    });
    this.capturedAt = capturedAt;
    this.refundDeadline = refundDeadline;
  }
}

// ==========================================================================
// WEBHOOK ERRORS
// ==========================================================================

export class InvalidSignatureError extends PaymentBaseError {
  readonly code = 'INVALID_SIGNATURE';
  readonly retriable = false;
  
  constructor(provider: string, options?: { cause?: Error }) {
    super(`Webhook signature verification failed for ${provider}`, {
      details: { provider },
      cause: options?.cause,
    });
  }
}

export class StaleEventError extends PaymentBaseError {
  readonly code = 'STALE_EVENT';
  readonly retriable = false;
  readonly eventTimestamp: Date;
  readonly tolerance: number;
  
  constructor(
    eventTimestamp: Date,
    toleranceSeconds: number,
    options?: { cause?: Error }
  ) {
    super('Webhook event is older than tolerance window', {
      details: {
        eventTimestamp: eventTimestamp.toISOString(),
        toleranceSeconds,
      },
      cause: options?.cause,
    });
    this.eventTimestamp = eventTimestamp;
    this.tolerance = toleranceSeconds;
  }
}

// ==========================================================================
// ERROR FACTORY
// ==========================================================================

export function createPaymentError(
  code: PaymentErrorCode,
  message: string,
  details?: Record<string, unknown>
): PaymentBaseError {
  switch (code) {
    case PaymentErrorCode.CARD_DECLINED:
      return new CardDeclinedError(
        (details?.declineCode as string) ?? 'unknown',
        message
      );
    case PaymentErrorCode.INSUFFICIENT_FUNDS:
      return new InsufficientFundsError();
    case PaymentErrorCode.INVALID_CARD:
      return new InvalidCardError(message);
    case PaymentErrorCode.EXPIRED_CARD:
      return new ExpiredCardError();
    case PaymentErrorCode.FRAUD_DETECTED:
      return new FraudDetectedError(
        (details?.riskScore as number) ?? 100,
        (details?.riskFactors as string[]) ?? []
      );
    case PaymentErrorCode.DUPLICATE_REQUEST:
      return new DuplicateRequestError(
        (details?.existingPaymentId as string) ?? 'unknown'
      );
    case PaymentErrorCode.RATE_LIMITED:
      return new RateLimitedError((details?.retryAfter as number) ?? 60);
    case PaymentErrorCode.PROVIDER_UNAVAILABLE:
      return new ProviderUnavailableError(
        (details?.provider as string) ?? 'unknown'
      );
    default:
      return new class extends PaymentBaseError {
        readonly code = code;
        readonly retriable = false;
      }(message, { details });
  }
}
