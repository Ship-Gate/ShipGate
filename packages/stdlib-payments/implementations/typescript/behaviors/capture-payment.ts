// ============================================================================
// CapturePayment Behavior Implementation
// ============================================================================

import {
  Payment,
  PaymentId,
  PaymentStatus,
  IdempotencyKey,
  PaymentErrorCode,
  Result,
  PaymentError,
} from '../types';
import { PaymentRepository } from '../repositories/payment-repository';
import { IdempotencyManager } from '../idempotency';
import { PaymentProviderAdapter } from '../providers';
import { PaymentMetrics } from '../metrics';

// ==========================================================================
// INPUT/OUTPUT TYPES
// ==========================================================================

export interface CapturePaymentInput {
  paymentId: PaymentId;
  idempotencyKey: IdempotencyKey;
  amount?: number;
  finalCapture?: boolean;
  metadata?: Record<string, string>;
}

export type CapturePaymentResult = Result<Payment, PaymentError>;

// ==========================================================================
// BEHAVIOR IMPLEMENTATION
// ==========================================================================

export interface CapturePaymentConfig {
  repository: PaymentRepository;
  idempotency: IdempotencyManager;
  provider: PaymentProviderAdapter;
  metrics: PaymentMetrics;
  authorizationExpiryDays: number;
}

export async function capturePayment(
  input: CapturePaymentInput,
  config: CapturePaymentConfig
): Promise<CapturePaymentResult> {
  try {
    // 1. Find the payment
    const payment = await config.repository.findById(input.paymentId);
    
    if (!payment) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.PROCESSING_ERROR,
          message: 'Payment not found',
          retriable: false,
        },
      };
    }
    
    // 2. Validate payment status
    if (payment.status !== PaymentStatus.AUTHORIZED) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.PROCESSING_ERROR,
          message: `Payment is not in AUTHORIZED status. Current status: ${payment.status}`,
          retriable: false,
          details: { currentStatus: payment.status },
        },
      };
    }
    
    // 3. Check authorization expiry
    if (payment.authorizedAt) {
      const expiryMs = config.authorizationExpiryDays * 24 * 60 * 60 * 1000;
      const authorizedTime = payment.authorizedAt.getTime();
      
      if (Date.now() - authorizedTime > expiryMs) {
        const expiredAt = new Date(authorizedTime + expiryMs);
        return {
          success: false,
          error: {
            code: PaymentErrorCode.PROCESSING_ERROR,
            message: 'Authorization has expired',
            retriable: false,
            details: {
              authorizedAt: payment.authorizedAt.toISOString(),
              expiredAt: expiredAt.toISOString(),
            },
          },
        };
      }
    }
    
    // 4. Validate capture amount
    const captureAmount = input.amount ?? payment.amount;
    
    if (captureAmount <= 0) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.INVALID_AMOUNT,
          message: 'Capture amount must be positive',
          retriable: false,
        },
      };
    }
    
    if (captureAmount > payment.amount) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.INVALID_AMOUNT,
          message: 'Capture amount exceeds authorized amount',
          retriable: false,
          details: {
            authorizedAmount: payment.amount,
            requestedAmount: captureAmount,
          },
        },
      };
    }
    
    // 5. Check idempotency
    const existingRecord = await config.idempotency.get(input.idempotencyKey);
    if (existingRecord) {
      try {
        const cachedPayment = JSON.parse(existingRecord.response) as Payment;
        if (cachedPayment.id === payment.id) {
          return { success: true, data: cachedPayment };
        }
      } catch {
        // Continue with capture
      }
    }
    
    // 6. Acquire lock
    const lockAcquired = await config.idempotency.acquireLock(
      input.idempotencyKey,
      30000
    );
    
    if (!lockAcquired) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.IDEMPOTENCY_CONFLICT,
          message: 'Concurrent capture request',
          retriable: true,
          retryAfter: 1,
        },
      };
    }
    
    try {
      // 7. Call provider to capture
      const providerResult = await config.provider.capturePayment({
        providerPaymentId: payment.providerPaymentId,
        amount: captureAmount,
        idempotencyKey: input.idempotencyKey,
      });
      
      if (!providerResult.success) {
        return {
          success: false,
          error: {
            code: PaymentErrorCode.PROVIDER_UNAVAILABLE,
            message: providerResult.errorMessage ?? 'Capture failed',
            retriable: providerResult.retriable ?? true,
            retryAfter: providerResult.retryAfter,
          },
        };
      }
      
      // 8. Update payment record
      const now = new Date();
      const updatedPayment = await config.repository.update(input.paymentId, {
        status: PaymentStatus.CAPTURED,
        capturedAmount: captureAmount,
        capturedAt: now,
        updatedAt: now,
        metadata: input.metadata
          ? { ...payment.metadata, ...input.metadata }
          : payment.metadata,
      });
      
      if (!updatedPayment) {
        return {
          success: false,
          error: {
            code: PaymentErrorCode.PROCESSING_ERROR,
            message: 'Failed to update payment record',
            retriable: true,
            retryAfter: 5,
          },
        };
      }
      
      // 9. Save idempotency record
      await config.idempotency.set(input.idempotencyKey, {
        requestHash: hashRequest(input),
        paymentId: input.paymentId,
        response: JSON.stringify(updatedPayment),
      });
      
      // 10. Record metrics
      config.metrics.recordCapture(payment.currency, captureAmount);
      
      return { success: true, data: updatedPayment };
      
    } finally {
      await config.idempotency.releaseLock(input.idempotencyKey);
    }
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: PaymentErrorCode.PROCESSING_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retriable: true,
        retryAfter: 30,
      },
    };
  }
}

function hashRequest(input: CapturePaymentInput): string {
  const data = JSON.stringify({
    paymentId: input.paymentId,
    amount: input.amount,
    finalCapture: input.finalCapture ?? true,
  });
  return Buffer.from(data).toString('base64');
}
