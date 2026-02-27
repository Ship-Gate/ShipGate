/**
 * Refund policy engine implementation
 * @packageDocumentation
 */

import { PaymentId, Currency, Payment } from '../types';
import { 
  RefundPolicy,
  RefundCondition,
  RefundEligibility,
  EligibilityCondition,
  ConditionType,
  ConditionOperator
} from './types';
import { RefundError, ValidationError } from '../errors';

// ============================================================================
// POLICY ENGINE
// ============================================================================

export class RefundPolicyEngine {
  private policies = new Map<string, RefundPolicy>();
  private defaultPolicy: RefundPolicy;

  constructor() {
    // Create default policy
    this.defaultPolicy = {
      id: 'default',
      name: 'Standard Refund Policy',
      description: 'Default 30-day refund policy',
      timeLimit: 30,
      maxRefundRatio: 1.0,
      minRefundAmount: 50n, // $0.50
      requireReason: true,
      requireApproval: false,
      automaticApproval: true,
      restockFees: {
        enabled: false,
      },
      shippingFees: {
        refundable: false,
      },
      conditions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(this.defaultPolicy.id, this.defaultPolicy);
  }

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  /**
   * Create a new refund policy
   */
  createPolicy(policy: Omit<RefundPolicy, 'id' | 'createdAt' | 'updatedAt'>): RefundPolicy {
    const newPolicy: RefundPolicy = {
      ...policy,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.validatePolicy(newPolicy);
    this.policies.set(newPolicy.id, newPolicy);

    return newPolicy;
  }

  /**
   * Update an existing policy
   */
  updatePolicy(policyId: string, updates: Partial<Omit<RefundPolicy, 'id' | 'createdAt'>>): RefundPolicy {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new ValidationError(
        'Policy not found',
        'policyId',
        policyId,
        'exists'
      );
    }

    if (policyId === 'default') {
      throw new ValidationError(
        'Cannot modify default policy',
        'policyId',
        policyId,
        'immutable'
      );
    }

    const updatedPolicy: RefundPolicy = {
      ...policy,
      ...updates,
      updatedAt: new Date(),
    };

    this.validatePolicy(updatedPolicy);
    this.policies.set(policyId, updatedPolicy);

    return updatedPolicy;
  }

  /**
   * Delete a policy
   */
  deletePolicy(policyId: string): void {
    if (policyId === 'default') {
      throw new ValidationError(
        'Cannot delete default policy',
        'policyId',
        policyId,
        'immutable'
      );
    }

    const deleted = this.policies.delete(policyId);
    if (!deleted) {
      throw new ValidationError(
        'Policy not found',
        'policyId',
        policyId,
        'exists'
      );
    }
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): RefundPolicy {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new ValidationError(
        'Policy not found',
        'policyId',
        policyId,
        'exists'
      );
    }
    return policy;
  }

  /**
   * Get all policies
   */
  getAllPolicies(): RefundPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get default policy
   */
  getDefaultPolicy(): RefundPolicy {
    return this.defaultPolicy;
  }

  // ============================================================================
  // POLICY EVALUATION
  // ============================================================================

  /**
   * Evaluate refund eligibility against policies
   */
  async evaluateEligibility(
    payment: Payment,
    amount?: bigint,
    policyId?: string,
    context?: RefundContext
  ): Promise<RefundEligibility> {
    // Get applicable policy
    const policy = policyId 
      ? this.getPolicy(policyId)
      : await this.getApplicablePolicy(payment, context);

    const conditions: EligibilityCondition[] = [];
    let eligible = true;
    let maxAmount = amount || payment.amount;

    // Evaluate time limit
    const timeCondition = this.evaluateTimeLimit(payment, policy);
    conditions.push(timeCondition);
    if (!timeCondition.satisfied) {
      eligible = false;
      maxAmount = 0n;
    }

    // Evaluate amount limit
    const amountCondition = this.evaluateAmountLimit(payment, amount, policy);
    conditions.push(amountCondition);
    if (!amountCondition.satisfied) {
      eligible = false;
      maxAmount = 0n;
    } else {
      maxAmount = amountCondition.details?.maxAmount || maxAmount;
    }

    // Evaluate minimum amount
    const minAmountCondition = this.evaluateMinimumAmount(amount, policy);
    conditions.push(minAmountCondition);
    if (!minAmountCondition.satisfied) {
      eligible = false;
    }

    // Evaluate custom conditions
    for (const condition of policy.conditions || []) {
      const result = this.evaluateCondition(condition, payment, amount, context);
      conditions.push(result);
      if (!result.satisfied) {
        eligible = false;
      }
    }

    // Evaluate product exclusions
    const productCondition = this.evaluateProductExclusions(payment, policy);
    conditions.push(productCondition);
    if (!productCondition.satisfied) {
      eligible = false;
    }

    return {
      eligible,
      reason: eligible ? undefined : 'Refund does not meet policy requirements',
      maxAmount,
      policy,
      conditions,
      requiresApproval: policy.requireApproval || (policy.automaticApproval ? false : amount && amount > this.getApprovalThreshold(policy)),
      estimatedProcessingTime: this.getProcessingTime(policy),
    };
  }

