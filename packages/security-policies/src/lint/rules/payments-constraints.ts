// ============================================================================
// Lint Rule: Payment Behavior Constraints
// ============================================================================

import type { LintRule, Finding, RuleContext, Behavior, ASTFix, RequiredConstraint } from '../../types.js';

/**
 * Payment behavior patterns
 */
const PAYMENT_PATTERNS = [
  /payment/i,
  /pay/i,
  /charge/i,
  /billing/i,
  /invoice/i,
  /checkout/i,
  /purchase/i,
  /order/i,
  /transaction/i,
  /transfer/i,
  /withdraw/i,
  /deposit/i,
  /payout/i,
  /refund/i,
  /subscription/i,
  /card/i,
  /stripe/i,
  /paypal/i,
];

/**
 * Required constraints for payment behaviors
 */
const PAYMENT_REQUIRED_CONSTRAINTS: RequiredConstraint[] = [
  {
    type: 'auth',
    description: 'Authentication required for payment operations',
    severity: 'error',
  },
  {
    type: 'rate_limit',
    description: 'Rate limiting to prevent abuse',
    severity: 'error',
  },
  {
    type: 'validation',
    description: 'Input validation for amounts and payment details',
    severity: 'error',
  },
  {
    type: 'logging',
    description: 'Audit logging for compliance',
    severity: 'warning',
  },
];

/**
 * Check if behavior requires authentication
 */
function hasAuthRequirement(behavior: Behavior): boolean {
  return behavior.security.some(
    s => s.type === 'requires' && 
         (JSON.stringify(s.details).includes('auth') ||
          JSON.stringify(s.details).includes('authenticated'))
  );
}

/**
 * Check if behavior has rate limiting
 */
function hasRateLimit(behavior: Behavior): boolean {
  return behavior.security.some(s => s.type === 'rate_limit');
}

/**
 * Check if behavior has amount validation
 */
function hasAmountValidation(behavior: Behavior): boolean {
  const hasAmountField = behavior.input.fields.some(
    f => /amount|total|price|sum/i.test(f.name.name)
  );
  
  if (!hasAmountField) return true;
  
  const preStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return preStr.includes('amount') && 
         (preStr.includes('>') || preStr.includes('positive') || preStr.includes('valid'));
}

/**
 * Check if behavior has fraud check
 */
function hasFraudCheck(behavior: Behavior): boolean {
  return behavior.security.some(s => s.type === 'fraud_check') ||
         behavior.preconditions.some(p => 
           JSON.stringify(p).includes('fraud') ||
           JSON.stringify(p).includes('suspicious')
         );
}

/**
 * Check if card data is handled securely
 */
function hasSecureCardHandling(behavior: Behavior): boolean {
  const hasCardField = behavior.input.fields.some(
    f => /card|cvv|cvc|pan|card_number/i.test(f.name.name)
  );
  
  if (!hasCardField) return true;
  
  // Card fields should have secret annotation
  const cardFields = behavior.input.fields.filter(
    f => /card|cvv|cvc|pan|card_number/i.test(f.name.name)
  );
  
  return cardFields.every(f => 
    f.annotations.some(a => 
      ['secret', 'sensitive', 'encrypted'].includes(a.name.name.toLowerCase())
    )
  );
}

/**
 * Generate auth requirement autofix
 */
function generateAuthRequirementFix(behavior: Behavior): ASTFix {
  return {
    description: `Add authentication requirement to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'SecuritySpec',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    security {
      requires authenticated
    }`,
    },
  };
}

/**
 * Generate rate limit autofix
 */
function generateRateLimitFix(behavior: Behavior): ASTFix {
  return {
    description: `Add rate limiting to payment behavior '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'SecuritySpec',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    security {
      rate_limit 10 per user_id
    }`,
    },
  };
}

/**
 * Generate amount validation autofix
 */
function generateAmountValidationFix(behavior: Behavior): ASTFix {
  const amountFields = behavior.input.fields
    .filter(f => /amount|total|price|sum/i.test(f.name.name))
    .map(f => f.name.name);
  
  const validations = amountFields
    .map(f => `      input.${f} > 0`)
    .join('\n');
  
  return {
    description: `Add amount validation to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'Expression',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    preconditions {
${validations}
    }`,
    },
  };
}

/**
 * Generate secure card handling autofix
 */
function generateSecureCardFix(behavior: Behavior): ASTFix {
  return {
    description: `Add [secret] annotation to card fields in '${behavior.name.name}'`,
    operation: 'modify',
    targetKind: 'Field',
    location: behavior.input.location,
    patch: {
      position: 'before',
      text: '[secret]',
    },
  };
}

/**
 * Payment Constraints Lint Rule
 */
