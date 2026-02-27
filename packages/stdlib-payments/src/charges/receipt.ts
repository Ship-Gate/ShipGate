/**
 * Receipt handling implementation
 * @packageDocumentation
 */

import { PaymentId, Currency } from '../types';
import { Charge } from './types';
import { Receipt } from '../types';
import { PaymentError, ValidationError } from '../errors';

// ============================================================================
// RECEIPT TYPES
// ============================================================================

export interface ReceiptOptions {
  paymentId: PaymentId;
  email?: string;
  phone?: string;
  template?: ReceiptTemplate;
  customFields?: ReceiptField[];
  includeTaxDetails?: boolean;
  includeShippingDetails?: boolean;
  language?: string;
}

export interface ReceiptTemplate {
  id: string;
  name: string;
  header?: string;
  footer?: string;
  logo?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    text?: string;
    background?: string;
  };
  fonts?: {
    header?: string;
    body?: string;
  };
}

export interface ReceiptField {
  key: string;
  label: string;
  value: string | number;
  type: 'text' | 'currency' | 'date' | 'boolean';
  order?: number;
}

export interface ReceiptLineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: bigint;
  amount: bigint;
  currency: Currency;
  tax?: bigint;
  discount?: bigint;
  metadata?: Record<string, string>;
}

export interface ReceiptData {
  receipt: Receipt;
  charge: Charge;
  lineItems: ReceiptLineItem[];
  billing?: BillingDetails;
  shipping?: ShippingDetails;
  taxDetails?: TaxDetails;
  paymentDetails?: PaymentDetails;
}

export interface BillingDetails {
  name: string;
  email: string;
  phone?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

export interface ShippingDetails {
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  method?: string;
  trackingNumber?: string;
}

export interface TaxDetails {
  subtotal: bigint;
  taxRate: number;
  taxAmount: bigint;
  inclusive: boolean;
  jurisdiction?: string;
  breakdown?: TaxBreakdown[];
}

export interface TaxBreakdown {
  name: string;
  rate: number;
  amount: bigint;
}

export interface PaymentDetails {
  method: string;
  last4?: string;
  brand?: string;
  wallet?: string;
  bank?: string;
  description?: string;
}

// ============================================================================
// RECEIPT MANAGER
// ============================================================================

export class ReceiptManager {
  private receipts = new Map<string, ReceiptData>();
  private templates = new Map<string, ReceiptTemplate>();

  constructor() {
    // Initialize default template
    this.addTemplate({
      id: 'default',
      name: 'Default Receipt',
      header: 'Payment Receipt',
      colors: {
        primary: '#007bff',
        text: '#333333',
        background: '#ffffff',
      },
    });
  }

  // ============================================================================
  // RECEIPT CREATION
  // ============================================================================

  /**
   * Create a receipt for a charge
   */
  async createReceipt(charge: Charge, options: ReceiptOptions): Promise<Receipt> {
    // Validate charge
    if (!charge.paid) {
      throw new PaymentError(
        'Cannot create receipt for unpaid charge',
        'charge_not_paid',
        'validation_error'
      );
    }

    // Generate receipt number
    const receiptNumber = this.generateReceiptNumber();

    // Create receipt
    const receipt: Receipt = {
      id: Math.random().toString(36).substr(2, 9),
      paymentId: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status as any, // This would be mapped properly
      receiptNumber,
      createdAt: new Date(),
    };

    // Store receipt data
    const receiptData: ReceiptData = {
      receipt,
      charge,
      lineItems: this.extractLineItems(charge),
      billing: this.extractBillingDetails(charge),
      shipping: this.extractShippingDetails(charge),
      taxDetails: this.extractTaxDetails(charge),
      paymentDetails: this.extractPaymentDetails(charge),
    };

    this.receipts.set(receipt.id, receiptData);

    // Generate receipt URL
    receipt.receiptUrl = await this.generateReceiptUrl(receipt.id);

    // Send receipt if email provided
    if (options.email) {
      await this.sendReceiptEmail(receipt.id, options.email);
    }

    return receipt;
  }

  /**
   * Retrieve a receipt
   */
  async retrieveReceipt(receiptId: string): Promise<ReceiptData | null> {
    return this.receipts.get(receiptId) || null;
  }

  /**
   * Get receipt by payment ID
   */
  async getReceiptByPaymentId(paymentId: PaymentId): Promise<ReceiptData | null> {
    for (const receiptData of this.receipts.values()) {
      if (receiptData.receipt.paymentId === paymentId) {
        return receiptData;
      }
    }
    return null;
  }

  // ============================================================================
  // RECEIPT GENERATION
  // ============================================================================

  /**
   * Generate receipt URL
   */
  private async generateReceiptUrl(receiptId: string): Promise<string> {
    // In a real implementation, this would generate a secure URL
    // For now, return a placeholder
    return `https://receipts.example.com/${receiptId}`;
  }

  /**
   * Generate receipt as HTML
   */
  async generateReceiptHtml(receiptId: string, templateId?: string): Promise<string> {
    const receiptData = this.receipts.get(receiptId);
    if (!receiptData) {
      throw new ValidationError(
        'Receipt not found',
        'receiptId',
        receiptId,
        'exists'
      );
    }

    const template = this.getTemplate(templateId || 'default');
    
    return this.renderHtmlReceipt(receiptData, template);
  }

