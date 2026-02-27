/**
 * Payment error classes
 * @packageDocumentation
 */

import { PaymentId, PaymentMethodId } from './types';

// ============================================================================
// BASE PAYMENT ERROR
// ============================================================================

export class PaymentError extends Error {
  public readonly code: string;
  public readonly type: 'card_error' | 'validation_error' | 'api_error' | 'gateway_error' | 'idempotency_error';
  public readonly param?: string;
  public readonly paymentId?: PaymentId;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    type: PaymentError['type'],
    options?: {
      param?: string;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.type = type;
    this.param = options?.param;
    this.paymentId = options?.paymentId;

    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PaymentError);
    }
  }
}

// ============================================================================
// CARD ERRORS
// ============================================================================

export class CardError extends PaymentError {
  constructor(
    message: string,
    code: string,
    options?: {
      param?: string;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message, code, 'card_error', options);
    this.name = 'CardError';
  }

  static cardDeclined(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Card was declined', 'card_declined', options);
  }

  static insufficientFunds(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Insufficient funds on card', 'insufficient_funds', options);
  }

  static incorrectCvc(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Incorrect CVC', 'incorrect_cvc', options);
  }

  static expiredCard(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Card has expired', 'expired_card', options);
  }

  static processingError(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Error processing card', 'processing_error', options);
  }

  static incorrectNumber(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Incorrect card number', 'incorrect_number', options);
  }

  static invalidExpiryMonth(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Invalid expiration month', 'invalid_expiry_month', options);
  }

