/**
 * Billing error hierarchy.
 */

export class BillingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retriable: boolean = false,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export class CustomerNotFoundError extends BillingError {
  constructor(customerId: string) {
    super('CUSTOMER_NOT_FOUND', `Customer not found: ${customerId}`);
  }
}

export class PlanNotFoundError extends BillingError {
  constructor(planId: string) {
    super('PLAN_NOT_FOUND', `Plan not found: ${planId}`);
  }
}

export class SubscriptionNotFoundError extends BillingError {
  constructor(subscriptionId: string) {
    super('SUBSCRIPTION_NOT_FOUND', `Subscription not found: ${subscriptionId}`);
  }
}

export class InvoiceNotFoundError extends BillingError {
  constructor(invoiceId: string) {
    super('INVOICE_NOT_FOUND', `Invoice not found: ${invoiceId}`);
  }
}

export class PaymentFailedError extends BillingError {
  constructor(message: string, public readonly declineCode?: string) {
    super('PAYMENT_FAILED', message, true, 5000);
  }
}

export class PaymentMethodRequiredError extends BillingError {
  constructor() {
    super('PAYMENT_METHOD_REQUIRED', 'No payment method on file');
  }
}

export class InvalidTransitionError extends BillingError {
  constructor(from: string, to: string, entity: string = 'Subscription') {
    super(
      'INVALID_TRANSITION',
      `${entity}: invalid transition from ${from} to ${to}`,
    );
  }
}

export class InvalidMoneyOperationError extends BillingError {
  constructor(message: string) {
    super('INVALID_MONEY_OPERATION', message);
  }
}

export class CurrencyMismatchError extends BillingError {
  constructor(a: string, b: string) {
    super('CURRENCY_MISMATCH', `Cannot operate on different currencies: ${a} vs ${b}`);
  }
}

export class InvoiceNotPayableError extends BillingError {
  constructor(invoiceId: string, status: string) {
    super('INVOICE_NOT_PAYABLE', `Invoice ${invoiceId} is not payable (status: ${status})`);
  }
}

export class InvoiceNotVoidableError extends BillingError {
  constructor(invoiceId: string, status: string) {
    super('INVOICE_NOT_VOIDABLE', `Invoice ${invoiceId} cannot be voided (status: ${status})`);
  }
}

export class MeteringError extends BillingError {
  constructor(message: string) {
    super('METERING_ERROR', message);
  }
}
