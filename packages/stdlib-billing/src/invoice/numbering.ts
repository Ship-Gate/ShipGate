/**
 * Invoice number generation.
 * Produces sequential, human-readable invoice numbers.
 */

export interface InvoiceNumberingOptions {
  prefix?: string;
  separator?: string;
  padWidth?: number;
}

export class InvoiceNumbering {
  private counter: number;
  private readonly prefix: string;
  private readonly separator: string;
  private readonly padWidth: number;

  constructor(startFrom: number = 1, options: InvoiceNumberingOptions = {}) {
    this.counter = startFrom;
    this.prefix = options.prefix ?? 'INV';
    this.separator = options.separator ?? '-';
    this.padWidth = options.padWidth ?? 6;
  }

  /** Generate the next invoice number. */
  next(): string {
    const num = this.counter++;
    const padded = num.toString().padStart(this.padWidth, '0');
    return `${this.prefix}${this.separator}${padded}`;
  }

  /** Peek at the next number without advancing. */
  peek(): string {
    const padded = this.counter.toString().padStart(this.padWidth, '0');
    return `${this.prefix}${this.separator}${padded}`;
  }

  /** Current counter value. */
  current(): number {
    return this.counter;
  }
}
