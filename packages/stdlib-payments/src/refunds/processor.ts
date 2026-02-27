/**
 * Refunds processor implementation
 * @packageDocumentation
 */

import { 
  PaymentId, 
  Currency,
  Payment,
  PaymentStatus
} from '../types';
import { GatewayAdapter } from '../types';
import { 
  RefundRequest,
  RefundResponse,
  ListRefundsRequest,
  ListRefundsResponse,
  Refund,
  RefundStatus,
  RefundCalculation,
  RefundEstimate,
  RefundEligibility
} from './types';
import { 
  PaymentError, 
  ValidationError, 
  RefundError
} from '../errors';
import { IdempotencyManager } from '../idempotency';

// ============================================================================
// REFUNDS PROCESSOR
// ============================================================================

export class RefundsProcessor {
  private gateway: GatewayAdapter;
  private idempotency: IdempotencyManager;

  constructor(gateway: GatewayAdapter, idempotency: IdempotencyManager) {
    this.gateway = gateway;
    this.idempotency = idempotency;
  }

  // ============================================================================
  // CREATE REFUND
  // ============================================================================

  /**
   * Create a new refund
   */
  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    // Validate request
    await this.validateRefundRequest(request);

    // Check idempotency
    if (request.idempotencyKey) {
      const existing = await this.idempotency.check(request.idempotencyKey);
      if (existing) {
        return JSON.parse(existing.response);
      }
    }

