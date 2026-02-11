/**
 * Invoice template — plain-text rendering of an invoice for display / PDF.
 */

import type { Invoice } from './types.js';

export interface InvoiceTemplateOptions {
  companyName?: string;
  companyAddress?: string;
  footerText?: string;
  locale?: string;
}

/**
 * Render an invoice to a plain-text string.
 */
export function renderInvoiceText(
  invoice: Invoice,
  options: InvoiceTemplateOptions = {},
): string {
  const locale = options.locale ?? 'en-US';
  const lines: string[] = [];

  lines.push('='.repeat(60));
  if (options.companyName) lines.push(options.companyName);
  if (options.companyAddress) lines.push(options.companyAddress);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Invoice: ${invoice.number ?? invoice.id}`);
  lines.push(`Date:    ${invoice.createdAt.toLocaleDateString(locale)}`);
  if (invoice.dueDate) {
    lines.push(`Due:     ${invoice.dueDate.toLocaleDateString(locale)}`);
  }
  lines.push(`Status:  ${invoice.status.toUpperCase()}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(
    padRight('Item', 30) +
    padRight('Qty', 6) +
    padRight('Unit', 12) +
    padRight('Amount', 12),
  );
  lines.push('-'.repeat(60));

  for (const item of invoice.lineItems) {
    lines.push(
      padRight(item.description, 30) +
      padRight(String(item.quantity), 6) +
      padRight(item.unitAmount.toDisplayString(locale), 12) +
      padRight(item.amount.toDisplayString(locale), 12),
    );
  }

  lines.push('-'.repeat(60));
  lines.push(padRight('Subtotal:', 48) + invoice.subtotal.toDisplayString(locale));

  if (!invoice.discount.isZero()) {
    lines.push(padRight('Discount:', 48) + `-${invoice.discount.toDisplayString(locale)}`);
  }

  if (!invoice.tax.isZero()) {
    lines.push(padRight('Tax:', 48) + invoice.tax.toDisplayString(locale));
  }

  lines.push('='.repeat(60));
  lines.push(padRight('TOTAL:', 48) + invoice.total.toDisplayString(locale));
  lines.push(padRight('Paid:', 48) + invoice.amountPaid.toDisplayString(locale));
  lines.push(padRight('Remaining:', 48) + invoice.amountRemaining.toDisplayString(locale));
  lines.push('='.repeat(60));

  if (options.footerText) {
    lines.push('');
    lines.push(options.footerText);
  }

  return lines.join('\n');
}

function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}
