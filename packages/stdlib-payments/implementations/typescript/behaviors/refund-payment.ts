// ============================================================================
// RefundPayment Behavior Implementation
// ============================================================================

import {
  Payment,
  PaymentId,
  PaymentStatus,
  Refund,
  RefundId,
  RefundStatus,
  IdempotencyKey,
  RefundErrorCode,
  Result,
  RefundError,
} from '../types';
import { PaymentRepository } from '../repositories/payment-repository';
import { RefundRepository } from '../repositories/refund-repository';
import { IdempotencyManager } from '../idempotency';
import { PaymentProviderAdapter } from '../providers';
import { PaymentMetrics } from '../metrics';
import { generateUUID } from '../utils';

// ==========================================================================
// INPUT/OUTPUT TYPES
// ==========================================================================

export interface RefundPaymentInput {
  paymentId: PaymentId;
  idempotencyKey: IdempotencyKey;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
  supportTicketId?: string;
}

export type RefundPaymentResult = Result<Refund, RefundError>;

// ==========================================================================
// BEHAVIOR IMPLEMENTATION
// ==========================================================================

export interface RefundPaymentConfig {
  paymentRepository: PaymentRepository;
  refundRepository: RefundRepository;
  idempotency: IdempotencyManager;
  provider: PaymentProviderAdapter;
  metrics: PaymentMetrics;
  refundWindowDays: number;
}

