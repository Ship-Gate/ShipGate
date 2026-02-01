/**
 * Email Notification Implementation
 * 
 * Send email notifications with template support.
 */

import { randomUUID } from 'crypto';
import { 
  templateStore, 
  renderTemplate, 
  type Template 
} from './index.js';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationId = string;
export type Email = string;

export type NotificationStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'CLICKED'
  | 'FAILED'
  | 'BOUNCED'
  | 'UNSUBSCRIBED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type BounceType = 'HARD' | 'SOFT' | 'COMPLAINT';

export interface Attachment {
  filename: string;
  contentType: string;
  content: string;  // Base64 encoded
  size: number;
}

export interface EmailNotification {
  id: NotificationId;
  channel: 'EMAIL';
  recipient: Email;
  cc?: Email[];
  bcc?: Email[];
  replyTo?: Email;
  templateId: string;
  variables: Map<string, string>;
  subject?: string;
  body?: string;
  htmlBody?: string;
  attachments?: Attachment[];
  fromAddress?: string;
  fromName?: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  senderId: string;
  campaignId?: string;
  tags: Map<string, string>;
  correlationId?: string;
  createdAt: Date;
  scheduledAt?: Date;
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  failedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  bounceType?: BounceType;
  bounceReason?: string;
  provider?: string;
  providerMessageId?: string;
  retryCount: number;
  maxRetries: number;
}

export interface SendEmailInput {
  to: Email;
  cc?: Email[];
  bcc?: Email[];
  replyTo?: Email;
  templateId: string;
  variables?: Record<string, string>;
  subject?: string;
  body?: string;
  htmlBody?: string;
  attachments?: Attachment[];
  fromAddress?: string;
  fromName?: string;
  priority?: NotificationPriority;
  scheduledAt?: Date;
  campaignId?: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface SendEmailDirectInput {
  to: Email;
  cc?: Email[];
  bcc?: Email[];
  replyTo?: Email;
  subject: string;
  body: string;
  htmlBody?: string;
  fromAddress?: string;
  fromName?: string;
  attachments?: Attachment[];
  priority?: NotificationPriority;
  tags?: Record<string, string>;
}

// ============================================================================
// ERRORS
// ============================================================================

export class EmailError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

// ============================================================================
// EMAIL STORE
// ============================================================================

export class EmailStore {
  private notifications: Map<NotificationId, EmailNotification> = new Map();
  private idempotencyCache: Map<string, NotificationId> = new Map();
  private unsubscribeList: Set<Email> = new Set();
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();
  
  // Provider simulation
  private providers: EmailProvider[] = [];
  private defaultProvider: EmailProvider;

  constructor() {
    this.defaultProvider = new MockEmailProvider();
    this.providers.push(this.defaultProvider);
  }

  // ==========================================================================
  // SEND EMAIL
  // ==========================================================================

  async sendEmail(input: SendEmailInput, senderId: string): Promise<EmailNotification> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existingId = this.idempotencyCache.get(input.idempotencyKey);
      if (existingId) {
        const existing = this.notifications.get(existingId);
        if (existing) return existing;
      }
    }

    // Validate email format
    if (!this.isValidEmail(input.to)) {
      throw new EmailError('INVALID_RECIPIENT', `Invalid email address: ${input.to}`);
    }

    // Check unsubscribe list
    if (this.unsubscribeList.has(input.to.toLowerCase())) {
      throw new EmailError('RECIPIENT_UNSUBSCRIBED', 'Recipient has unsubscribed');
    }

    // Check rate limits
    this.checkRateLimit(senderId, input.to);

    // Get and validate template
    const template = templateStore.getTemplate(input.templateId);
    if (!template) {
      throw new EmailError('TEMPLATE_NOT_FOUND', `Template not found: ${input.templateId}`);
    }
    if (template.channel !== 'EMAIL') {
      throw new EmailError('INVALID_TEMPLATE', 'Template is not for email channel');
    }
    if (!template.active) {
      throw new EmailError('TEMPLATE_INACTIVE', 'Template is not active');
    }

    // Validate variables
    const variables = new Map(Object.entries(input.variables ?? {}));
    const missingVars = this.validateVariables(template, variables);
    if (missingVars.length > 0) {
      throw new EmailError(
        'MISSING_VARIABLE',
        `Missing required variables: ${missingVars.join(', ')}`,
        false,
        undefined,
        { missing: missingVars }
      );
    }

    // Validate attachments
    if (input.attachments) {
      const totalSize = input.attachments.reduce((sum, a) => sum + a.size, 0);
      if (totalSize > 26214400) {
        throw new EmailError('ATTACHMENTS_TOO_LARGE', 'Total attachment size exceeds 25MB');
      }
    }

    // Render template
    const rendered = renderTemplate(template, variables);

    // Create notification
    const notification: EmailNotification = {
      id: randomUUID(),
      channel: 'EMAIL',
      recipient: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      templateId: input.templateId,
      variables,
      subject: rendered.subject ?? input.subject,
      body: rendered.body,
      htmlBody: rendered.htmlBody ?? input.htmlBody,
      attachments: input.attachments,
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      senderId,
      campaignId: input.campaignId,
      tags: new Map(Object.entries(input.tags ?? {})),
      createdAt: new Date(),
      scheduledAt: input.scheduledAt,
      retryCount: 0,
      maxRetries: 3,
    };

    this.notifications.set(notification.id, notification);

