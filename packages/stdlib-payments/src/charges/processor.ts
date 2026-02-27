/**
 * Charges processor implementation
 * @packageDocumentation
 */

import { 
  PaymentId, 
  PaymentMethodId, 
  CustomerId, 
  Currency,
  Payment,
  PaymentStatus
} from '../types';
import { GatewayAdapter } from '../types';
import { 
  ChargeRequest,
  ChargeResponse,
  CaptureRequest,
  CaptureResponse,
  VoidRequest,
  VoidResponse,
  UpdateChargeRequest,
  UpdateChargeResponse,
  ListChargesRequest,
  ListChargesResponse,
  Charge,
  ChargeStatus
} from './types';
import { 
  PaymentError, 
  ValidationError, 
  CardError,
  RefundError
} from '../errors';
import { IdempotencyManager } from '../idempotency';

// ============================================================================
// CHARGES PROCESSOR
// ============================================================================

export class ChargesProcessor {
  private gateway: GatewayAdapter;
  private idempotency: IdempotencyManager;

  constructor(gateway: GatewayAdapter, idempotency: IdempotencyManager) {
    this.gateway = gateway;
    this.idempotency = idempotency;
  }

  // ============================================================================
  // CREATE CHARGE
  // ============================================================================

  /**
   * Create a new charge
   */
  async createCharge(request: ChargeRequest): Promise<ChargeResponse> {
    // Validate request
    this.validateChargeRequest(request);

    // Check idempotency
    if (request.idempotencyKey) {
      const existing = await this.idempotency.check(request.idempotencyKey);
      if (existing) {
        return JSON.parse(existing.response);
      }
    }

    try {
      // Create charge through gateway
      const gatewayResponse = await this.gateway.createCharge({
        amount: request.amount,
        currency: request.currency,
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        description: request.description,
        capture: request.capture,
        metadata: {
          ...request.metadata,
          statement_descriptor: request.statementDescriptor,
          receipt_email: request.receiptEmail,
          off_session: request.offSession,
          setup_future_usage: request.setupFutureUsage,
        },
      });

      if (!gatewayResponse.success || !gatewayResponse.data) {
        throw PaymentError.fromGatewayError(
          this.gateway.config.provider,
          gatewayResponse.error
        );
      }

      // Convert to our Charge format
      const charge = this.mapToCharge(gatewayResponse.data.payment, request);

      const response: ChargeResponse = {
        charge,
        requiresAction: gatewayResponse.data.requiresAction,
        nextAction: gatewayResponse.data.nextAction,
      };

      // Store idempotency record
      if (request.idempotencyKey) {
        await this.idempotency.store(request.idempotencyKey, {
          request: JSON.stringify(request),
          response: JSON.stringify(response),
        });
      }

      return response;

    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError(
        'Failed to create charge',
        'charge_creation_failed',
        'gateway_error',
        { cause: error as Error }
      );
    }
  }

  // ============================================================================
  // CAPTURE CHARGE
  // ============================================================================

  /**
   * Capture a previously authorized charge
   */
  async captureCharge(request: CaptureRequest): Promise<CaptureResponse> {
    // Validate request
    this.validateCaptureRequest(request);

    try {
      // Retrieve payment to check status
      const paymentResponse = await this.gateway.retrievePayment(request.chargeId);
      if (!paymentResponse.success || !paymentResponse.data) {
        throw new PaymentError(
          'Payment not found',
          'payment_not_found',
          'validation_error'
        );
      }

      const payment = paymentResponse.data;
      
      if (payment.status !== PaymentStatus.AUTHORIZED) {
        throw new PaymentError(
          'Payment is not in authorized state',
          'invalid_payment_status',
          'validation_error'
        );
      }

      // Capture through gateway
      const captureResponse = await this.gateway.captureCharge(
        request.chargeId,
        request.amount
      );

      if (!captureResponse.success || !captureResponse.data) {
        throw PaymentError.fromGatewayError(
          this.gateway.config.provider,
          captureResponse.error
        );
      }

      // Convert to our Capture format
      const capture: any = {
        id: `cap_${captureResponse.data.id}`,
        amount: request.amount || captureResponse.data.amount,
        currency: captureResponse.data.currency,
        charge: request.chargeId,
        paymentMethodId: captureResponse.data.paymentMethodId,
        status: 'succeeded',
        metadata: request.metadata,
        createdAt: new Date(),
      };

      return { capture };

    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError(
        'Failed to capture charge',
        'capture_failed',
        'gateway_error',
        { cause: error as Error }
      );
    }
  }