  /**
   * Get applicable policy for a payment
   */
  async getApplicablePolicy(payment: Payment, context?: RefundContext): Promise<RefundPolicy> {
    // In a real implementation, this would check:
    // - Customer tier
    // - Product category
    // - Payment method
    // - Custom rules
    
    // For now, return default policy
    return this.defaultPolicy;
  }

  /**
   * Check if refund requires approval
   */
  requiresApproval(payment: Payment, amount: bigint, policy?: RefundPolicy): boolean {
    const applicablePolicy = policy || this.defaultPolicy;
    
    if (applicablePolicy.requireApproval) {
      return true;
    }

    if (!applicablePolicy.automaticApproval) {
      return true;
    }

    // Check amount threshold
    const threshold = this.getApprovalThreshold(applicablePolicy);
    return amount > threshold;
  }

  // ============================================================================
  // CONDITION EVALUATION
  // ============================================================================

  private evaluateTimeLimit(payment: Payment, policy: RefundPolicy): EligibilityCondition {
    if (!policy.timeLimit) {
      return {
        type: 'time_limit',
        satisfied: true,
        message: 'No time limit specified',
      };
    }

    const daysSincePayment = Math.floor(
      (Date.now() - payment.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const satisfied = daysSincePayment <= policy.timeLimit;

    return {
      type: 'time_limit',
      satisfied,
      message: satisfied
        ? `Payment is within ${policy.timeLimit} day refund window`
        : `Payment exceeds ${policy.timeLimit} day refund window`,
      details: { daysSincePayment, timeLimit: policy.timeLimit },
    };
  }

  private evaluateAmountLimit(
    payment: Payment, 
    amount: bigint | undefined, 
    policy: RefundPolicy
  ): EligibilityCondition {
    const capturedAmount = payment.capturedAmount || payment.amount;
    const alreadyRefunded = payment.refundAmount || 0n;
    const availableToRefund = capturedAmount - alreadyRefunded;

    let maxAmount = availableToRefund;

    // Apply max refund ratio
    if (policy.maxRefundRatio && policy.maxRefundRatio < 1.0) {
      maxAmount = capturedAmount * BigInt(Math.floor(policy.maxRefundRatio * 100)) / 100n;
      maxAmount = maxAmount < availableToRefund ? maxAmount : availableToRefund;
    }

    // Apply max refund amount
    if (policy.maxRefundAmount) {
      maxAmount = maxAmount < policy.maxRefundAmount ? maxAmount : policy.maxRefundAmount;
    }

    const refundAmount = amount || maxAmount;
    const satisfied = refundAmount <= maxAmount && refundAmount <= availableToRefund;

    return {
      type: 'amount_limit',
      satisfied,
      message: satisfied
        ? `Refund amount within limits`
        : `Refund amount exceeds limits`,
      details: {
        requestedAmount: refundAmount,
        maxAmount,
        availableToRefund,
      },
    };
  }

  private evaluateMinimumAmount(amount: bigint | undefined, policy: RefundPolicy): EligibilityCondition {
    if (!amount || !policy.minRefundAmount) {
      return {
        type: 'minimum_amount',
        satisfied: true,
        message: 'No minimum amount requirement',
      };
    }

    const satisfied = amount >= policy.minRefundAmount;

    return {
      type: 'minimum_amount',
      satisfied,
      message: satisfied
        ? `Refund amount meets minimum requirement`
        : `Refund amount below minimum of ${policy.minRefundAmount}`,
      details: { amount, minimum: policy.minRefundAmount },
    };
  }

  private evaluateCondition(
    condition: RefundCondition,
    payment: Payment,
    amount: bigint | undefined,
    context?: RefundContext
  ): EligibilityCondition {
    // Get the value to compare
    const actualValue = this.getConditionValue(condition.type, payment, amount, context);
    
    // Evaluate the condition
    const satisfied = this.evaluateOperator(actualValue, condition.operator, condition.value);

    return {
      type: condition.type,
      satisfied,
      message: condition.message || (
        satisfied
          ? `Condition met: ${condition.type} ${condition.operator} ${condition.value}`
          : `Condition not met: ${condition.type} ${condition.operator} ${condition.value}`
      ),
      details: { actualValue, expectedValue: condition.value, operator: condition.operator },
    };
  }

  private evaluateProductExclusions(payment: Payment, policy: RefundPolicy): EligibilityCondition {
    if (!policy.excludedProducts || policy.excludedProducts.length === 0) {
      return {
        type: 'product_exclusion',
        satisfied: true,
        message: 'No product exclusions',
      };
    }

    // Get product IDs from payment metadata
    const productIds = this.extractProductIds(payment);
    const hasExcludedProduct = productIds.some(id => policy.excludedProducts!.includes(id));

    return {
      type: 'product_exclusion',
      satisfied: !hasExcludedProduct,
      message: hasExcludedProduct
        ? 'Payment contains excluded product'
        : 'No excluded products in payment',
      details: { productIds, excludedProducts: policy.excludedProducts },
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getConditionValue(
    type: ConditionType,
    payment: Payment,
    amount: bigint | undefined,
    context?: RefundContext
  ): any {
    switch (type) {
      case 'time_since_payment':
        return Math.floor((Date.now() - payment.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      case 'payment_amount':
        return Number(payment.amount);
      
      case 'customer_tier':
        return context?.customerTier || 'standard';
      
      case 'product_category':
        return context?.productCategory || 'general';
      
      case 'order_total':
        return Number(payment.amount);
      
      case 'payment_method':
        return context?.paymentMethod || 'card';
      
      case 'custom':
        return context?.customValues?.[type] || null;
      
      default:
        return null;
    }
  }

  private evaluateOperator(actualValue: any, operator: ConditionOperator, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      
      case 'not_equals':
        return actualValue !== expectedValue;
      
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      
      case 'greater_than_or_equal':
        return Number(actualValue) >= Number(expectedValue);
      
      case 'less_than_or_equal':
        return Number(actualValue) <= Number(expectedValue);
      
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      
      case 'contains':
        return String(actualValue).includes(String(expectedValue));
      
      case 'not_contains':
        return !String(actualValue).includes(String(expectedValue));
      
      default:
        return false;
    }
  }

  private extractProductIds(payment: Payment): string[] {
    // Extract product IDs from payment metadata
    const productIds = payment.metadata?.product_ids;
    if (productIds) {
      return Array.isArray(productIds) ? productIds : [productIds];
    }
    return [];
  }

  private getApprovalThreshold(policy: RefundPolicy): bigint {
    // Default threshold: $1000
    return 100000n; // $1000.00 in cents
  }

  private getProcessingTime(policy: RefundPolicy): number {
    // Return processing time in days
    // Could be based on policy or amount
    return 5; // Default 5 days
  }

  private validatePolicy(policy: RefundPolicy): void {
    if (!policy.name) {
      throw ValidationError.required('name');
    }

    if (policy.timeLimit && policy.timeLimit < 0) {
      throw new ValidationError(
        'Time limit cannot be negative',
        'timeLimit',
        policy.timeLimit,
        'positive'
      );
    }

    if (policy.maxRefundRatio && (policy.maxRefundRatio < 0 || policy.maxRefundRatio > 1)) {
      throw new ValidationError(
        'Max refund ratio must be between 0 and 1',
        'maxRefundRatio',
        policy.maxRefundRatio,
        'range'
      );
    }

    if (policy.minRefundAmount && policy.minRefundAmount < 0) {
      throw new ValidationError(
        'Min refund amount cannot be negative',
        'minRefundAmount',
        policy.minRefundAmount,
        'positive'
      );
    }
  }
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface RefundContext {
  customerTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  productCategory?: string;
  productIds?: string[];
  paymentMethod?: string;
  shippingMethod?: string;
  customValues?: Record<string, any>;
}
