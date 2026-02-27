// ============================================================================
// Payments Domain Strategy
// Generates assertions for payment processing behaviors
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { BaseDomainStrategy } from './base';
import type {
  DomainType,
  GeneratedAssertion,
  StrategyContext,
} from '../types';

/**
 * Strategy for generating payment domain tests
 * 
 * Supported patterns:
 * - Amount > 0 validation
 * - Status succeeded check
 * - Idempotency key behavior (scaffolds)
 * - Currency validation
 * - Refund constraints
 */
export class PaymentsStrategy extends BaseDomainStrategy {
  domain: DomainType = 'payments';

  matches(behavior: AST.Behavior, domain: AST.Domain): boolean {
    // Check domain name
    if (this.domainNameMatches(domain, ['payment', 'billing', 'transaction', 'checkout'])) {
      return true;
    }

    // Check behavior name patterns
    if (this.behaviorNameMatches(behavior, [
      'payment', 'charge', 'refund', 'capture', 'authorize',
      'transfer', 'payout', 'invoice', 'subscription'
    ])) {
      return true;
    }

    // Check for payment-related input fields
    const inputFields = behavior.input.fields.map(f => f.name.name.toLowerCase());
    return inputFields.some(f => 
      ['amount', 'currency', 'card', 'idempotency_key', 'payment_method'].includes(f)
    );
  }

  generatePreconditionAssertions(
    precondition: AST.Expression,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];

    // Pattern: input.amount > 0
    if (this.isAmountPositive(precondition)) {
      assertions.push(this.supported(
        `expect(input.amount).toBeGreaterThan(0);`,
        'Payment amount must be positive',
        'payment.amount_positive'
      ));

      assertions.push(this.supported(
        `const zeroAmountInput = { ...validInput, amount: 0 };\nconst result = await ${behavior.name.name}(zeroAmountInput);\nexpect(result.success).toBe(false);`,
        'Should reject zero amount',
        'payment.amount_positive'
      ));

      assertions.push(this.supported(
        `const negativeAmountInput = { ...validInput, amount: -10 };\nconst result = await ${behavior.name.name}(negativeAmountInput);\nexpect(result.success).toBe(false);`,
        'Should reject negative amount',
        'payment.amount_positive'
      ));
    }

    // Pattern: idempotency key not exists
    if (this.isIdempotencyCheck(precondition)) {
      assertions.push(this.needsImpl(
        `// SCAFFOLD: Idempotency key should be unique\nconst existingPayment = await Payment.findByIdempotencyKey(input.idempotency_key);\nexpect(existingPayment).toBeNull();`,
        'Idempotency key must be unique',
        'payment.idempotency_key',
        'Implement Payment.findByIdempotencyKey in your test runtime'
      ));
    }

    // Pattern: card expiry validation
    if (this.isCardExpiryValidation(precondition)) {
      const currentYear = new Date().getFullYear();
      assertions.push(this.supported(
        `expect(input.card.expiry_year).toBeGreaterThanOrEqual(${currentYear});`,
        'Card must not be expired',
        'payment.currency_valid'
      ));

      assertions.push(this.supported(
        `const expiredCardInput = { ...validInput, card: { ...validInput.card, expiry_year: 2020 } };\nawait expect(${behavior.name.name}(expiredCardInput)).resolves.toMatchObject({ error: 'EXPIRED_CARD' });`,
        'Should reject expired card',
        'payment.currency_valid'
      ));
    }

    // Pattern: Payment.exists check for refunds
    if (this.isPaymentExistsCheck(precondition)) {
      assertions.push(this.supported(
        `const payment = await Payment.findById(input.payment_id);\nexpect(payment).toBeDefined();`,
        'Referenced payment must exist',
        'generic.precondition'
      ));
    }

    // Pattern: refund amount constraints
    if (this.isRefundAmountCheck(precondition)) {
      assertions.push(this.supported(
        `if (input.amount !== null) {\n  expect(input.amount).toBeGreaterThan(0);\n  expect(input.amount).toBeLessThanOrEqual(originalPayment.amount);\n}`,
        'Refund amount must be positive and not exceed original',
        'payment.refund_valid'
      ));
    }

    // Generic precondition if no specific pattern matched
    if (assertions.length === 0) {
      const exprStr = this.compileExpr(precondition);
      assertions.push(this.supported(
        `expect(${exprStr}).toBe(true);`,
        `Precondition: ${exprStr}`,
        'generic.precondition'
      ));
    }