  /**
   * Generate receipt as PDF
   */
  async generateReceiptPdf(receiptId: string, templateId?: string): Promise<Buffer> {
    const html = await this.generateReceiptHtml(receiptId, templateId);
    
    // In a real implementation, this would use a PDF library
    // For now, return a mock PDF buffer
    return Buffer.from(`PDF Receipt for ${receiptId}`);
  }

  // ============================================================================
  // EMAIL DELIVERY
  // ============================================================================

  /**
   * Send receipt via email
   */
  async sendReceiptEmail(receiptId: string, email: string, options?: {
    subject?: string;
    attachPdf?: boolean;
    customMessage?: string;
  }): Promise<void> {
    const receiptData = this.receipts.get(receiptId);
    if (!receiptData) {
      throw new ValidationError(
        'Receipt not found',
        'receiptId',
        receiptId,
        'exists'
      );
    }

    // In a real implementation, this would send an email
    console.log(`Sending receipt ${receiptId} to ${email}`);
  }

  /**
   * Send receipt via SMS
   */
  async sendReceiptSms(receiptId: string, phone: string): Promise<void> {
    const receiptData = this.receipts.get(receiptId);
    if (!receiptData) {
      throw new ValidationError(
        'Receipt not found',
        'receiptId',
        receiptId,
        'exists'
      );
    }

    // In a real implementation, this would send an SMS
    console.log(`Sending receipt ${receiptId} to ${phone}`);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Add a receipt template
   */
  addTemplate(template: ReceiptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a receipt template
   */
  getTemplate(templateId: string): ReceiptTemplate {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new ValidationError(
        'Template not found',
        'templateId',
        templateId,
        'exists'
      );
    }
    return template;
  }

  /**
   * List all templates
   */
  listTemplates(): ReceiptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Update a template
   */
  updateTemplate(templateId: string, updates: Partial<ReceiptTemplate>): void {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new ValidationError(
        'Template not found',
        'templateId',
        templateId,
        'exists'
      );
    }

    const updatedTemplate = { ...template, ...updates };
    this.templates.set(templateId, updatedTemplate);
  }

  /**
   * Delete a template
   */
  deleteTemplate(templateId: string): void {
    if (templateId === 'default') {
      throw new ValidationError(
        'Cannot delete default template',
        'templateId',
        templateId,
        'immutable'
      );
    }

    this.templates.delete(templateId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate receipt number
   */
  private generateReceiptNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `RCP-${year}${month}${day}-${random}`;
  }

  /**
   * Extract line items from charge
   */
  private extractLineItems(charge: Charge): ReceiptLineItem[] {
    // In a real implementation, this would extract from charge metadata
    // For now, create a single line item
    return [{
      id: 'li_1',
      name: charge.description || 'Payment',
      quantity: 1,
      unitPrice: charge.amount,
      amount: charge.amount,
      currency: charge.currency,
    }];
  }

  /**
   * Extract billing details from charge
   */
  private extractBillingDetails(charge: Charge): BillingDetails | undefined {
    // In a real implementation, this would extract from charge metadata
    return undefined;
  }

  /**
   * Extract shipping details from charge
   */
  private extractShippingDetails(charge: Charge): ShippingDetails | undefined {
    // In a real implementation, this would extract from charge metadata
    return undefined;
  }

  /**
   * Extract tax details from charge
   */
  private extractTaxDetails(charge: Charge): TaxDetails | undefined {
    // In a real implementation, this would extract from charge metadata
    return undefined;
  }

  /**
   * Extract payment details from charge
   */
  private extractPaymentDetails(charge: Charge): PaymentDetails {
    return {
      method: 'card', // This would be extracted from payment method
      description: charge.description,
    };
  }

  /**
   * Render HTML receipt
   */
  private renderHtmlReceipt(data: ReceiptData, template: ReceiptTemplate): string {
    const { receipt, charge, lineItems } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt #${receipt.receiptNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: ${template.colors?.background || '#fff'}; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; color: ${template.colors?.primary || '#007bff'}; }
        .header h1 { margin: 0; font-size: 28px; }
        .receipt-info { display: flex; justify-content: space-between; margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .line-items { margin-bottom: 30px; }
        .line-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .line-item:last-child { border-bottom: none; font-weight: bold; }
        .total { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${template.header || 'Payment Receipt'}</h1>
        </div>
        
        <div class="receipt-info">
            <div>
                <strong>Receipt #:</strong> ${receipt.receiptNumber}<br>
                <strong>Date:</strong> ${receipt.createdAt.toLocaleDateString()}
            </div>
            <div>
                <strong>Payment ID:</strong> ${charge.id}<br>
                <strong>Status:</strong> ${charge.status}
            </div>
        </div>
        
        <div class="line-items">
            ${lineItems.map(item => `
                <div class="line-item">
                    <span>${item.name} x${item.quantity}</span>
                    <span>${this.formatCurrency(item.amount, item.currency)}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="total">
            Total: ${this.formatCurrency(charge.amount, charge.currency)}
        </div>
        
        <div class="footer">
            ${template.footer || 'Thank you for your payment!'}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: bigint, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    });
    
    return formatter.format(Number(amount) / 100);
  }
}
