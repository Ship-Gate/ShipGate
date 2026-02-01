// ============================================================================
// CreatePayment Behavior Implementation
// ============================================================================

import {
  Payment,
  PaymentId,
  PaymentStatus,
  IdempotencyKey,
  PaymentMethodToken,
  Currency,
  PaymentErrorCode,
  Result,
  PaymentError,
  RiskLevel,
  WebhookProvider,
} from '../types';
import { PaymentRepository } from '../repositories/payment-repository';
import { IdempotencyManager } from '../idempotency';
import { PaymentProviderAdapter } from '../providers';
import { FraudDetector } from '../fraud';
import { PaymentMetrics } from '../metrics';
import { generateUUID } from '../utils';

// ==========================================================================
// INPUT/OUTPUT TYPES
// ==========================================================================

export interface CreatePaymentInput {
  idempotencyKey: IdempotencyKey;
  amount: number;
  currency: Currency;
  paymentMethodToken: PaymentMethodToken;
  customerId?: string;
  customerEmail?: string;
  description?: string;
  metadata?: Record<string, string>;
  capture?: boolean;
  clientIp?: string;
  deviceFingerprint?: string;
}

export type CreatePaymentResult = Result<Payment, PaymentError>;

// ==========================================================================
// BEHAVIOR IMPLEMENTATION
// ==========================================================================

export interface CreatePaymentConfig {
  repository: PaymentRepository;
  idempotency: IdempotencyManager;
  provider: PaymentProviderAdapter;
  fraudDetector: FraudDetector;
  metrics: PaymentMetrics;
  maxAmount: number;
  minAmount: number;
  supportedCurrencies: Currency[];
}

