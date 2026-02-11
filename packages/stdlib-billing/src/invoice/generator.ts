/**
 * Invoice generator — creates, finalizes, pays, and voids invoices.
 * All money math uses bigint via the Money class.
 */

import { Money } from '../money.js';
import { InvoiceStatus, CollectionMethod } from '../types.js';
import {
  InvoiceNotFoundError,
  InvoiceNotPayableError,
  InvoiceNotVoidableError,
} from '../errors.js';
import { InvoiceNumbering } from './numbering.js';
import type {
  Invoice,
  LineItem,
  TaxLine,
  CreateInvoiceInput,
  PayInvoiceInput,
  PayInvoiceResult,
} from './types.js';

// ============================================================================
// INVOICE GENERATOR
// ============================================================================

export class InvoiceGenerator {
  private invoices = new Map<string, Invoice>();
  private numbering: InvoiceNumbering;
  private idCounter = 0;

  constructor(numbering?: InvoiceNumbering) {
    this.numbering = numbering ?? new InvoiceNumbering();
  }

  /**
   * Create a new draft invoice from input.
   * Computes subtotal, tax, discount, total — all in bigint cents.
   */
  create(input: CreateInvoiceInput): Invoice {
    const id = `inv_${++this.idCounter}`;
    const now = new Date();
    const currency = input.currency;

    // Build line items
    const lineItems: LineItem[] = input.lineItems.map((li, i) => {
      const unit = Money.fromCents(li.unitAmountCents, currency);
      const amount = unit.multiply(li.quantity);
      return {
        id: `li_${id}_${i}`,
        description: li.description,
        quantity: li.quantity,
        unitAmount: unit,
        amount,
      };
    });

    // Subtotal
    const subtotal = lineItems.reduce(
      (sum, li) => sum.add(li.amount),
      Money.zero(currency),
    );

    // Discount
    let discount = Money.zero(currency);
    if (input.discountPercent !== undefined && input.discountPercent > 0) {
      discount = subtotal.percentage(input.discountPercent);
    } else if (input.discountFixedCents !== undefined) {
      discount = Money.min(
        Money.fromCents(input.discountFixedCents, currency),
        subtotal,
      );
    }

    const afterDiscount = subtotal.subtract(discount);

    // Tax lines
    const taxLines: TaxLine[] = (input.taxLines ?? []).map((tl) => {
      const taxAmount = afterDiscount.percentage(tl.rate);
      return {
        description: tl.description,
        rate: tl.rate,
        amount: taxAmount,
        inclusive: tl.inclusive ?? false,
      };
    });

    const taxTotal = taxLines
      .filter((t) => !t.inclusive)
      .reduce((sum, t) => sum.add(t.amount), Money.zero(currency));

    // Total = subtotal - discount + exclusive tax
    const total = afterDiscount.add(taxTotal);

    const invoice: Invoice = {
      id,
      customerId: input.customerId,
      subscriptionId: input.subscriptionId,
      status: InvoiceStatus.DRAFT,
      subtotal,
      tax: taxTotal,
      discount,
      total,
      amountDue: total,
      amountPaid: Money.zero(currency),
      amountRemaining: total,
      currency,
      lineItems,
      taxLines,
      dueDate: input.dueDate,
      paid: false,
      collectionMethod:
        input.collectionMethod ?? CollectionMethod.CHARGE_AUTOMATICALLY,
      attemptCount: 0,
      billingReason: input.billingReason,
      metadata: input.metadata,
      provider: 'internal',
      createdAt: now,
    };

    this.invoices.set(id, invoice);
    return invoice;
  }

  getInvoice(invoiceId: string): Invoice | undefined {
    return this.invoices.get(invoiceId);
  }

  /**
   * Finalize a draft invoice — assigns a number and moves to OPEN.
   */
  finalize(invoiceId: string): Invoice {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new InvoiceNotFoundError(invoiceId);
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw new InvoiceNotVoidableError(invoiceId, inv.status);
    }

    const updated: Invoice = {
      ...inv,
      status: InvoiceStatus.OPEN,
      number: this.numbering.next(),
      finalizedAt: new Date(),
    };
    this.invoices.set(invoiceId, updated);
    return updated;
  }

  /**
   * Pay an invoice (full or partial).
   */
  pay(input: PayInvoiceInput): PayInvoiceResult {
    const inv = this.invoices.get(input.invoiceId);
    if (!inv) throw new InvoiceNotFoundError(input.invoiceId);

    if (inv.status !== InvoiceStatus.OPEN && inv.status !== InvoiceStatus.DRAFT) {
      throw new InvoiceNotPayableError(input.invoiceId, inv.status);
    }

    const payAmount =
      input.amountCents !== undefined
        ? Money.fromCents(input.amountCents, inv.currency)
        : inv.amountRemaining;

    const cappedPay = Money.min(payAmount, inv.amountRemaining);
    const newPaid = inv.amountPaid.add(cappedPay);
    const newRemaining = inv.amountRemaining.subtract(cappedPay);
    const fullyPaid = newRemaining.isZero();
    const now = new Date();

    const updated: Invoice = {
      ...inv,
      status: fullyPaid ? InvoiceStatus.PAID : inv.status === InvoiceStatus.DRAFT ? InvoiceStatus.OPEN : inv.status,
      amountPaid: newPaid,
      amountRemaining: newRemaining,
      paid: fullyPaid,
      paidAt: fullyPaid ? now : inv.paidAt,
      attemptCount: inv.attemptCount + 1,
    };

    this.invoices.set(input.invoiceId, updated);
    return { invoice: updated };
  }

  /**
   * Void an invoice. Only DRAFT or OPEN invoices can be voided.
   */
  void(invoiceId: string): Invoice {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new InvoiceNotFoundError(invoiceId);

    if (inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.OPEN) {
      throw new InvoiceNotVoidableError(invoiceId, inv.status);
    }

    const updated: Invoice = {
      ...inv,
      status: InvoiceStatus.VOID,
      voidedAt: new Date(),
    };
    this.invoices.set(invoiceId, updated);
    return updated;
  }

  /**
   * Mark an invoice as uncollectible.
   */
  markUncollectible(invoiceId: string): Invoice {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new InvoiceNotFoundError(invoiceId);

    if (inv.status !== InvoiceStatus.OPEN) {
      throw new InvoiceNotPayableError(invoiceId, inv.status);
    }

    const updated: Invoice = {
      ...inv,
      status: InvoiceStatus.UNCOLLECTIBLE,
    };
    this.invoices.set(invoiceId, updated);
    return updated;
  }
}