    return assertions;
  }

  generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const condition = this.getConditionName(postcondition.condition);

    for (const predicate of postcondition.predicates) {
      // Pattern: Payment.exists(result.id)
      if (this.isPaymentCreated(predicate)) {
        assertions.push(this.supported(
          `expect(result.id).toBeDefined();\nconst createdPayment = await Payment.findById(result.id);\nexpect(createdPayment).toBeDefined();`,
          'Payment should be persisted',
          'payment.status_succeeded'
        ));
      }

      // Pattern: Payment status check
      if (this.isStatusCheck(predicate)) {
        assertions.push(this.supported(
          `expect(['COMPLETED', 'PROCESSING']).toContain(result.status);`,
          'Payment status should be COMPLETED or PROCESSING',
          'payment.status_succeeded'
        ));
      }

      // Pattern: Amount matches input
      if (this.isAmountMatch(predicate)) {
        assertions.push(this.supported(
          `expect(result.amount).toEqual(input.amount);`,
          'Payment amount should match input',
          'payment.amount_positive'
        ));
      }

      // Pattern: Currency matches input
      if (this.isCurrencyMatch(predicate)) {
        assertions.push(this.supported(
          `expect(result.currency).toEqual(input.currency);`,
          'Payment currency should match input',
          'payment.currency_valid'
        ));
      }

      // Pattern: Idempotency key preserved
      if (this.isIdempotencyPreserved(predicate)) {
        assertions.push(this.supported(
          `expect(result.idempotency_key).toEqual(input.idempotency_key);`,
          'Idempotency key should be preserved',
          'payment.idempotency_key'
        ));

        assertions.push(this.needsImpl(
          `// SCAFFOLD: Verify idempotent behavior on retry\nconst retryResult = await ${behavior.name.name}(input);\nexpect(retryResult.id).toEqual(result.id);`,
          'Retry with same idempotency key should return same result',
          'payment.idempotency_key',
          'Implement idempotency verification in integration tests'
        ));
      }

      // Pattern: Error count unchanged (for DUPLICATE_IDEMPOTENCY_KEY)
      if (condition !== 'success' && this.isCountUnchanged(predicate)) {
        assertions.push(this.supported(
          `const countAfter = await Payment.count();\nexpect(countAfter).toEqual(countBefore);`,
          'No new payment should be created on error',
          'payment.idempotency_key'
        ));
      }

      // Pattern: Refund created
      if (this.isRefundCreated(predicate)) {
        assertions.push(this.supported(
          `expect(result.id).toBeDefined();\nconst refund = await Refund.findById(result.id);\nexpect(refund).toBeDefined();\nexpect(refund.payment_id).toEqual(input.payment_id);`,
          'Refund should be created and linked to payment',
          'payment.refund_valid'
        ));
      }

      // Pattern: Refund status
      if (this.isRefundStatusCheck(predicate)) {
        assertions.push(this.supported(
          `expect(['COMPLETED', 'PENDING']).toContain(result.status);`,
          'Refund status should be valid',
          'payment.refund_valid'
        ));
      }

      // Pattern: Payment status updated (for cancellation)
      if (this.isPaymentStatusUpdated(predicate)) {
        const targetStatus = this.extractTargetStatus(predicate);
        assertions.push(this.supported(
          `const updatedPayment = await Payment.findById(input.payment_id);\nexpect(updatedPayment.status).toEqual('${targetStatus || 'CANCELLED'}');`,
          `Payment status should be updated to ${targetStatus || 'CANCELLED'}`,
          'payment.status_succeeded'
        ));
      }
    }

    // If no specific patterns matched, generate generic assertions
    if (assertions.length === 0) {
      for (const predicate of postcondition.predicates) {
        const exprStr = this.compileExpr(predicate);
        assertions.push(this.supported(
          `expect(${exprStr}).toBe(true);`,
          `Postcondition (${condition}): ${this.truncate(exprStr, 50)}`,
          'generic.postcondition'
        ));
      }
    }

    return assertions;
  }

  generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const errorName = errorSpec.name.name;
    const when = errorSpec.when?.value || 'specific conditions';

    switch (errorName) {
      case 'DUPLICATE_IDEMPOTENCY_KEY':
        assertions.push(this.needsImpl(
          `// SCAFFOLD: First create a payment with the same idempotency key\nconst firstPayment = await ${behavior.name.name}({ ...validInput, idempotency_key: 'duplicate-key' });\n\n// Then try with same key\nconst result = await ${behavior.name.name}({ ...validInput, idempotency_key: 'duplicate-key' });\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('DUPLICATE_IDEMPOTENCY_KEY');\n// OR it should return the same payment (idempotent)\n// expect(result.id).toEqual(firstPayment.id);`,
          'Should handle duplicate idempotency key',
          'payment.idempotency_key',
          'Verify your implementation returns error OR same result for duplicate keys'
        ));
        break;

      case 'CARD_DECLINED':
        assertions.push(this.supported(
          `const declinedCardInput = { ...validInput, card: { ...validInput.card, number: '4000000000000002' } };\nconst result = await ${behavior.name.name}(declinedCardInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('CARD_DECLINED');\nexpect(result.retriable).toBe(true);`,
          'Should return CARD_DECLINED for declined cards',
          'payment.status_succeeded'
        ));
        break;

      case 'INSUFFICIENT_FUNDS':
        assertions.push(this.supported(
          `const insufficientFundsInput = { ...validInput, amount: 999999.99 };\nconst result = await ${behavior.name.name}(insufficientFundsInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INSUFFICIENT_FUNDS');\nexpect(result.retriable).toBe(true);`,
          'Should return INSUFFICIENT_FUNDS when card has insufficient balance',
          'payment.status_succeeded'
        ));
        break;

      case 'INVALID_CARD':
        assertions.push(this.supported(
          `const invalidCardInput = { ...validInput, card: { ...validInput.card, number: '1234567890' } };\nconst result = await ${behavior.name.name}(invalidCardInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_CARD');\nexpect(result.retriable).toBe(false);`,
          'Should return INVALID_CARD for invalid card numbers',
          'payment.status_succeeded'
        ));
        break;

      case 'EXPIRED_CARD':
        assertions.push(this.supported(
          `const expiredCardInput = { ...validInput, card: { ...validInput.card, expiry_month: 1, expiry_year: 2020 } };\nconst result = await ${behavior.name.name}(expiredCardInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('EXPIRED_CARD');\nexpect(result.retriable).toBe(false);`,
          'Should return EXPIRED_CARD for expired cards',
          'payment.status_succeeded'
        ));
        break;

      case 'FRAUD_DETECTED':
        assertions.push(this.supported(
          `// Use test card number that triggers fraud detection\nconst fraudInput = { ...validInput, card: { ...validInput.card, number: '4100000000000019' } };\nconst result = await ${behavior.name.name}(fraudInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('FRAUD_DETECTED');\nexpect(result.retriable).toBe(false);`,
          'Should return FRAUD_DETECTED for suspicious transactions',
          'payment.status_succeeded'
        ));
        break;

      case 'PROCESSOR_ERROR':
        assertions.push(this.supported(
          `// Mock processor to return error\nconst result = await ${behavior.name.name}(validInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('PROCESSOR_ERROR');\nexpect(result.retriable).toBe(true);\nexpect(result.retryAfter).toBeDefined();`,
          'Should return PROCESSOR_ERROR for gateway errors',
          'payment.status_succeeded'
        ));
        break;

      case 'REFUND_EXCEEDS_AMOUNT':
        assertions.push(this.supported(
          `const excessiveRefundInput = { ...validInput, amount: originalPayment.amount + 100 };\nconst result = await ${behavior.name.name}(excessiveRefundInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('REFUND_EXCEEDS_AMOUNT');\nexpect(result.retriable).toBe(false);`,
          'Should return REFUND_EXCEEDS_AMOUNT when refund > payment',
          'payment.refund_valid'
        ));
        break;

      case 'PAYMENT_NOT_REFUNDABLE':
        assertions.push(this.supported(
          `// Try to refund a pending/cancelled payment\nconst result = await ${behavior.name.name}({ payment_id: nonRefundablePayment.id, idempotency_key: 'test' });\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('PAYMENT_NOT_REFUNDABLE');`,
          'Should return PAYMENT_NOT_REFUNDABLE for non-completed payments',
          'payment.refund_valid'
        ));
        break;

      default:
        assertions.push(this.supported(
          `const result = await ${behavior.name.name}(inputFor${errorName}());\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(${errorSpec.retriable});`,
          `Should return ${errorName} when ${when}`,
          'generic.postcondition'
        ));
    }

    return assertions;
  }

  // ============================================================================
  // PATTERN DETECTION HELPERS
  // ============================================================================

  private isAmountPositive(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('amount') && (str.includes('> 0') || str.includes('>0'));
  }

  private isIdempotencyCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('idempotency') && str.includes('exists');
  }

  private isCardExpiryValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('expiry') && (str.includes('year') || str.includes('month'));
  }

  private isPaymentExistsCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('payment') && str.includes('exists');
  }

  private isRefundAmountCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('amount') && str.includes('payment');
  }

  private isPaymentCreated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('payment') && str.includes('exists') && str.includes('result');
  }

  private isStatusCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('status') && (str.includes('completed') || str.includes('processing'));
  }

  private isAmountMatch(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('amount') && str.includes('input.amount');
  }

  private isCurrencyMatch(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('currency') && str.includes('input.currency');
  }

  private isIdempotencyPreserved(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('idempotency_key') && str.includes('input');
  }

  private isCountUnchanged(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('count') && str.includes('old');
  }

  private isRefundCreated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('refund') && str.includes('exists');
  }

  private isRefundStatusCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('refund') && str.includes('status');
  }

  private isPaymentStatusUpdated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('payment') && str.includes('status') && !str.includes('exists');
  }

  private extractTargetStatus(expr: AST.Expression): string | null {
    const str = this.compileExpr(expr).toUpperCase();
    const statuses = ['CANCELLED', 'REFUNDED', 'COMPLETED', 'FAILED'];
    for (const status of statuses) {
      if (str.includes(status)) return status;
    }
    return null;
  }

  private getConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'any error';
    return condition.name;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  }
}