export const paymentConstraintsRule: LintRule = {
  id: 'LINT-PAY-001',
  name: 'Payment Behavior Minimum Constraints',
  category: 'payment-security',
  severity: 'error',
  description: 'Payment behaviors must have authentication, rate limiting, and amount validation',
  matchPatterns: PAYMENT_PATTERNS,
  requiredConstraints: PAYMENT_REQUIRED_CONSTRAINTS,
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Check if this is a payment behavior
      const isPayment = PAYMENT_PATTERNS.some(pattern => pattern.test(b.name.name));
      if (!isPayment) continue;

      // Check authentication requirement
      if (!hasAuthRequirement(b)) {
        findings.push({
          id: 'LINT-PAY-001',
          category: 'payment-security',
          severity: 'error',
          title: 'Payment Behavior Missing Auth',
          message: `Payment behavior '${b.name.name}' requires authentication`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add: security { requires authenticated }',
          autofix: generateAuthRequirementFix(b),
        });
      }

      // Check rate limiting
      if (!hasRateLimit(b)) {
        findings.push({
          id: 'LINT-PAY-001',
          category: 'payment-security',
          severity: 'error',
          title: 'Payment Behavior Missing Rate Limit',
          message: `Payment behavior '${b.name.name}' requires rate limiting`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add: security { rate_limit 10 per user_id }',
          autofix: generateRateLimitFix(b),
        });
      }

      // Check amount validation
      if (!hasAmountValidation(b)) {
        findings.push({
          id: 'LINT-PAY-001',
          category: 'payment-security',
          severity: 'error',
          title: 'Payment Behavior Missing Amount Validation',
          message: `Payment behavior '${b.name.name}' must validate amount is positive`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add precondition: input.amount > 0',
          autofix: generateAmountValidationFix(b),
        });
      }

      // Check secure card handling
      if (!hasSecureCardHandling(b)) {
        findings.push({
          id: 'LINT-PAY-001',
          category: 'payment-security',
          severity: 'error',
          title: 'Payment Card Data Not Secured',
          message: `Payment behavior '${b.name.name}' has card fields without [secret] annotation`,
          location: b.input.location,
          behaviorName: b.name.name,
          suggestion: 'Add [secret] annotation to card-related fields',
          autofix: generateSecureCardFix(b),
        });
      }
    }

    return findings;
  },
};

/**
 * Payment Fraud Check Rule
 */
export const paymentFraudCheckRule: LintRule = {
  id: 'LINT-PAY-002',
  name: 'High-Value Payments Need Fraud Check',
  category: 'payment-security',
  severity: 'warning',
  description: 'Payment behaviors should include fraud detection for high-value transactions',
  matchPatterns: PAYMENT_PATTERNS,
  requiredConstraints: [],
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      const isPayment = PAYMENT_PATTERNS.some(pattern => pattern.test(b.name.name));
      if (!isPayment) continue;

      // Check for fraud detection
      if (!hasFraudCheck(b)) {
        findings.push({
          id: 'LINT-PAY-002',
          category: 'payment-security',
          severity: 'warning',
          title: 'Payment Missing Fraud Check',
          message: `Payment behavior '${b.name.name}' should include fraud detection`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add: security { fraud_check required }',
          autofix: {
            description: `Add fraud check to '${b.name.name}'`,
            operation: 'add',
            targetKind: 'SecuritySpec',
            location: b.location,
            patch: {
              position: 'inside',
              text: `
    security {
      fraud_check required
    }`,
            },
          },
        });
      }
    }

    return findings;
  },
};

/**
 * PCI Compliance Rule
 */
export const pciComplianceRule: LintRule = {
  id: 'LINT-PAY-003',
  name: 'PCI Compliance Requirements',
  category: 'payment-security',
  severity: 'warning',
  description: 'Payment behaviors handling card data should declare PCI compliance',
  matchPatterns: [/card/i, /cvv/i, /payment/i, /checkout/i],
  requiredConstraints: [],
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Check if behavior handles card data
      const hasCardData = b.input.fields.some(
        f => /card|cvv|cvc|pan|card_number/i.test(f.name.name)
      );
      
      if (!hasCardData) continue;

      // Check for PCI compliance declaration
      const hasPCICompliance = b.compliance.some(
        c => /pci/i.test(c.standard.name)
      );

      if (!hasPCICompliance) {
        findings.push({
          id: 'LINT-PAY-003',
          category: 'payment-security',
          severity: 'warning',
          title: 'Missing PCI Compliance Declaration',
          message: `Payment behavior '${b.name.name}' handles card data but lacks PCI compliance declaration`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add: compliance { PCI_DSS { ... } }',
          autofix: {
            description: `Add PCI compliance to '${b.name.name}'`,
            operation: 'add',
            targetKind: 'ComplianceSpec',
            location: b.location,
            patch: {
              position: 'inside',
              text: `
    compliance {
      PCI_DSS {
        card_data_encrypted
        no_card_storage
      }
    }`,
            },
          },
        });
      }
    }

    return findings;
  },
};

export const paymentLintRules: LintRule[] = [
  paymentConstraintsRule,
  paymentFraudCheckRule,
  pciComplianceRule,
];