export async function createPayment(
  input: CreatePaymentInput,
  config: CreatePaymentConfig
): Promise<CreatePaymentResult> {
  const startTime = Date.now();
  const capture = input.capture ?? true;
  
  try {
    // 1. Validate input
    const validationError = validateInput(input, config);
    if (validationError) {
      return { success: false, error: validationError };
    }
    
    // 2. Check idempotency
    const idempotencyResult = await checkIdempotency(input, config);
    if (idempotencyResult) {
      return idempotencyResult;
    }
    
    // 3. Acquire idempotency lock
    const lockAcquired = await config.idempotency.acquireLock(
      input.idempotencyKey,
      30000 // 30 second lock
    );
    
    if (!lockAcquired) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.IDEMPOTENCY_CONFLICT,
          message: 'Concurrent request with same idempotency key',
          retriable: true,
          retryAfter: 1,
        },
      };
    }
    
    try {
      // 4. Fraud check
      const fraudResult = await config.fraudDetector.check({
        amount: input.amount,
        currency: input.currency,
        paymentMethodToken: input.paymentMethodToken,
        customerId: input.customerId,
        ipAddress: input.clientIp,
        deviceFingerprint: input.deviceFingerprint,
      });
      
      if (fraudResult.riskLevel === RiskLevel.CRITICAL) {
        config.metrics.recordFraudRejection(input.currency);
        return {
          success: false,
          error: {
            code: PaymentErrorCode.FRAUD_DETECTED,
            message: 'Transaction flagged as potentially fraudulent',
            retriable: false,
            details: {
              riskScore: fraudResult.riskScore,
              riskFactors: fraudResult.checksPerformed,
            },
          },
        };
      }
      
      // 5. Get payment method details
      const paymentMethod = await config.provider.getPaymentMethod(
        input.paymentMethodToken
      );
      
      if (!paymentMethod) {
        return {
          success: false,
          error: {
            code: PaymentErrorCode.INVALID_CARD,
            message: 'Payment method token invalid or expired',
            retriable: false,
          },
        };
      }
      
      // 6. Create payment with provider
      const providerResult = await config.provider.createPayment({
        amount: input.amount,
        currency: input.currency,
        paymentMethodToken: input.paymentMethodToken,
        capture,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      });
      
      // 7. Handle provider response
      const now = new Date();
      const paymentId = generateUUID() as PaymentId;
      
      if (!providerResult.success) {
        // Create failed payment record
        const failedPayment: Payment = {
          id: paymentId,
          idempotencyKey: input.idempotencyKey,
          amount: input.amount,
          currency: input.currency,
          capturedAmount: 0,
          refundedAmount: 0,
          paymentMethod,
          status: PaymentStatus.FAILED,
          failureCode: providerResult.errorCode,
          failureMessage: providerResult.errorMessage,
          provider: config.provider.name as WebhookProvider,
          providerPaymentId: providerResult.providerPaymentId || '',
          customerId: input.customerId,
          customerEmail: input.customerEmail,
          description: input.description,
          metadata: input.metadata,
          pciMetadata: {
            tokenizationMethod: 'provider_token',
            tokenizedAt: now,
            providerReference: input.paymentMethodToken,
            complianceLevel: 1,
          },
          fraudSignals: fraudResult,
          createdAt: now,
          updatedAt: now,
        };
        
        await config.repository.save(failedPayment);
        
        config.metrics.recordPaymentError(
          providerResult.errorCode ?? PaymentErrorCode.PROCESSING_ERROR
        );
        
        return {
          success: false,
          error: {
            code: providerResult.errorCode ?? PaymentErrorCode.PROCESSING_ERROR,
            message: providerResult.errorMessage ?? 'Payment failed',
            retriable: providerResult.retriable ?? false,
            retryAfter: providerResult.retryAfter,
          },
        };
      }
      
      // 8. Create successful payment
      const payment: Payment = {
        id: paymentId,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
        capturedAmount: capture ? input.amount : 0,
        refundedAmount: 0,
        paymentMethod,
        status: capture ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
        provider: config.provider.name as WebhookProvider,
        providerPaymentId: providerResult.providerPaymentId,
        customerId: input.customerId,
        customerEmail: input.customerEmail,
        description: input.description,
        metadata: input.metadata,
        pciMetadata: {
          tokenizationMethod: 'provider_token',
          tokenizedAt: now,
          providerReference: input.paymentMethodToken,
          complianceLevel: 1,
        },
        fraudSignals: fraudResult,
        createdAt: now,
        updatedAt: now,
        authorizedAt: now,
        capturedAt: capture ? now : undefined,
      };
      
      // 9. Save payment
      await config.repository.save(payment);
      
      // 10. Save idempotency record
      await config.idempotency.set(input.idempotencyKey, {
        requestHash: hashRequest(input),
        paymentId,
        response: JSON.stringify(payment),
      });
      
      // 11. Record metrics
      config.metrics.recordPaymentCreated(payment.status, payment.currency);
      config.metrics.recordPaymentLatency(Date.now() - startTime);
      
      return { success: true, data: payment };
      
    } finally {
      await config.idempotency.releaseLock(input.idempotencyKey);
    }
    
  } catch (error) {
    config.metrics.recordPaymentError(PaymentErrorCode.PROCESSING_ERROR);
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

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

function validateInput(
  input: CreatePaymentInput,
  config: CreatePaymentConfig
): PaymentError | null {
  if (input.amount < config.minAmount) {
    return {
      code: PaymentErrorCode.INVALID_AMOUNT,
      message: `Amount must be at least ${config.minAmount}`,
      retriable: false,
    };
  }
  
  if (input.amount > config.maxAmount) {
    return {
      code: PaymentErrorCode.INVALID_AMOUNT,
      message: `Amount must not exceed ${config.maxAmount}`,
      retriable: false,
      details: { maxAmount: config.maxAmount },
    };
  }
  
  if (!config.supportedCurrencies.includes(input.currency)) {
    return {
      code: PaymentErrorCode.CURRENCY_NOT_SUPPORTED,
      message: `Currency ${input.currency} is not supported`,
      retriable: false,
    };
  }
  
  if (!input.paymentMethodToken.startsWith('pm_')) {
    return {
      code: PaymentErrorCode.INVALID_CARD,
      message: 'Invalid payment method token format',
      retriable: false,
    };
  }
  
  if (!input.idempotencyKey || input.idempotencyKey.length < 1) {
    return {
      code: PaymentErrorCode.PROCESSING_ERROR,
      message: 'Idempotency key is required',
      retriable: false,
    };
  }
  
  return null;
}

async function checkIdempotency(
  input: CreatePaymentInput,
  config: CreatePaymentConfig
): Promise<CreatePaymentResult | null> {
  const existing = await config.idempotency.get(input.idempotencyKey);
  
  if (!existing) {
    return null;
  }
  
  const requestHash = hashRequest(input);
  
  if (existing.requestHash !== requestHash) {
    return {
      success: false,
      error: {
        code: PaymentErrorCode.DUPLICATE_REQUEST,
        message: 'Idempotency key already used with different parameters',
        retriable: false,
        details: { existingPaymentId: existing.paymentId },
      },
    };
  }
  
  // Return cached response
  try {
    const cachedPayment = JSON.parse(existing.response) as Payment;
    return { success: true, data: cachedPayment };
  } catch {
    return null;
  }
}

function hashRequest(input: CreatePaymentInput): string {
  const data = JSON.stringify({
    amount: input.amount,
    currency: input.currency,
    paymentMethodToken: input.paymentMethodToken,
    capture: input.capture ?? true,
  });
  return Buffer.from(data).toString('base64');
}