    // Cache idempotency key
    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, notification.id);
    }

    // Send if not scheduled
    if (!input.scheduledAt || input.scheduledAt <= new Date()) {
      await this.processNotification(notification);
    } else {
      notification.status = 'QUEUED';
      notification.queuedAt = new Date();
    }

    return notification;
  }

  // ==========================================================================
  // SEND EMAIL DIRECT
  // ==========================================================================

  async sendEmailDirect(input: SendEmailDirectInput, senderId: string): Promise<EmailNotification> {
    // Validate email format
    if (!this.isValidEmail(input.to)) {
      throw new EmailError('INVALID_RECIPIENT', `Invalid email address: ${input.to}`);
    }

    // Check unsubscribe list
    if (this.unsubscribeList.has(input.to.toLowerCase())) {
      throw new EmailError('RECIPIENT_UNSUBSCRIBED', 'Recipient has unsubscribed');
    }

    // Check rate limits
    this.checkRateLimit(senderId, input.to);

    // Validate attachments
    if (input.attachments) {
      const totalSize = input.attachments.reduce((sum, a) => sum + a.size, 0);
      if (totalSize > 26214400) {
        throw new EmailError('ATTACHMENTS_TOO_LARGE', 'Total attachment size exceeds 25MB');
      }
    }

    // Create notification
    const notification: EmailNotification = {
      id: randomUUID(),
      channel: 'EMAIL',
      recipient: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      templateId: '_direct',
      variables: new Map(),
      subject: input.subject,
      body: input.body,
      htmlBody: input.htmlBody,
      attachments: input.attachments,
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      senderId,
      tags: new Map(Object.entries(input.tags ?? {})),
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.notifications.set(notification.id, notification);
    await this.processNotification(notification);

    return notification;
  }

  // ==========================================================================
  // PROCESS NOTIFICATION
  // ==========================================================================

  private async processNotification(notification: EmailNotification): Promise<void> {
    try {
      notification.status = 'QUEUED';
      notification.queuedAt = new Date();

      // Simulate sending via provider
      const result = await this.defaultProvider.send(notification);

      notification.status = 'SENT';
      notification.sentAt = new Date();
      notification.provider = result.provider;
      notification.providerMessageId = result.messageId;

      // Simulate delivery (in real impl, would be webhook)
      setTimeout(() => {
        notification.status = 'DELIVERED';
        notification.deliveredAt = new Date();
      }, 100);

    } catch (error) {
      notification.status = 'FAILED';
      notification.failedAt = new Date();
      notification.errorCode = (error as { code?: string }).code ?? 'SEND_FAILED';
      notification.errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private isValidEmail(email: string): boolean {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
  }

  private validateVariables(template: Template, variables: Map<string, string>): string[] {
    const missing: string[] = [];
    for (const v of template.variables) {
      if (v.required && !variables.has(v.name) && !v.defaultValue) {
        missing.push(v.name);
      }
    }
    return missing;
  }

  private checkRateLimit(senderId: string, recipient: string): void {
    const now = new Date();
    
    // Check sender limit
    const senderKey = `sender:${senderId}`;
    const senderLimit = this.rateLimits.get(senderKey);
    if (senderLimit) {
      if (senderLimit.resetAt > now && senderLimit.count >= 100) {
        throw new EmailError('RATE_LIMITED', 'Sender rate limit exceeded', true, 60000);
      }
      if (senderLimit.resetAt <= now) {
        this.rateLimits.set(senderKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
      } else {
        senderLimit.count++;
      }
    } else {
      this.rateLimits.set(senderKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
    }

    // Check recipient limit
    const recipientKey = `recipient:${recipient.toLowerCase()}`;
    const recipientLimit = this.rateLimits.get(recipientKey);
    if (recipientLimit) {
      if (recipientLimit.resetAt > now && recipientLimit.count >= 10) {
        throw new EmailError('RATE_LIMITED', 'Recipient rate limit exceeded', true, 60000);
      }
      if (recipientLimit.resetAt <= now) {
        this.rateLimits.set(recipientKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
      } else {
        recipientLimit.count++;
      }
    } else {
      this.rateLimits.set(recipientKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
    }
  }

  // ==========================================================================
  // NOTIFICATION OPERATIONS
  // ==========================================================================

  getNotification(id: NotificationId): EmailNotification | undefined {
    return this.notifications.get(id);
  }

  listNotifications(filter: {
    recipient?: string;
    status?: NotificationStatus;
    campaignId?: string;
    limit?: number;
  }): EmailNotification[] {
    let results = Array.from(this.notifications.values());

    if (filter.recipient) {
      results = results.filter(n => n.recipient === filter.recipient);
    }
    if (filter.status) {
      results = results.filter(n => n.status === filter.status);
    }
    if (filter.campaignId) {
      results = results.filter(n => n.campaignId === filter.campaignId);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  // ==========================================================================
  // UNSUBSCRIBE MANAGEMENT
  // ==========================================================================

  addToUnsubscribeList(email: Email): void {
    this.unsubscribeList.add(email.toLowerCase());
  }

  removeFromUnsubscribeList(email: Email): void {
    this.unsubscribeList.delete(email.toLowerCase());
  }

  isUnsubscribed(email: Email): boolean {
    return this.unsubscribeList.has(email.toLowerCase());
  }
}

// ============================================================================
// EMAIL PROVIDER INTERFACE
// ============================================================================

interface EmailProviderResult {
  provider: string;
  messageId: string;
}

interface EmailProvider {
  send(notification: EmailNotification): Promise<EmailProviderResult>;
}

class MockEmailProvider implements EmailProvider {
  async send(notification: EmailNotification): Promise<EmailProviderResult> {
    // Simulate provider latency
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      provider: 'mock',
      messageId: `mock_${randomUUID()}`,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const emailStore = new EmailStore();