export async function refundPayment(
  input: RefundPaymentInput,
  config: RefundPaymentConfig
): Promise<RefundPaymentResult> {
  try {
    // 1. Find the payment
    const payment = await config.paymentRepository.findById(input.paymentId);
    
    if (!payment) {
      return {
        success: false,
        error: {
          code: RefundErrorCode.PAYMENT_NOT_FOUND,
          message: 'Payment not found',
          retriable: false,
        },
      };
    }
    
    // 2. Validate payment status
    const refundableStatuses = [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED];
    
    if (!refundableStatuses.includes(payment.status)) {
      return {
        success: false,
        error: {
          code: RefundErrorCode.PAYMENT_NOT_CAPTURED,
          message: `Payment is not in a refundable status. Current: ${payment.status}`,
          retriable: false,
          details: {
            currentStatus: payment.status,
            refundableStatuses,
          },
        },
      };
    }
    
    // 3. Check refund window
    if (payment.capturedAt) {
      const windowMs = config.refundWindowDays * 24 * 60 * 60 * 1000;
      const capturedTime = payment.capturedAt.getTime();
      
      if (Date.now() - capturedTime > windowMs) {
        const deadline = new Date(capturedTime + windowMs);
        return {
          success: false,
          error: {
            code: RefundErrorCode.REFUND_WINDOW_EXPIRED,
            message: `Refund window has expired (${config.refundWindowDays} days)`,
            retriable: false,
            details: {
              capturedAt: payment.capturedAt.toISOString(),
              refundDeadline: deadline.toISOString(),
            },
          },
        };
      }
    }
    
    // 4. Calculate refund amount
    const availableForRefund = payment.capturedAmount - payment.refundedAmount;
    const refundAmount = input.amount ?? availableForRefund;
    
    if (refundAmount <= 0) {
      return {
        success: false,
        error: {
          code: RefundErrorCode.AMOUNT_EXCEEDS_AVAILABLE,
          message: 'No amount available for refund',
          retriable: false,
          details: {
            availableForRefund: 0,
            alreadyRefunded: payment.refundedAmount,
            requested: refundAmount,
          },
        },
      };
    }
    
    if (refundAmount > availableForRefund) {
      return {
        success: false,
        error: {
          code: RefundErrorCode.AMOUNT_EXCEEDS_AVAILABLE,
          message: `Refund amount ${refundAmount} exceeds available ${availableForRefund}`,
          retriable: false,
          details: {
            availableForRefund,
            alreadyRefunded: payment.refundedAmount,
            requested: refundAmount,
          },
        },
      };
    }
    
    // 5. Check for pending refunds
    const existingRefunds = await config.refundRepository.findByPaymentId(input.paymentId);
    const pendingRefund = existingRefunds.find(
      r => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING
    );
    
    if (pendingRefund) {
      return {
        success: false,
        error: {
          code: RefundErrorCode.REFUND_ALREADY_PENDING,
          message: 'Another refund is currently being processed',
          retriable: true,
          retryAfter: 5,
        },
      };
    }
    
    // 6. Check idempotency
    const existingRecord = await config.idempotency.get(input.idempotencyKey);
    if (existingRecord) {
      try {
        const cachedRefund = JSON.parse(existingRecord.response) as Refund;
        return { success: true, data: cachedRefund };
      } catch {
        // Continue with refund
      }
    }
    
    // 7. Acquire lock
    const lockAcquired = await config.idempotency.acquireLock(
      input.idempotencyKey,
      60000 // 60 second lock for refunds
    );
    
    if (!lockAcquired) {
      return {
        success: false,
        error: {
          code: RefundErrorCode.REFUND_ALREADY_PENDING,
          message: 'Concurrent refund request',
          retriable: true,
          retryAfter: 1,
        },
      };
    }
    
    try {
      // 8. Create refund record
      const now = new Date();
      const refundId = generateUUID() as RefundId;
      
      const refund: Refund = {
        id: refundId,
        paymentId: input.paymentId,
        idempotencyKey: input.idempotencyKey,
        amount: refundAmount,
        currency: payment.currency,
        reason: input.reason,
        status: RefundStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      };
      
      await config.refundRepository.save(refund);
      
      // 9. Call provider to refund
      const providerResult = await config.provider.refundPayment({
        providerPaymentId: payment.providerPaymentId,
        amount: refundAmount,
        idempotencyKey: input.idempotencyKey,
        reason: input.reason,
      });
      
      // 10. Update refund status based on provider response
      if (!providerResult.success) {
        const failedRefund = await config.refundRepository.update(refundId, {
          status: RefundStatus.FAILED,
          failureCode: RefundErrorCode.PROVIDER_ERROR,
          failureMessage: providerResult.errorMessage,
          completedAt: new Date(),
        });
        
        return {
          success: false,
          error: {
            code: RefundErrorCode.PROVIDER_ERROR,
            message: providerResult.errorMessage ?? 'Refund failed at provider',
            retriable: providerResult.retriable ?? true,
            retryAfter: providerResult.retryAfter,
          },
        };
      }
      
      // 11. Update refund with provider info
      const succeededRefund = await config.refundRepository.update(refundId, {
        status: RefundStatus.SUCCEEDED,
        providerRefundId: providerResult.providerRefundId,
        completedAt: new Date(),
      });
      
      // 12. Update payment record
      const newRefundedAmount = payment.refundedAmount + refundAmount;
      const newStatus = newRefundedAmount >= payment.capturedAmount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
      
      await config.paymentRepository.update(input.paymentId, {
        status: newStatus,
        refundedAmount: newRefundedAmount,
        updatedAt: new Date(),
      });
      
      // 13. Save idempotency record
      await config.idempotency.set(input.idempotencyKey, {
        requestHash: hashRequest(input),
        response: JSON.stringify(succeededRefund),
      });
      
      // 14. Record metrics
      config.metrics.recordRefund(payment.currency, refundAmount);
      
      return { success: true, data: succeededRefund! };
      
    } finally {
      await config.idempotency.releaseLock(input.idempotencyKey);
    }
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: RefundErrorCode.PROVIDER_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        retriable: true,
        retryAfter: 30,
      },
    };
  }
}

function hashRequest(input: RefundPaymentInput): string {
  const data = JSON.stringify({
    paymentId: input.paymentId,
    amount: input.amount,
    reason: input.reason,
  });
  return Buffer.from(data).toString('base64');
}