    try {
      // Create refund through gateway
      const gatewayResponse = await this.gateway.createRefund({
        paymentId: request.paymentId,
        amount: request.amount,
        reason: request.reason,
        metadata: request.metadata,
      });

      if (!gatewayResponse.success || !gatewayResponse.data) {
        throw PaymentError.fromGatewayError(
          this.gateway.config.provider,
          gatewayResponse.error
        );
      }

      // Convert to our Refund format
      const refund = this.mapToRefund(gatewayResponse.data);

      const response: RefundResponse = {
        refund,
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
        'Failed to create refund',
        'refund_creation_failed',
        'gateway_error',
        { cause: error as Error }
      );
    }
  }

  // ============================================================================
  // REFUND CALCULATION
  // ============================================================================

  /**
   * Calculate refund details
   */
  async calculateRefund(paymentId: PaymentId, amount?: bigint): Promise<RefundCalculation> {
    // Retrieve payment
    const paymentResponse = await this.gateway.retrievePayment(paymentId);
    if (!paymentResponse.success || !paymentResponse.data) {
      throw new RefundError(
        'Payment not found',
        'payment_not_found',
        { paymentId }
      );
    }

    const payment = paymentResponse.data;

    // Check if payment is refundable
    if (payment.status !== PaymentStatus.CAPTURED && payment.status !== PaymentStatus.COMPLETED) {
      throw new RefundError(
        'Payment is not in a refundable state',
        'payment_not_refundable',
        { paymentId }
      );
    }

    const capturedAmount = payment.capturedAmount || payment.amount;
    const alreadyRefunded = payment.refundAmount || 0n;
    const maxRefundable = capturedAmount - alreadyRefunded;

    // Determine refund amount
    const refundAmount = amount || maxRefundable;

    if (refundAmount > maxRefundable) {
      throw new RefundError(
        'Refund amount exceeds refundable amount',
        'refund_amount_exceeds_payment',
        { paymentId }
      );
    }

    // Calculate fees (mock implementation)
    const refundFee = this.calculateRefundFee(refundAmount, payment.currency);
    const processingFee = 0n; // Usually non-refundable
    const totalFees = refundFee + processingFee;
    const netAmount = refundAmount - totalFees;

    return {
      maxRefundable,
      alreadyRefunded,
      availableToRefund: maxRefundable,
      fees: {
        refundFee,
        processingFee,
        total: totalFees,
      },
      netAmount,
    };
  }

  /**
   * Get refund estimate
   */
  async getRefundEstimate(paymentId: PaymentId, amount?: bigint): Promise<RefundEstimate> {
    const calculation = await this.calculateRefund(paymentId, amount);
    
    // Retrieve payment for currency
    const paymentResponse = await this.gateway.retrievePayment(paymentId);
    if (!paymentResponse.success || !paymentResponse.data) {
      throw new RefundError(
        'Payment not found',
        'payment_not_found',
        { paymentId }
      );
    }

    // Estimate arrival (usually 5-10 business days)
    const estimatedArrival = new Date();
    estimatedArrival.setDate(estimatedArrival.getDate() + 7);

    return {
      amount: amount || calculation.maxRefundable,
      fees: calculation.fees.total,
      netAmount: calculation.netAmount,
      currency: paymentResponse.data.currency,
      estimatedArrival,
      method: 'original',
    };
  }

  // ============================================================================
  // REFUND ELIGIBILITY
  // ============================================================================

  /**
   * Check refund eligibility
   */
  async checkEligibility(paymentId: PaymentId): Promise<RefundEligibility> {
    // Retrieve payment
    const paymentResponse = await this.gateway.retrievePayment(paymentId);
    if (!paymentResponse.success || !paymentResponse.data) {
      return {
        eligible: false,
        reason: 'Payment not found',
        maxAmount: 0n,
        conditions: [],
        requiresApproval: false,
        estimatedProcessingTime: 0,
      };
    }

    const payment = paymentResponse.data;
    const conditions = [];

    // Check payment status
    if (payment.status !== PaymentStatus.CAPTURED && payment.status !== PaymentStatus.COMPLETED) {
      conditions.push({
        type: 'payment_status',
        satisfied: false,
        message: 'Payment must be captured before refunding',
      });
      return {
        eligible: false,
        reason: 'Payment not captured',
        maxAmount: 0n,
        conditions,
        requiresApproval: false,
        estimatedProcessingTime: 0,
      };
    }

    // Check time since payment
    const daysSincePayment = Math.floor(
      (Date.now() - payment.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const timeLimit = 90; // Default 90 days
    const timeEligible = daysSincePayment <= timeLimit;
    
    conditions.push({
      type: 'time_limit',
      satisfied: timeEligible,
      message: timeEligible 
        ? `Payment is within ${timeLimit} day refund window`
        : `Payment exceeds ${timeLimit} day refund window`,
      details: { daysSincePayment, timeLimit },
    });

    // Check amount
    const capturedAmount = payment.capturedAmount || payment.amount;
    const alreadyRefunded = payment.refundAmount || 0n;
    const availableToRefund = capturedAmount - alreadyRefunded;
    const amountEligible = availableToRefund > 0;

    conditions.push({
      type: 'refundable_amount',
      satisfied: amountEligible,
      message: amountEligible
        ? `${availableToRefund} available to refund`
        : 'No amount available to refund',
      details: { capturedAmount, alreadyRefunded, availableToRefund },
    });

    // Check for disputes
    if (payment.status === PaymentStatus.DISPUTED) {
      conditions.push({
        type: 'dispute_status',
        satisfied: false,
        message: 'Payment is under dispute',
      });
    }

    const eligible = conditions.every(c => c.satisfied);
    const maxAmount = eligible ? availableToRefund : 0n;

    return {
      eligible,
      reason: eligible ? undefined : 'Payment does not meet refund criteria',
      maxAmount,
      conditions,
      requiresApproval: false, // Can be based on amount or policy
      estimatedProcessingTime: 5, // 5 days
    };
  }

  // ============================================================================
  // LIST REFUNDS
  // ============================================================================

  /**
   * List refunds with filters
   */
  async listRefunds(request: ListRefundsRequest): Promise<ListRefundsResponse> {
    // This would typically call the gateway's list method
    // For now, return empty response
    return {
      refunds: [],
      hasMore: false,
      totalCount: 0,
    };
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  private async validateRefundRequest(request: RefundRequest): Promise<void> {
    if (!request.paymentId) {
      throw ValidationError.required('paymentId');
    }

    // Check eligibility
    const eligibility = await this.checkEligibility(request.paymentId);
    if (!eligibility.eligible) {
      throw new RefundError(
        eligibility.reason || 'Payment not eligible for refund',
        'payment_not_refundable',
        { paymentId: request.paymentId }
      );
    }

    // Validate amount if provided
    if (request.amount) {
      if (request.amount <= 0) {
        throw ValidationError.invalidAmount(request.amount);
      }

      if (request.amount > eligibility.maxAmount) {
        throw new RefundError(
          'Refund amount exceeds maximum refundable amount',
          'refund_amount_exceeds_payment',
          { paymentId: request.paymentId }
        );
      }
    }

    // Validate minimum refund amount (e.g., $0.50)
    const minAmount = 50n; // $0.50 in cents
    if (request.amount && request.amount < minAmount) {
      throw new RefundError(
        `Refund amount below minimum of $0.50`,
        'refund_too_small',
        { paymentId: request.paymentId }
      );
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate refund fee
   */
  private calculateRefundFee(amount: bigint, currency: Currency): bigint {
    // Mock fee calculation - typically a percentage or fixed amount
    // For example: $0.30 or 2.5% of refund amount
    const fixedFee = 30n; // $0.30 in cents
    const percentageFee = amount * 25n / 1000n; // 2.5%
    
    return fixedFee > percentageFee ? fixedFee : percentageFee;
  }

  /**
   * Map gateway refund to our format
   */
  private mapToRefund(gatewayRefund: any): Refund {
    return {
      id: gatewayRefund.id,
      paymentId: gatewayRefund.paymentId,
      amount: gatewayRefund.amount,
      currency: gatewayRefund.currency,
      status: this.mapRefundStatus(gatewayRefund.status),
      reason: gatewayRefund.reason,
      metadata: gatewayRefund.metadata,
      createdAt: gatewayRefund.createdAt,
      completedAt: gatewayRefund.completedAt,
      gatewayRefundId: gatewayRefund.gatewayRefundId,
    };
  }

  /**
   * Map refund status
   */
  private mapRefundStatus(status: string): RefundStatus {
    const statusMap: Record<string, RefundStatus> = {
      'pending': 'pending',
      'succeeded': 'succeeded',
      'failed': 'failed',
      'canceled': 'canceled',
      'requires_action': 'requires_action',
    };

    return statusMap[status] || 'pending';
  }

  /**
   * Check if refund can be created
   */
  canRefund(payment: Payment): boolean {
    return (
      (payment.status === PaymentStatus.CAPTURED || payment.status === PaymentStatus.COMPLETED) &&
      payment.status !== PaymentStatus.DISPUTED
    );
  }

  /**
   * Get refundable amount
   */
  getRefundableAmount(payment: Payment): bigint {
    if (!this.canRefund(payment)) {
      return 0n;
    }

    const captured = payment.capturedAmount || payment.amount;
    const refunded = payment.refundAmount || 0n;
    
    return captured - refunded;
  }

  /**
   * Get refund status timeline
   */
  getRefundTimeline(refund: Refund): RefundTimelineEvent[] {
    const events: RefundTimelineEvent[] = [];

    events.push({
      status: 'pending',
      timestamp: refund.createdAt,
      description: 'Refund initiated',
    });

    if (refund.completedAt) {
      events.push({
        status: refund.status,
        timestamp: refund.completedAt,
        description: this.getStatusDescription(refund.status),
      });
    }

    return events;
  }
}

// ============================================================================
// TIMELINE TYPES
// ============================================================================

interface RefundTimelineEvent {
  status: RefundStatus;
  timestamp: Date;
  description: string;
}

// Helper function for status descriptions
function getStatusDescription(status: RefundStatus): string {
  const descriptions: Record<RefundStatus, string> = {
    'pending': 'Refund is being processed',
    'succeeded': 'Refund completed successfully',
    'failed': 'Refund failed',
    'canceled': 'Refund was canceled',
    'requires_action': 'Refund requires action',
  };

  return descriptions[status] || 'Refund status updated';
}