  // ============================================================================
  // VOID CHARGE
  // ============================================================================

  /**
   * Void (cancel) a charge
   */
  async voidCharge(request: VoidRequest): Promise<VoidResponse> {
    // Validate request
    this.validateVoidRequest(request);

    try {
      // Retrieve payment to check status
      const paymentResponse = await this.gateway.retrievePayment(request.chargeId);
      if (!paymentResponse.success || !paymentResponse.data) {
        throw new PaymentError(
          'Payment not found',
          'payment_not_found',
          'validation_error'
        );
      }

      const payment = paymentResponse.data;
      
      if (payment.status !== PaymentStatus.AUTHORIZED) {
        throw new PaymentError(
          'Payment is not in authorized state',
          'invalid_payment_status',
          'validation_error'
        );
      }

      // Void through gateway
      const voidResponse = await this.gateway.voidCharge(request.chargeId);

      if (!voidResponse.success || !voidResponse.data) {
        throw PaymentError.fromGatewayError(
          this.gateway.config.provider,
          voidResponse.error
        );
      }

      // Convert to our Void format
      const voidData: any = {
        id: `void_${voidResponse.data.id}`,
        charge: request.chargeId,
        amount: voidResponse.data.amount,
        currency: voidResponse.data.currency,
        status: 'succeeded',
        reason: request.reason,
        metadata: request.metadata,
        createdAt: new Date(),
      };

      return { void: voidData };

    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError(
        'Failed to void charge',
        'void_failed',
        'gateway_error',
        { cause: error as Error }
      );
    }
  }

  // ============================================================================
  // UPDATE CHARGE
  // ============================================================================

  /**
   * Update charge details
   */
  async updateCharge(request: UpdateChargeRequest): Promise<UpdateChargeResponse> {
    // Validate request
    this.validateUpdateRequest(request);

    try {
      // Retrieve payment
      const paymentResponse = await this.gateway.retrievePayment(request.chargeId);
      if (!paymentResponse.success || !paymentResponse.data) {
        throw new PaymentError(
          'Payment not found',
          'payment_not_found',
          'validation_error'
        );
      }

      const payment = paymentResponse.data;

      // Update payment metadata and description
      const updatedPayment: Payment = {
        ...payment,
        description: request.description || payment.description,
        metadata: { ...payment.metadata, ...request.metadata },
      };

      // Convert to Charge format
      const charge = this.mapToCharge(updatedPayment);

      return { charge };

    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError(
        'Failed to update charge',
        'update_failed',
        'gateway_error',
        { cause: error as Error }
      );
    }
  }

  // ============================================================================
  // RETRIEVE CHARGE
  // ============================================================================

  /**
   * Retrieve a charge
   */
  async retrieveCharge(chargeId: PaymentId): Promise<Charge> {
    try {
      const response = await this.gateway.retrievePayment(chargeId);
      
      if (!response.success || !response.data) {
        throw new PaymentError(
          'Charge not found',
          'charge_not_found',
          'validation_error'
        );
      }

      return this.mapToCharge(response.data);

    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      throw new PaymentError(
        'Failed to retrieve charge',
        'retrieve_failed',
        'gateway_error',
        { cause: error as Error }
      );
    }
  }

  // ============================================================================
  // LIST CHARGES
  // ============================================================================

