/**
 * Email Client
 * 
 * Main client for sending emails with templating and provider abstraction.
 */

import type {
  EmailMessage,
  EmailTemplate,
  EmailDeliveryResult,
  EmailBatch,
  BatchRecipient,
  NormalizedEmail,
  NormalizedAttachment,
  EmailAddress,
  EmailProvider,
  TemplateEngine,
  EmailConfig,
  DeliveryStats,
  AttachmentDisposition,
} from './types.js';

import { createProvider } from './providers/index.js';
import { createTemplateEngine } from './templates/engine.js';

/**
 * Email client for sending emails
 */
export class EmailClient {
  private config: EmailConfig;
  private providers: Map<string, EmailProvider> = new Map();
  private templateEngine: TemplateEngine;
  private templates: Map<string, EmailTemplate> = new Map();
  
  constructor(config: EmailConfig) {
    this.config = config;
    this.templateEngine = createTemplateEngine(
      config.templates?.engine as 'simple' | 'handlebars' || 'simple'
    );
    
    // Initialize providers
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const provider = createProvider(name as any, providerConfig);
      this.providers.set(name, provider);
    }
  }
  
  /**
   * Send a single email
   */
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    // Normalize message
    const normalized = await this.normalizeMessage(message);
    
    // Get provider
    const provider = this.getProvider();
    
    // Send
    return provider.send(normalized);
  }
  
  /**
   * Send email using a template
   */
  async sendTemplated(
    templateSlug: string,
    options: {
      to: (EmailAddress | string)[];
      cc?: (EmailAddress | string)[];
      bcc?: (EmailAddress | string)[];
      replyTo?: EmailAddress | string;
      data: Record<string, unknown>;
      tags?: string[];
      scheduledAt?: Date;
    }
  ): Promise<EmailDeliveryResult> {
    // Get template
    const template = this.templates.get(templateSlug);
    if (!template) {
      throw new Error(`Template not found: ${templateSlug}`);
    }
    
    // Validate template data
    this.validateTemplateData(template, options.data);
    
    // Render template
    const rendered = await this.renderTemplate(template, options.data);
    
    // Create message
    const message: EmailMessage = {
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tags: options.tags,
      templateId: template.id,
      templateData: options.data,
      scheduledAt: options.scheduledAt,
      from: this.getDefaultFrom(),
    };
    
    return this.send(message);
  }
  
  /**
   * Send batch emails
   */
  async sendBatch(
    templateId: string,
    recipients: BatchRecipient[],
    options?: {
      name?: string;
      rateLimit?: number;
    }
  ): Promise<EmailBatch> {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    const batch: EmailBatch = {
      id: generateId(),
      name: options?.name || `Batch ${new Date().toISOString()}`,
      templateId,
      recipients: recipients.map(r => ({
        ...r,
        status: 'pending',
      })),
      status: 'processing',
      totalCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      startedAt: new Date(),
      createdAt: new Date(),
    };
    
    // Process batch asynchronously
    this.processBatch(batch, template, options?.rateLimit);
    
    return batch;
  }
  
  /**
   * Register a template
   */
  registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.slug, template);
  }
  
  /**
   * Render a template for preview
   */
  async renderTemplate(
    template: EmailTemplate,
    data: Record<string, unknown>
  ): Promise<{ subject: string; text?: string; html?: string }> {
    const subject = await this.templateEngine.render(template.subject, data);
    
    let text: string | undefined;
    let html: string | undefined;
    
    if (template.textTemplate) {
      text = await this.templateEngine.render(template.textTemplate, data);
    }
    
    if (template.htmlTemplate) {
      html = await this.templateEngine.render(template.htmlTemplate, data);
    }
    
    return { subject, text, html };
  }
  
  /**
   * Validate email address
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }
  
  /**
   * Get delivery statistics
   */
  async getStats(
    startDate: Date,
    endDate: Date,
    options?: { tags?: string[] }
  ): Promise<DeliveryStats> {
    // This would query a database in a real implementation
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
    };
  }
  
  // Private methods
  
  private getProvider(name?: string): EmailProvider {
    const providerName = name || this.config.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    
    return provider;
  }
  
  private getDefaultFrom(): EmailAddress | string {
    const defaultProvider = this.config.providers[this.config.defaultProvider];
    return defaultProvider?.from || 'noreply@example.com';
  }
  
  private getTemplateById(id: string): EmailTemplate | undefined {
    for (const template of this.templates.values()) {
      if (template.id === id) {
        return template;
      }
    }
    return undefined;
  }
  
  private async normalizeMessage(message: EmailMessage): Promise<NormalizedEmail> {
    const id = message.id || generateId();
    
    // Render template if specified
    let subject = message.subject;
    let text = message.text;
    let html = message.html;
    
    if (message.templateId && message.templateData) {
      const template = this.getTemplateById(message.templateId);
      if (template) {
        const rendered = await this.renderTemplate(template, message.templateData);
        subject = rendered.subject;
        text = rendered.text;
        html = rendered.html;
      }
    }
    
    return {
      id,
      from: normalizeAddress(message.from),
      to: (message.to || []).map(normalizeAddress),
      cc: (message.cc || []).map(normalizeAddress),
      bcc: (message.bcc || []).map(normalizeAddress),
      replyTo: message.replyTo ? normalizeAddress(message.replyTo) : undefined,
      subject,
      text,
      html,
      attachments: await this.normalizeAttachments(message.attachments || []),
      headers: message.headers || {},
      priority: message.priority || 'normal',
      tags: message.tags || [],
      metadata: message.metadata || {},
    };
  }
  
  private async normalizeAttachments(
    attachments: EmailMessage['attachments']
  ): Promise<NormalizedAttachment[]> {
    if (!attachments) return [];
    
    return attachments.map(a => ({
      filename: a.filename,
      content: typeof a.content === 'string' 
        ? Buffer.from(a.content, a.encoding || 'utf8')
        : a.content,
      contentType: a.contentType,
      contentId: a.contentId,
      disposition: (a.disposition || 'attachment') as AttachmentDisposition,
      size: typeof a.content === 'string' 
        ? Buffer.byteLength(a.content, a.encoding || 'utf8')
        : a.content.length,
    }));
  }
  
  private validateTemplateData(
    template: EmailTemplate,
    data: Record<string, unknown>
  ): void {
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in data)) {
        throw new Error(`Missing required template variable: ${variable.name}`);
      }
      
      if (variable.validation && variable.name in data) {
        const regex = new RegExp(variable.validation);
        if (!regex.test(String(data[variable.name]))) {
          throw new Error(
            `Validation failed for variable '${variable.name}': ${variable.validation}`
          );
        }
      }
    }
  }
  
  private async processBatch(
    batch: EmailBatch,
    template: EmailTemplate,
    rateLimit?: number
  ): Promise<void> {
    const provider = this.getProvider();
    const delay = rateLimit ? 1000 / rateLimit : 100;
    
    for (const recipient of batch.recipients) {
      try {
        // Render for this recipient
        const rendered = await this.renderTemplate(template, recipient.data);
        
        // Send
        const message: NormalizedEmail = {
          id: generateId(),
          from: normalizeAddress(this.getDefaultFrom()),
          to: [normalizeAddress(recipient.email)],
          cc: [],
          bcc: [],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          attachments: [],
          headers: {},
          priority: 'normal',
          tags: [],
          metadata: { batchId: batch.id },
        };
        
        await provider.send(message);
        
        recipient.status = 'sent';
        recipient.sentAt = new Date();
        batch.sentCount++;
      } catch (error) {
        recipient.status = 'failed';
        recipient.error = error instanceof Error ? error.message : String(error);
        batch.failedCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    batch.status = batch.failedCount === batch.totalCount ? 'failed' : 'completed';
    batch.completedAt = new Date();
  }
}

// Utility functions

function normalizeAddress(address: EmailAddress | string): EmailAddress {
  if (typeof address === 'string') {
    // Parse "Name <email>" format
    const match = address.match(/^(.+?)\s*<(.+)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { email: address };
  }
  return address;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create email client instance
 */
export function createEmailClient(config: EmailConfig): EmailClient {
  return new EmailClient(config);
}
