/**
 * Payments Test Generation Strategy
 * 
 * Generates payment-specific test cases for subscription and billing flows.
 * Covers:
 * - Subscription lifecycle
 * - Payment failures and retries
 * - Plan changes and proration
 * - Invoice generation
 * - Webhook handling
 */

import type {
  TestGenerationStrategy,
  StrategyContext,
  GeneratedTestCase,
  MockSetup,
  ImportSpec,
} from '../testGenTypes.js';

export const paymentsStrategy: TestGenerationStrategy = {
  id: 'payments',
  name: 'Payments & Subscriptions Strategy',
  appliesTo: ['StripeSubscriptions', 'Payments', 'Billing', 'Subscriptions'],

  generateTests(context: StrategyContext): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];
    const { behaviorName } = context;

    // Subscription creation tests
    if (behaviorName.includes('CreateSubscription') || behaviorName.includes('Subscribe')) {
      tests.push(...generateSubscriptionCreationTests(context));
    }

    // Subscription cancellation tests
    if (behaviorName.includes('Cancel')) {
      tests.push(...generateCancellationTests(context));
    }

    // Plan change tests
    if (behaviorName.includes('ChangePlan') || behaviorName.includes('Upgrade') || behaviorName.includes('Downgrade')) {
      tests.push(...generatePlanChangeTests(context));
    }

    // Payment method tests
    if (behaviorName.includes('Payment') || behaviorName.includes('Customer')) {
      tests.push(...generatePaymentMethodTests(context));
    }

    // Invoice tests
    if (behaviorName.includes('Invoice')) {
      tests.push(...generateInvoiceTests(context));
    }

    return tests;
  },

  generateMocks(context: StrategyContext): MockSetup[] {
    const mocks: MockSetup[] = [];

    // Customer mock
    mocks.push({
      entity: 'Customer',
      method: 'exists',
      returns: { type: 'literal', value: true },
    });

    mocks.push({
      entity: 'Customer',
      method: 'lookup',
      returns: {
        type: 'literal',
        value: {
          id: 'mock-customer-id',
          stripe_customer_id: 'cus_mock123',
          email: 'test@example.com',
          default_payment_method_id: 'pm_mock123',
        },
      },
    });

    // Plan mock
    mocks.push({
      entity: 'Plan',
      method: 'exists',
      returns: { type: 'literal', value: true },
    });

    mocks.push({
      entity: 'Plan',
      method: 'lookup',
      returns: {
        type: 'literal',
        value: {
          id: 'mock-plan-id',
          stripe_price_id: 'price_mock123',
          name: 'Pro Plan',
          amount: 29.99,
          currency: 'USD',
          interval: 'month',
          is_active: true,
        },
      },
    });

    // Subscription mock
    mocks.push({
      entity: 'Subscription',
      method: 'exists',
      returns: { type: 'literal', value: true },
    });

    return mocks;
  },

  getImports(): ImportSpec[] {
    return [
      {
        module: '@/test-utils/payments',
        imports: ['createMockCustomer', 'createMockPlan', 'createMockSubscription', 'createMockInvoice'],
      },
      {
        module: '@/test-utils/stripe',
        imports: ['mockStripeClient', 'mockStripeWebhook'],
      },
    ];
  },
};

function generateSubscriptionCreationTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful subscription with trial
  tests.push({
    id: `${behaviorName}_payments_trial_subscription`,
    name: 'should create subscription with trial period',
    description: 'Tests subscription creation with trial period starts in TRIALING status',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'Subscription.lookup(result.id).status in [TRIALING, ACTIVE, INCOMPLETE]',
    },
    input: {
      params: {
        customer_id: { type: 'generated', generator: { kind: 'uuid' } },
        plan_id: { type: 'generated', generator: { kind: 'uuid' } },
        trial_days: { type: 'literal', value: 14 },
      },
      mocks: [
        {
          entity: 'Plan',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'plan-with-trial',
              trial_days: 14,
              is_active: true,
              amount: 29.99,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.status', operator: 'equals', expected: { type: 'literal', value: 'TRIALING' } },
        { path: 'result.trial_end', operator: 'is_not_null', expected: { type: 'literal', value: null } },
      ],
    },
    tags: ['payments', 'subscription', 'trial', 'positive'],
    priority: 'critical',
  });

  // Test: Customer not found
  tests.push({
    id: `${behaviorName}_payments_customer_not_found`,
    name: 'should reject subscription for non-existent customer',
    description: 'Tests that subscriptions cannot be created for non-existent customers',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'Customer.exists(input.customer_id)',
    },
    input: {
      params: {
        customer_id: { type: 'literal', value: 'non-existent-customer' },
        plan_id: { type: 'generated', generator: { kind: 'uuid' } },
      },
      mocks: [
        {
          entity: 'Customer',
          method: 'exists',
          args: { customer_id: { type: 'literal', value: 'non-existent-customer' } },
          returns: { type: 'literal', value: false },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'CUSTOMER_NOT_FOUND',
    },
    tags: ['payments', 'subscription', 'negative'],
    priority: 'high',
  });

  // Test: Inactive plan
  tests.push({
    id: `${behaviorName}_payments_inactive_plan`,
    name: 'should reject subscription to inactive plan',
    description: 'Tests that subscriptions cannot be created for inactive plans',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 2,
      expression: 'Plan.lookup(input.plan_id).is_active',
    },
    input: {
      params: {
        customer_id: { type: 'generated', generator: { kind: 'uuid' } },
        plan_id: { type: 'literal', value: 'inactive-plan' },
      },
      mocks: [
        {
          entity: 'Customer',
          method: 'exists',
          returns: { type: 'literal', value: true },
        },
        {
          entity: 'Plan',
          method: 'exists',
          returns: { type: 'literal', value: true },
        },
        {
          entity: 'Plan',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'inactive-plan',
              is_active: false,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'PLAN_INACTIVE',
    },
    tags: ['payments', 'subscription', 'negative'],
    priority: 'high',
  });

  // Test: Payment failure
  tests.push({
    id: `${behaviorName}_payments_declined`,
    name: 'should handle payment method decline',
    description: 'Tests handling of declined payment methods during subscription creation',
    behaviorName,
    testType: 'negative',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'Payment declined handling',
    },
    input: {
      params: {
        customer_id: { type: 'generated', generator: { kind: 'uuid' } },
        plan_id: { type: 'generated', generator: { kind: 'uuid' } },
        payment_method_id: { type: 'literal', value: 'pm_card_declined' },
      },
      mocks: [
        {
          entity: 'Stripe',
          method: 'createSubscription',
          returns: {
            type: 'literal',
            value: { error: { code: 'card_declined', message: 'Your card was declined' } },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'PAYMENT_FAILED',
    },
    tags: ['payments', 'subscription', 'negative', 'stripe'],
    priority: 'critical',
  });

  return tests;
}

function generateCancellationTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Immediate cancellation
  tests.push({
    id: `${behaviorName}_payments_immediate_cancel`,
    name: 'should immediately cancel subscription',
    description: 'Tests immediate subscription cancellation',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'input.cancel_immediately implies Subscription.lookup(input.subscription_id).status == CANCELED',
    },
    input: {
      params: {
        subscription_id: { type: 'generated', generator: { kind: 'uuid' } },
        cancel_immediately: { type: 'literal', value: true },
      },
      mocks: [
        {
          entity: 'Subscription',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'sub-to-cancel',
              status: 'ACTIVE',
              cancel_at_period_end: false,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      stateChanges: [
        {
          entity: 'Subscription',
          lookup: { id: { type: 'reference', path: 'input.subscription_id' } },
          property: 'status',
          expected: { type: 'literal', value: 'CANCELED' },
        },
      ],
    },
    tags: ['payments', 'cancellation', 'positive'],
    priority: 'high',
  });

  // Test: Cancel at period end
  tests.push({
    id: `${behaviorName}_payments_cancel_period_end`,
    name: 'should schedule cancellation at period end',
    description: 'Tests scheduling subscription cancellation at end of billing period',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 1,
      expression: 'not input.cancel_immediately implies Subscription.lookup(input.subscription_id).cancel_at_period_end == true',
    },
    input: {
      params: {
        subscription_id: { type: 'generated', generator: { kind: 'uuid' } },
        cancel_immediately: { type: 'literal', value: false },
      },
    },
    expected: {
      outcome: 'success',
      stateChanges: [
        {
          entity: 'Subscription',
          lookup: { id: { type: 'reference', path: 'input.subscription_id' } },
          property: 'cancel_at_period_end',
          expected: { type: 'literal', value: true },
        },
      ],
    },
    tags: ['payments', 'cancellation', 'positive'],
    priority: 'high',
  });

  // Test: Already canceled
  tests.push({
    id: `${behaviorName}_payments_already_canceled`,
    name: 'should reject cancellation of already canceled subscription',
    description: 'Tests that already canceled subscriptions cannot be canceled again',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 1,
      expression: 'Subscription.lookup(input.subscription_id).status not in [CANCELED, INCOMPLETE_EXPIRED]',
    },
    input: {
      params: {
        subscription_id: { type: 'literal', value: 'already-canceled-sub' },
      },
      mocks: [
        {
          entity: 'Subscription',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              id: 'already-canceled-sub',
              status: 'CANCELED',
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'ALREADY_CANCELED',
    },
    tags: ['payments', 'cancellation', 'negative'],
    priority: 'medium',
  });

  return tests;
}

function generatePlanChangeTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful upgrade
  tests.push({
    id: `${behaviorName}_payments_upgrade`,
    name: 'should upgrade subscription to higher tier',
    description: 'Tests subscription upgrade with proration',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'Subscription.lookup(input.subscription_id).plan_id == input.new_plan_id',
    },
    input: {
      params: {
        subscription_id: { type: 'generated', generator: { kind: 'uuid' } },
        new_plan_id: { type: 'literal', value: 'pro-plan' },
        prorate: { type: 'literal', value: true },
      },
      mocks: [
        {
          entity: 'Subscription',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              status: 'ACTIVE',
              plan_id: 'basic-plan',
            },
          },
        },
        {
          entity: 'Plan',
          method: 'lookup',
          args: { plan_id: { type: 'literal', value: 'pro-plan' } },
          returns: {
            type: 'literal',
            value: {
              id: 'pro-plan',
              is_active: true,
              amount: 49.99,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      stateChanges: [
        {
          entity: 'Subscription',
          lookup: { id: { type: 'reference', path: 'input.subscription_id' } },
          property: 'plan_id',
          expected: { type: 'literal', value: 'pro-plan' },
        },
      ],
    },
    tags: ['payments', 'plan-change', 'upgrade', 'positive'],
    priority: 'high',
  });

  // Test: Same plan error
  tests.push({
    id: `${behaviorName}_payments_same_plan`,
    name: 'should reject change to same plan',
    description: 'Tests that changing to the same plan is rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 4,
      expression: 'Subscription.lookup(input.subscription_id).plan_id != input.new_plan_id',
    },
    input: {
      params: {
        subscription_id: { type: 'generated', generator: { kind: 'uuid' } },
        new_plan_id: { type: 'literal', value: 'current-plan' },
      },
      mocks: [
        {
          entity: 'Subscription',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              status: 'ACTIVE',
              plan_id: 'current-plan',
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'SAME_PLAN',
    },
    tags: ['payments', 'plan-change', 'negative'],
    priority: 'medium',
  });

  return tests;
}

function generatePaymentMethodTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Invalid payment method
  tests.push({
    id: `${behaviorName}_payments_invalid_method`,
    name: 'should reject invalid payment method',
    description: 'Tests handling of invalid payment methods',
    behaviorName,
    testType: 'negative',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'PaymentMethod.valid(input.payment_method_id)',
    },
    input: {
      params: {
        payment_method_id: { type: 'literal', value: 'pm_invalid' },
      },
      mocks: [
        {
          entity: 'Stripe',
          method: 'retrievePaymentMethod',
          returns: {
            type: 'literal',
            value: { error: { code: 'resource_missing', message: 'No such payment method' } },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_PAYMENT_METHOD',
    },
    tags: ['payments', 'payment-method', 'negative'],
    priority: 'high',
  });

  return tests;
}

function generateInvoiceTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Upcoming invoice preview
  if (behaviorName.includes('Upcoming')) {
    tests.push({
      id: `${behaviorName}_payments_upcoming_invoice`,
      name: 'should preview upcoming invoice',
      description: 'Tests preview of next invoice with line items',
      behaviorName,
      testType: 'postcondition_success',
      sourceClause: {
        clauseType: 'postcondition',
        index: 0,
        expression: 'result.amount_due >= 0',
      },
      input: {
        params: {
          subscription_id: { type: 'generated', generator: { kind: 'uuid' } },
        },
      },
      expected: {
        outcome: 'success',
        assertions: [
          { path: 'result.amount_due', operator: 'greater_than', expected: { type: 'literal', value: -1 } },
          { path: 'result.line_items', operator: 'is_not_null', expected: { type: 'literal', value: null } },
        ],
      },
      tags: ['payments', 'invoice', 'positive'],
      priority: 'medium',
    });
  }

  return tests;
}

export default paymentsStrategy;