  static invalidExpiryYear(options?: { paymentId?: PaymentId }): CardError {
    return new CardError('Invalid expiration year', 'invalid_expiry_year', options);
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class ValidationError extends PaymentError {
  public readonly field: string;
  public readonly value: any;
  public readonly constraint: string;

  constructor(
    message: string,
    field: string,
    value: any,
    constraint: string,
    options?: { paymentId?: PaymentId; cause?: Error }
  ) {
    super(message, 'validation_error', 'validation_error', {
      param: field,
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.constraint = constraint;
  }

  static required(field: string, options?: { paymentId?: PaymentId }): ValidationError {
    return new ValidationError(
      `${field} is required`,
      field,
      null,
      'required',
      options
    );
  }

  static invalidFormat(field: string, value: any, format: string, options?: { paymentId?: PaymentId }): ValidationError {
    return new ValidationError(
      `${field} must be in ${format} format`,
      field,
      value,
      'format',
      options
    );
  }

  static invalidRange(field: string, value: any, min?: number, max?: number, options?: { paymentId?: PaymentId }): ValidationError {
    let message = `${field} is invalid`;
    if (min !== undefined && max !== undefined) {
      message = `${field} must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `${field} must be at least ${min}`;
    } else if (max !== undefined) {
      message = `${field} must be at most ${max}`;
    }
    
    return new ValidationError(
      message,
      field,
      value,
      'range',
      options
    );
  }

  static invalidCurrency(currency: string, options?: { paymentId?: PaymentId }): ValidationError {
    return new ValidationError(
      `Invalid currency: ${currency}`,
      'currency',
      currency,
      'valid_currency',
      options
    );
  }

  static invalidAmount(amount: bigint, options?: { paymentId?: PaymentId }): ValidationError {
    return new ValidationError(
      'Amount must be positive',
      'amount',
      amount,
      'positive',
      options
    );
  }

  static invalidEmail(email: string, options?: { paymentId?: PaymentId }): ValidationError {
    return new ValidationError(
      'Invalid email address',
      'email',
      email,
      'email_format',
      options
    );
  }

  static invalidUuid(id: string, field: string, options?: { paymentId?: PaymentId }): ValidationError {
    return new ValidationError(
      `Invalid ${field} format`,
      field,
      id,
      'uuid_format',
      options
    );
  }
}

// ============================================================================
// API ERRORS
// ============================================================================

export class ApiError extends PaymentError {
  public readonly statusCode?: number;
  public readonly response?: any;

  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      response?: any;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message, code, 'api_error', {
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'ApiError';
    this.statusCode = options?.statusCode;
    this.response = options?.response;
  }

  static rateLimited(options?: { paymentId?: PaymentId; retryAfter?: number }): ApiError {
    const message = options?.retryAfter 
      ? `Rate limited. Retry after ${options.retryAfter} seconds`
      : 'Rate limited';
    return new ApiError(message, 'rate_limited', {
      statusCode: 429,
      paymentId: options?.paymentId,
    });
  }

  static serverError(message: string = 'Internal server error', options?: { paymentId?: PaymentId }): ApiError {
    return new ApiError(message, 'server_error', {
      statusCode: 500,
      paymentId: options?.paymentId,
    });
  }

  static serviceUnavailable(options?: { paymentId?: PaymentId }): ApiError {
    return new ApiError('Service temporarily unavailable', 'service_unavailable', {
      statusCode: 503,
      paymentId: options?.paymentId,
    });
  }

  static timeout(options?: { paymentId?: PaymentId }): ApiError {
    return new ApiError('Request timeout', 'timeout', {
      statusCode: 408,
      paymentId: options?.paymentId,
    });
  }
}

// ============================================================================
// GATEWAY ERRORS
// ============================================================================

export class GatewayError extends PaymentError {
  public readonly provider: string;
  public readonly gatewayCode?: string;
  public readonly gatewayMessage?: string;

  constructor(
    message: string,
    provider: string,
    code: string,
    options?: {
      gatewayCode?: string;
      gatewayMessage?: string;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message, code, 'gateway_error', {
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'GatewayError';
    this.provider = provider;
    this.gatewayCode = options?.gatewayCode;
    this.gatewayMessage = options?.gatewayMessage;
  }

  static notSupported(provider: string, operation: string, options?: { paymentId?: PaymentId }): GatewayError {
    return new GatewayError(
      `${operation} is not supported by ${provider}`,
      provider,
      'not_supported',
      options
    );
  }

  static authenticationFailed(provider: string, options?: { paymentId?: PaymentId }): GatewayError {
    return new GatewayError(
      `Authentication failed with ${provider}`,
      provider,
      'authentication_failed',
      options
    );
  }

  static invalidRequest(provider: string, message: string, options?: { paymentId?: PaymentId }): GatewayError {
    return new GatewayError(
      `Invalid request to ${provider}: ${message}`,
      provider,
      'invalid_request',
      options
    );
  }
}

// ============================================================================
// IDEMPOTENCY ERRORS
// ============================================================================

export class IdempotencyError extends PaymentError {
  public readonly idempotencyKey: string;

  constructor(
    message: string,
    idempotencyKey: string,
    code: string = 'idempotency_error',
    options?: { paymentId?: PaymentId; cause?: Error }
  ) {
    super(message, code, 'idempotency_error', {
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'IdempotencyError';
    this.idempotencyKey = idempotencyKey;
  }

  static keyAlreadyUsed(idempotencyKey: string, options?: { paymentId?: PaymentId }): IdempotencyError {
    return new IdempotencyError(
      `Idempotency key already used: ${idempotencyKey}`,
      idempotencyKey,
      'key_already_used',
      options
    );
  }

  static keyExpired(idempotencyKey: string, options?: { paymentId?: PaymentId }): IdempotencyError {
    return new IdempotencyError(
      `Idempotency key expired: ${idempotencyKey}`,
      idempotencyKey,
      'key_expired',
      options
    );
  }

  static keyInvalid(idempotencyKey: string, options?: { paymentId?: PaymentId }): IdempotencyError {
    return new IdempotencyError(
      `Invalid idempotency key: ${idempotencyKey}`,
      idempotencyKey,
      'key_invalid',
      options
    );
  }
}

// ============================================================================
// CHECKOUT ERRORS
// ============================================================================

export class CheckoutError extends PaymentError {
  public readonly sessionId?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      sessionId?: string;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message, code, 'validation_error', {
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'CheckoutError';
    this.sessionId = options?.sessionId;
  }

  static sessionExpired(sessionId: string, options?: { paymentId?: PaymentId }): CheckoutError {
    return new CheckoutError(
      'Checkout session has expired',
      'session_expired',
      { sessionId, ...options }
    );
  }

  static sessionNotFound(sessionId: string, options?: { paymentId?: PaymentId }): CheckoutError {
    return new CheckoutError(
      'Checkout session not found',
      'session_not_found',
      { sessionId, ...options }
    );
  }

  static alreadyCompleted(sessionId: string, options?: { paymentId?: PaymentId }): CheckoutError {
    return new CheckoutError(
      'Checkout session already completed',
      'already_completed',
      { sessionId, ...options }
    );
  }
}

// ============================================================================
// REFUND ERRORS
// ============================================================================

export class RefundError extends PaymentError {
  public readonly refundId?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      refundId?: string;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message, code, 'validation_error', {
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'RefundError';
    this.refundId = options?.refundId;
  }

  static paymentNotRefundable(paymentId: PaymentId, reason: string = 'Payment is not in a refundable state'): RefundError {
    return new RefundError(
      reason,
      'payment_not_refundable',
      { paymentId }
    );
  }

  static refundAmountExceedsPayment(paymentId: PaymentId, options?: { refundId?: string }): RefundError {
    return new RefundError(
      'Refund amount exceeds payment amount',
      'refund_amount_exceeds_payment',
      { paymentId, ...options }
    );
  }

  static refundTooSmall(amount: bigint, minimum: bigint, options?: { refundId?: string }): RefundError {
    return new RefundError(
      `Refund amount ${amount} is below minimum ${minimum}`,
      'refund_too_small',
      options
    );
  }

  static refundWindowExpired(paymentId: PaymentId, days: number, options?: { refundId?: string }): RefundError {
    return new RefundError(
      `Refund window of ${days} days has expired`,
      'refund_window_expired',
      { paymentId, ...options }
    );
  }
}

// ============================================================================
// WEBHOOK ERRORS
// ============================================================================

export class WebhookError extends PaymentError {
  public readonly eventId?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      eventId?: string;
      paymentId?: PaymentId;
      cause?: Error;
    }
  ) {
    super(message, code, 'validation_error', {
      paymentId: options?.paymentId,
      cause: options?.cause,
    });
    this.name = 'WebhookError';
    this.eventId = options?.eventId;
  }

  static signatureInvalid(options?: { eventId?: string }): WebhookError {
    return new WebhookError(
      'Invalid webhook signature',
      'signature_invalid',
      options
    );
  }

  static signatureMissing(options?: { eventId?: string }): WebhookError {
    return new WebhookError(
      'Missing webhook signature',
      'signature_missing',
      options
    );
  }

  static timestampInvalid(options?: { eventId?: string }): WebhookError {
    return new WebhookError(
      'Invalid webhook timestamp',
      'timestamp_invalid',
      options
    );
  }

  static timestampTooOld(timestamp: Date, tolerance: number, options?: { eventId?: string }): WebhookError {
    return new WebhookError(
      `Webhook timestamp is too old: ${timestamp.toISOString()} (tolerance: ${tolerance}s)`,
      'timestamp_too_old',
      options
    );
  }

  static duplicateEvent(eventId: string, options?: { paymentId?: PaymentId }): WebhookError {
    return new WebhookError(
      `Duplicate webhook event: ${eventId}`,
      'duplicate_event',
      { eventId, paymentId: options?.paymentId }
    );
  }

  static eventNotHandled(eventType: string, options?: { eventId?: string }): WebhookError {
    return new WebhookError(
      `Webhook event type not handled: ${eventType}`,
      'event_not_handled',
      options
    );
  }
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

export class ErrorFactory {
  static fromGatewayError(provider: string, gatewayError: any, paymentId?: PaymentId): PaymentError {
    // Try to map gateway-specific errors to our error types
    const code = gatewayError.code || gatewayError.type || 'unknown';
    const message = gatewayError.message || gatewayError.description || 'Unknown gateway error';

    // Card errors
    if (code.includes('card') || code.includes('card_number') || code.includes('cvc')) {
      return new CardError(message, code, { paymentId });
    }

    // Validation errors
    if (code.includes('invalid') || code.includes('missing') || code.includes('required')) {
      return new ValidationError(message, gatewayError.param || 'unknown', gatewayError.value, 'invalid', { paymentId });
    }

    // API errors
    if (code.includes('rate') || code.includes('server') || code.includes('timeout')) {
      return new ApiError(message, code, { paymentId });
    }

    // Default to gateway error
    return new GatewayError(
      message,
      provider,
      code,
      {
        gatewayCode: gatewayError.code,
        gatewayMessage: gatewayError.message,
        paymentId,
      }
    );
  }

  static isPaymentError(error: any): error is PaymentError {
    return error instanceof PaymentError;
  }

  static isRetryable(error: PaymentError): boolean {
    // Card errors are generally not retryable
    if (error.type === 'card_error') {
      return false;
    }

    // Some validation errors are not retryable
    if (error.type === 'validation_error' && 
        (error.code === 'invalid_currency' || error.code === 'invalid_amount')) {
      return false;
    }

    // API errors like rate limiting or timeouts are retryable
    if (error.type === 'api_error' && 
        (error.code === 'rate_limited' || error.code === 'timeout' || error.code === 'server_error')) {
      return true;
    }

    // Gateway errors might be retryable depending on the code
    if (error.type === 'gateway_error') {
      return ['network_error', 'timeout', 'server_error'].includes(error.code);
    }

    return false;
  }
}
