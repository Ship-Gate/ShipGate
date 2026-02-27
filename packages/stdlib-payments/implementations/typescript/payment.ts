// ============================================================================
// Payment Implementation - Core Payment Logic
// ============================================================================

import {
  Payment,
  PaymentId,
  PaymentStatus,
  PaymentMethod,
  PaymentErrorCode,
  Currency,
  IdempotencyKey,
  PaymentMethodToken,
  PCIMetadata,
  FraudSignals,
  RiskLevel,
  WebhookProvider,
  Result,
  PaymentError,
} from './types';
import { generateUUID } from './utils';
import { PaymentRepository } from './repositories/payment-repository';
import { IdempotencyManager } from './idempotency';
import { PaymentProviderAdapter } from './providers';
import { FraudDetector } from './fraud';
import { PaymentMetrics } from './metrics';

// ==========================================================================
// PAYMENT SERVICE
// ==========================================================================

export interface PaymentServiceConfig {
  provider: PaymentProviderAdapter;
  repository: PaymentRepository;
  idempotency: IdempotencyManager;
  fraudDetector: FraudDetector;
  metrics: PaymentMetrics;
  
  // Configuration
  maxAmount: number;
  minAmount: number;
  supportedCurrencies: Currency[];
  authorizationExpiryDays: number;
  refundWindowDays: number;
}

export class PaymentService {
  private readonly config: PaymentServiceConfig;
  
  constructor(config: PaymentServiceConfig) {
    this.config = config;
  }
  
  // ========================================================================
  // CREATE PAYMENT
  // ========================================================================
  