  /**
   * List charges with filters
   */
  async listCharges(request: ListChargesRequest): Promise<ListChargesResponse> {
    // This would typically call the gateway's list method
    // For now, return empty response
    return {
      charges: [],
      hasMore: false,
      totalCount: 0,
    };
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  private validateChargeRequest(request: ChargeRequest): void {
    if (!request.amount || request.amount <= 0) {
      throw ValidationError.invalidAmount(request.amount);
    }

    if (!request.currency) {
      throw ValidationError.required('currency');
    }

    if (!request.paymentMethodId) {
      throw ValidationError.required('paymentMethodId');
    }

    if (request.capture !== false && request.capture !== true) {
      request.capture = true; // Default to true
    }

    // Validate minimum amounts (in cents)
    const minAmounts: Record<string, bigint> = {
      USD: 50n, // $0.50
      EUR: 50n, // €0.50
      GBP: 30n, // £0.30
      JPY: 50n, // ¥50
    };

    const minAmount = minAmounts[request.currency] || 50n;
    if (request.amount < minAmount) {
      throw new ValidationError(
        `Amount below minimum for ${request.currency}`,
        'amount',
        request.amount,
        'minimum_amount'
      );
    }
  }

  private validateCaptureRequest(request: CaptureRequest): void {
    if (!request.chargeId) {
      throw ValidationError.required('chargeId');
    }

    if (request.amount && request.amount <= 0) {
      throw ValidationError.invalidAmount(request.amount);
    }
  }

  private validateVoidRequest(request: VoidRequest): void {
    if (!request.chargeId) {
      throw ValidationError.required('chargeId');
    }
  }

  private validateUpdateRequest(request: UpdateChargeRequest): void {
    if (!request.chargeId) {
      throw ValidationError.required('chargeId');
    }
  }

  // ============================================================================
  // MAPPING METHODS
  // ============================================================================

  private mapToCharge(payment: Payment, request?: ChargeRequest): Charge {
    const charge: Charge = {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: this.mapPaymentStatusToChargeStatus(payment.status),
      paymentMethodId: payment.paymentMethodId,
      customerId: payment.customerId,
      description: payment.description,
      statementDescriptor: request?.statementDescriptor,
      receiptEmail: request?.receiptEmail,
      paid: payment.status === PaymentStatus.COMPLETED || payment.status === PaymentStatus.CAPTURED,
      captured: payment.status === PaymentStatus.CAPTURED,
      capturedAmount: payment.capturedAmount,
      authorizedAmount: payment.status === PaymentStatus.AUTHORIZED ? payment.amount : undefined,
      refundedAmount: payment.refundAmount,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updated: payment.updatedAt || payment.createdAt,
    };

    // Add failure information
    if (payment.failureReason) {
      charge.failureCode = 'generic_decline';
      charge.failureMessage = payment.failureReason;
    }

    return charge;
  }

  private mapPaymentStatusToChargeStatus(status: PaymentStatus): ChargeStatus {
    const statusMap: Record<PaymentStatus, ChargeStatus> = {
      [PaymentStatus.PENDING]: 'pending',
      [PaymentStatus.PROCESSING]: 'pending',
      [PaymentStatus.AUTHORIZED]: 'requires_capture',
      [PaymentStatus.CAPTURED]: 'succeeded',
      [PaymentStatus.COMPLETED]: 'succeeded',
      [PaymentStatus.FAILED]: 'failed',
      [PaymentStatus.CANCELLED]: 'canceled',
      [PaymentStatus.REFUNDED]: 'refunded',
      [PaymentStatus.PARTIALLY_REFUNDED]: 'partially_refunded',
      [PaymentStatus.DISPUTED]: 'succeeded',
      [PaymentStatus.REQUIRES_ACTION]: 'requires_action',
    };

    return statusMap[status] || 'pending';
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if a charge can be captured
   */
  canCapture(charge: Charge): boolean {
    return charge.status === 'requires_capture' && !charge.captured;
  }

  /**
   * Check if a charge can be voided
   */
  canVoid(charge: Charge): boolean {
    return charge.status === 'requires_capture' && !charge.captured;
  }

  /**
   * Check if a charge can be refunded
   */
  canRefund(charge: Charge): boolean {
    return charge.paid && !charge.refundedAmount || 
           (charge.refundedAmount && charge.refundedAmount < charge.amount);
  }

  /**
   * Get refundable amount
   */
  getRefundableAmount(charge: Charge): bigint {
    if (!charge.paid) return 0n;
    
    const captured = charge.capturedAmount || charge.amount;
    const refunded = charge.refundedAmount || 0n;
    
    return captured - refunded;
  }
}
