/**
 * ISL Policy Packs - Payments Policy Pack
 * 
 * Rules for payment processing security patterns.
 * 
 * @module @isl-lang/policy-packs/payments
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import { matchesAnyPattern, containsKeyword, findClaimsByType } from '../utils.js';

// ============================================================================
// Payment Patterns
// ============================================================================

const PAYMENT_KEYWORDS = [
  'stripe',
  'payment',
  'charge',
  'checkout',
  'billing',
  'subscription',
  'invoice',
  'refund',
  'payout',
  'transfer',
  'card',
  'credit',
  'debit',
];

const DANGEROUS_PATTERNS = [
  /amount\s*[=:]\s*0/i,
  /price\s*[=:]\s*0/i,
  /skipPayment/i,
  /bypassPayment/i,
  /freeCheckout/i,
  /testMode\s*[=:]\s*true/i,
  /livemode\s*[=:]\s*false/i,
];

const CARD_NUMBER_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  /card_?number\s*[=:]\s*['"]?\d{13,19}['"]?/i,
];

// ============================================================================
// Rules
// ============================================================================

/**
 * Payment Bypass Detection Rule
 */
const paymentBypassRule: PolicyRule = {
  id: 'payments/bypass-detected',
  name: 'Payment Bypass Detected',
  description: 'Detects patterns that may bypass payment verification',
  severity: 'error',
  category: 'payments',
  tags: ['security', 'payments', 'bypass'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Only check files that might involve payments
    if (!containsKeyword(ctx.content, PAYMENT_KEYWORDS)) {
      return null;
    }

    const match = matchesAnyPattern(ctx.content, DANGEROUS_PATTERNS);
    if (match) {
      return {
        ruleId: 'payments/bypass-detected',
        ruleName: 'Payment Bypass Detected',
        severity: 'error',
        tier: 'hard_block',
        message: `PAYMENT BYPASS: Suspicious pattern "${match[0]}" may bypass payment`,
        location: { file: ctx.filePath },
        suggestion: 'Remove payment bypass patterns. Payments should always be verified server-side.',
      };
    }

    return null;
  },
};

/**
 * Hardcoded Card Number Rule
 */
const hardcodedCardRule: PolicyRule = {
  id: 'payments/hardcoded-card',
  name: 'Hardcoded Card Number',
  description: 'Detects hardcoded payment card numbers',
  severity: 'error',
  category: 'payments',
  tags: ['security', 'pci', 'card'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const match = matchesAnyPattern(ctx.content, CARD_NUMBER_PATTERNS);
    if (match) {
      // Exclude test card numbers
      const testCards = ['4242424242424242', '4000000000000000', '5555555555554444'];
      const matchStr = match[0].replace(/[\s-]/g, '');
      if (testCards.some(tc => matchStr.includes(tc))) {
        return null; // Allow test cards
      }

      return {
        ruleId: 'payments/hardcoded-card',
        ruleName: 'Hardcoded Card Number',
        severity: 'error',
        tier: 'hard_block',
        message: 'HARDCODED CARD: Card number detected in code',
        location: { file: ctx.filePath },
        suggestion: 'Never store card numbers in code. Use tokenized payment methods.',
      };
    }

    return null;
  },
};

/**
 * Client-Side Price Modification Rule
 */
const clientSidePriceRule: PolicyRule = {
  id: 'payments/client-side-price',
  name: 'Client-Side Price Modification',
  description: 'Detects patterns that allow client-side price manipulation',
  severity: 'warning',
  category: 'payments',
  tags: ['security', 'payments', 'validation'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check if this is client-side code with price manipulation
    const isClientSide = /\.jsx?$|\.tsx?$/.test(ctx.filePath) && 
      (ctx.content.includes('useState') || ctx.content.includes('this.state'));
    
    if (!isClientSide) return null;

    const pricePatterns = [
      /setPrice\s*\(/i,
      /setAmount\s*\(/i,
      /price\s*=\s*[^=]/i,
      /amount\s*=\s*[^=]/i,
    ];

    const match = matchesAnyPattern(ctx.content, pricePatterns);
    if (match && containsKeyword(ctx.content, ['payment', 'checkout', 'cart'])) {
      return {
        ruleId: 'payments/client-side-price',
        ruleName: 'Client-Side Price Modification',
        severity: 'warning',
        tier: 'soft_block',
        message: 'CLIENT-SIDE PRICE: Price modification detected in client code',
        location: { file: ctx.filePath },
        suggestion: 'Prices should be set server-side only. Client should display, not modify prices.',
      };
    }

    return null;
  },
};

/**
 * Missing Idempotency Key Rule
 */
const missingIdempotencyRule: PolicyRule = {
  id: 'payments/missing-idempotency',
  name: 'Missing Idempotency Key',
  description: 'Detects payment API calls without idempotency keys',
  severity: 'warning',
  category: 'payments',
  tags: ['reliability', 'payments', 'idempotency'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check for Stripe API calls
    const stripePatterns = [
      /stripe\.paymentIntents\.create/i,
      /stripe\.charges\.create/i,
      /stripe\.subscriptions\.create/i,
      /stripe\.invoices\.pay/i,
    ];

    const match = matchesAnyPattern(ctx.content, stripePatterns);
    if (match) {
      // Check if idempotency key is present
      if (!ctx.content.includes('idempotencyKey') && !ctx.content.includes('Idempotency-Key')) {
        return {
          ruleId: 'payments/missing-idempotency',
          ruleName: 'Missing Idempotency Key',
          severity: 'warning',
          tier: 'warn',
          message: 'MISSING IDEMPOTENCY: Payment API call without idempotency key',
          location: { file: ctx.filePath },
          suggestion: 'Add idempotency key to prevent duplicate charges on retries',
        };
      }
    }

    return null;
  },
};

/**
 * Webhook Signature Verification Rule
 */
const webhookSignatureRule: PolicyRule = {
  id: 'payments/webhook-signature',
  name: 'Missing Webhook Signature Verification',
  description: 'Detects payment webhook handlers without signature verification',
  severity: 'error',
  category: 'payments',
  tags: ['security', 'webhooks', 'payments'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check if this is a webhook handler
    const isWebhook = /webhook/i.test(ctx.filePath) || 
      ctx.content.includes('stripe.webhooks') ||
      ctx.content.includes('webhook_endpoint');

    if (!isWebhook) return null;

    // Check for signature verification
    const hasSignatureCheck = 
      ctx.content.includes('constructEvent') ||
      ctx.content.includes('verifySignature') ||
      ctx.content.includes('stripe-signature');

    if (!hasSignatureCheck) {
      return {
        ruleId: 'payments/webhook-signature',
        ruleName: 'Missing Webhook Signature Verification',
        severity: 'error',
        tier: 'hard_block',
        message: 'WEBHOOK UNSIGNED: Payment webhook missing signature verification',
        location: { file: ctx.filePath },
        suggestion: 'Verify webhook signatures to prevent spoofed events',
      };
    }

    return null;
  },
};

// ============================================================================
// Policy Pack Export
// ============================================================================

export const paymentsPolicyPack: PolicyPack = {
  id: 'payments',
  name: 'Payment Security',
  description: 'Rules for secure payment processing patterns',
  version: '0.1.0',
  rules: [
    paymentBypassRule,
    hardcodedCardRule,
    clientSidePriceRule,
    missingIdempotencyRule,
    webhookSignatureRule,
  ],
  defaultConfig: {
    enabled: true,
  },
};

export default paymentsPolicyPack;