  async createPayment(input: CreatePaymentInput): Promise<Result<Payment, PaymentError>> {
    const startTime = Date.now();
    
    try {
      // 1. Validate input
      const validationError = this.validateCreateInput(input);
      if (validationError) {
        return { success: false, error: validationError };
      }
      
      // 2. Check idempotency
      const existingRecord = await this.config.idempotency.get(input.idempotencyKey);
      if (existingRecord) {
        const requestHash = this.hashRequest(input);
        if (existingRecord.requestHash !== requestHash) {
          return {
            success: false,
            error: {
              code: PaymentErrorCode.DUPLICATE_REQUEST,
              message: 'Idempotency key already used with different parameters',
              retriable: false,
              details: { existingPaymentId: existingRecord.paymentId },
            },
          };
        }
        // Return cached response
        const existingPayment = await this.config.repository.findById(
          existingRecord.paymentId as PaymentId
        );
        if (existingPayment) {
          return { success: true, data: existingPayment };
        }
      }
      
      // 3. Fraud check
      const fraudResult = await this.config.fraudDetector.check({
        amount: input.amount,
        currency: input.currency,
        paymentMethodToken: input.paymentMethodToken,
        customerId: input.customerId,
        ipAddress: input.clientIp,
        deviceFingerprint: input.deviceFingerprint,
      });
      
      if (fraudResult.riskLevel === RiskLevel.CRITICAL) {
        this.config.metrics.recordFraudRejection(input.currency);
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
      
      // 4. Tokenize/validate payment method
      const paymentMethod = await this.config.provider.getPaymentMethod(
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
      
      // 5. Create payment record
      const paymentId = generateUUID() as PaymentId;
      const now = new Date();
      
      const payment: Payment = {
        id: paymentId,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
        capturedAmount: 0,
        refundedAmount: 0,
        paymentMethod,
        status: PaymentStatus.PENDING,
        provider: this.config.provider.name as WebhookProvider,
        providerPaymentId: '',
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
      
      // 6. Call payment provider
      const providerResult = await this.config.provider.createPayment({
        amount: input.amount,
        currency: input.currency,
        paymentMethodToken: input.paymentMethodToken,
        capture: input.capture,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
      });
      
      if (!providerResult.success) {
        payment.status = PaymentStatus.FAILED;
        payment.failureCode = providerResult.errorCode;
        payment.failureMessage = providerResult.errorMessage;
        
        await this.config.repository.save(payment);
        
        return {
          success: false,
          error: {
            code: providerResult.errorCode,
            message: providerResult.errorMessage,
            retriable: providerResult.retriable,
            retryAfter: providerResult.retryAfter,
          },
        };
      }
      
      // 7. Update payment with provider response
      payment.providerPaymentId = providerResult.providerPaymentId;
      payment.status = input.capture ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED;
      payment.capturedAmount = input.capture ? input.amount : 0;
      payment.authorizedAt = now;
      if (input.capture) {
        payment.capturedAt = now;
      }
      
      // 8. Persist payment
      await this.config.repository.save(payment);
      
      // 9. Save idempotency record
      await this.config.idempotency.set(input.idempotencyKey, {
        requestHash: this.hashRequest(input),
        paymentId,
        response: JSON.stringify(payment),
      });
      
      // 10. Record metrics
      this.config.metrics.recordPaymentCreated(payment.status, payment.currency);
      this.config.metrics.recordPaymentLatency(Date.now() - startTime);
      
      return { success: true, data: payment };
      
    } catch (error) {
      this.config.metrics.recordPaymentError(PaymentErrorCode.PROCESSING_ERROR);
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
  
  // ========================================================================
  // CAPTURE PAYMENT
  // ========================================================================
  
  async capturePayment(input: CapturePaymentInput): Promise<Result<Payment, PaymentError>> {
    const payment = await this.config.repository.findById(input.paymentId);
    
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
    
    // Check authorization expiry
    const authExpiryMs = this.config.authorizationExpiryDays * 24 * 60 * 60 * 1000;
    if (payment.authorizedAt && Date.now() - payment.authorizedAt.getTime() > authExpiryMs) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.PROCESSING_ERROR,
          message: 'Authorization has expired',
          retriable: false,
          details: {
            authorizedAt: payment.authorizedAt,
            expiredAt: new Date(payment.authorizedAt.getTime() + authExpiryMs),
          },
        },
      };
    }
    
    const captureAmount = input.amount ?? payment.amount;
    
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
    
    // Call provider
    const providerResult = await this.config.provider.capturePayment({
      providerPaymentId: payment.providerPaymentId,
      amount: captureAmount,
      idempotencyKey: input.idempotencyKey,
    });
    
    if (!providerResult.success) {
      return {
        success: false,
        error: {
          code: PaymentErrorCode.PROVIDER_UNAVAILABLE,
          message: providerResult.errorMessage,
          retriable: providerResult.retriable,
          retryAfter: providerResult.retryAfter,
        },
      };
    }
    
    // Update payment
    payment.status = PaymentStatus.CAPTURED;
    payment.capturedAmount = captureAmount;
    payment.capturedAt = new Date();
    payment.updatedAt = new Date();
    
    await this.config.repository.save(payment);
    
    this.config.metrics.recordCapture(payment.currency, captureAmount);
    
    return { success: true, data: payment };
  }
  
  // ========================================================================
  // HELPERS
  // ========================================================================
  
  private validateCreateInput(input: CreatePaymentInput): PaymentError | null {
    if (input.amount < this.config.minAmount) {
      return {
        code: PaymentErrorCode.INVALID_AMOUNT,
        message: `Amount must be at least ${this.config.minAmount}`,
        retriable: false,
      };
    }
    
    if (input.amount > this.config.maxAmount) {
      return {
        code: PaymentErrorCode.INVALID_AMOUNT,
        message: `Amount must not exceed ${this.config.maxAmount}`,
        retriable: false,
        details: { maxAmount: this.config.maxAmount },
      };
    }
    
    if (!this.config.supportedCurrencies.includes(input.currency)) {
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
    
    return null;
  }
  
  private hashRequest(input: CreatePaymentInput): string {
    const data = JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      paymentMethodToken: input.paymentMethodToken,
      capture: input.capture,
    });
    // Use a proper hash function in production
    return Buffer.from(data).toString('base64');
  }
}

// ==========================================================================
// INPUT TYPES
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
  capture: boolean;
  clientIp?: string;
  deviceFingerprint?: string;
}

export interface CapturePaymentInput {
  paymentId: PaymentId;
  idempotencyKey: IdempotencyKey;
  amount?: number;
  finalCapture?: boolean;
  metadata?: Record<string, string>;
}
