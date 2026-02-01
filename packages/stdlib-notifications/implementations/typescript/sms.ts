/**
 * SMS Notification Implementation
 * 
 * Send SMS/text message notifications.
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
export type Phone = string;

export type NotificationStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface SMSNotification {
  id: NotificationId;
  channel: 'SMS';
  recipient: Phone;
  templateId: string;
  variables: Map<string, string>;
  body?: string;
  from?: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  senderId: string;
  campaignId?: string;
  tags: Map<string, string>;
  createdAt: Date;
  scheduledAt?: Date;
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  provider?: string;
  providerMessageId?: string;
  segments: number;
  retryCount: number;
  maxRetries: number;
}

export interface SendSMSInput {
  to: Phone;
  templateId: string;
  variables?: Record<string, string>;
  message?: string;
  from?: string;
  priority?: NotificationPriority;
  scheduledAt?: Date;
  campaignId?: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface SendSMSDirectInput {
  to: Phone;
  message: string;
  from?: string;
  priority?: NotificationPriority;
  tags?: Record<string, string>;
}

export interface SendVerificationSMSInput {
  to: Phone;
  code: string;
  expiresIn?: number;
  templateId?: string;
}

export interface VerificationResult {
  notification: SMSNotification;
  verificationId: string;
  expiresAt: Date;
}

// ============================================================================
// ERRORS
// ============================================================================

export class SMSError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SMSError';
  }
}

// ============================================================================
// SMS STORE
// ============================================================================

export class SMSStore {
  private notifications: Map<NotificationId, SMSNotification> = new Map();
  private idempotencyCache: Map<string, NotificationId> = new Map();
  private optOutList: Set<Phone> = new Set();
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();
  private verifications: Map<string, { phone: Phone; code: string; expiresAt: Date }> = new Map();
  
  // Provider simulation
  private provider: SMSProvider;

  constructor() {
    this.provider = new MockSMSProvider();
  }

  // ==========================================================================
  // SEND SMS
  // ==========================================================================

  async sendSMS(input: SendSMSInput, senderId: string): Promise<SMSNotification> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existingId = this.idempotencyCache.get(input.idempotencyKey);
      if (existingId) {
        const existing = this.notifications.get(existingId);
        if (existing) return existing;
      }
    }

    // Validate phone format (E.164)
    if (!this.isValidPhone(input.to)) {
      throw new SMSError('INVALID_PHONE', `Invalid phone number: ${input.to}`);
    }

    // Check opt-out list
    if (this.optOutList.has(input.to)) {
      throw new SMSError('RECIPIENT_OPTED_OUT', 'Recipient has opted out of SMS');
    }

    // Check rate limits
    this.checkRateLimit(senderId, input.to);

    // Get and validate template
    const template = templateStore.getTemplate(input.templateId);
    if (!template) {
      throw new SMSError('TEMPLATE_NOT_FOUND', `Template not found: ${input.templateId}`);
    }
    if (template.channel !== 'SMS') {
      throw new SMSError('INVALID_TEMPLATE', 'Template is not for SMS channel');
    }
    if (!template.active) {
      throw new SMSError('TEMPLATE_INACTIVE', 'Template is not active');
    }

    // Validate variables
    const variables = new Map(Object.entries(input.variables ?? {}));
    const missingVars = this.validateVariables(template, variables);
    if (missingVars.length > 0) {
      throw new SMSError(
        'MISSING_VARIABLE',
        `Missing required variables: ${missingVars.join(', ')}`,
        false,
        undefined,
        { missing: missingVars }
      );
    }

    // Render template
    const rendered = renderTemplate(template, variables);

    // Check message length
    if (rendered.body.length > 1600) {
      throw new SMSError('MESSAGE_TOO_LONG', 'Message exceeds 1600 characters');
    }

    // Calculate segments
    const segments = this.calculateSegments(rendered.body);

    // Create notification
    const notification: SMSNotification = {
      id: randomUUID(),
      channel: 'SMS',
      recipient: input.to,
      templateId: input.templateId,
      variables,
      body: rendered.body,
      from: input.from,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      senderId,
      campaignId: input.campaignId,
      tags: new Map(Object.entries(input.tags ?? {})),
      createdAt: new Date(),
      scheduledAt: input.scheduledAt,
      segments,
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
  // SEND SMS DIRECT
  // ==========================================================================

  async sendSMSDirect(input: SendSMSDirectInput, senderId: string): Promise<SMSNotification> {
    // Validate phone format
    if (!this.isValidPhone(input.to)) {
      throw new SMSError('INVALID_PHONE', `Invalid phone number: ${input.to}`);
    }

    // Check opt-out list
    if (this.optOutList.has(input.to)) {
      throw new SMSError('RECIPIENT_OPTED_OUT', 'Recipient has opted out of SMS');
    }

    // Check rate limits
    this.checkRateLimit(senderId, input.to);

    // Check message length
    if (input.message.length > 1600) {
      throw new SMSError('MESSAGE_TOO_LONG', 'Message exceeds 1600 characters');
    }

    // Calculate segments
    const segments = this.calculateSegments(input.message);

    // Create notification
    const notification: SMSNotification = {
      id: randomUUID(),
      channel: 'SMS',
      recipient: input.to,
      templateId: '_direct',
      variables: new Map(),
      body: input.message,
      from: input.from,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      senderId,
      tags: new Map(Object.entries(input.tags ?? {})),
      createdAt: new Date(),
      segments,
      retryCount: 0,
      maxRetries: 3,
    };

    this.notifications.set(notification.id, notification);
    await this.processNotification(notification);

    return notification;
  }

  // ==========================================================================
  // SEND VERIFICATION SMS
  // ==========================================================================

  async sendVerificationSMS(
    input: SendVerificationSMSInput, 
    senderId: string
  ): Promise<VerificationResult> {
    // Validate code format
    if (!/^\d{4,8}$/.test(input.code)) {
      throw new SMSError('INVALID_CODE', 'Code must be 4-8 digits');
    }

    // Check rate limits (stricter for verification)
    this.checkVerificationRateLimit(input.to);

    const expiresIn = input.expiresIn ?? 600000; // 10 minutes default
    const expiresAt = new Date(Date.now() + expiresIn);
    const verificationId = randomUUID();

    // Store verification
    this.verifications.set(verificationId, {
      phone: input.to,
      code: input.code,
      expiresAt,
    });

    // Send SMS with code
    const message = `Your verification code is: ${input.code}. It expires in ${Math.floor(expiresIn / 60000)} minutes.`;
    
    const notification = await this.sendSMSDirect(
      {
        to: input.to,
        message,
        priority: 'HIGH',
      },
      senderId
    );

    return {
      notification,
      verificationId,
      expiresAt,
    };
  }

  // ==========================================================================
  // VERIFY CODE
  // ==========================================================================

  verifyCode(verificationId: string, code: string): boolean {
    const verification = this.verifications.get(verificationId);
    if (!verification) return false;
    if (verification.expiresAt < new Date()) {
      this.verifications.delete(verificationId);
      return false;
    }
    if (verification.code !== code) return false;
    
    this.verifications.delete(verificationId);
    return true;
  }

  // ==========================================================================
  // PROCESS NOTIFICATION
  // ==========================================================================

  private async processNotification(notification: SMSNotification): Promise<void> {
    try {
      notification.status = 'QUEUED';
      notification.queuedAt = new Date();

      // Simulate sending via provider
      const result = await this.provider.send(notification);

      notification.status = 'SENT';
      notification.sentAt = new Date();
      notification.provider = result.provider;
      notification.providerMessageId = result.messageId;

      // Simulate delivery
      setTimeout(() => {
        notification.status = 'DELIVERED';
        notification.deliveredAt = new Date();
      }, 50);

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

  private isValidPhone(phone: string): boolean {
    // E.164 format
    return /^\+[1-9]\d{1,14}$/.test(phone);
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

  private calculateSegments(message: string): number {
    // GSM-7 encoding: 160 chars per segment, 153 for multi-part
    if (message.length <= 160) return 1;
    return Math.ceil(message.length / 153);
  }

  private checkRateLimit(senderId: string, recipient: string): void {
    const now = new Date();
    
    // Check sender limit
    const senderKey = `sender:${senderId}`;
    const senderLimit = this.rateLimits.get(senderKey);
    if (senderLimit) {
      if (senderLimit.resetAt > now && senderLimit.count >= 60) {
        throw new SMSError('RATE_LIMITED', 'Sender rate limit exceeded', true, 30000);
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
    const recipientKey = `recipient:${recipient}`;
    const recipientLimit = this.rateLimits.get(recipientKey);
    if (recipientLimit) {
      if (recipientLimit.resetAt > now && recipientLimit.count >= 10) {
        throw new SMSError('RATE_LIMITED', 'Recipient rate limit exceeded', true, 30000);
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

  private checkVerificationRateLimit(phone: string): void {
    const now = new Date();
    const key = `verification:${phone}`;
    const limit = this.rateLimits.get(key);
    
    if (limit) {
      if (limit.resetAt > now && limit.count >= 3) {
        throw new SMSError('RATE_LIMITED', 'Verification rate limit exceeded', true, 600000);
      }
      if (limit.resetAt <= now) {
        this.rateLimits.set(key, { count: 1, resetAt: new Date(now.getTime() + 600000) });
      } else {
        limit.count++;
      }
    } else {
      this.rateLimits.set(key, { count: 1, resetAt: new Date(now.getTime() + 600000) });
    }
  }

  // ==========================================================================
  // NOTIFICATION OPERATIONS
  // ==========================================================================

  getNotification(id: NotificationId): SMSNotification | undefined {
    return this.notifications.get(id);
  }

  listNotifications(filter: {
    recipient?: string;
    status?: NotificationStatus;
    limit?: number;
  }): SMSNotification[] {
    let results = Array.from(this.notifications.values());

    if (filter.recipient) {
      results = results.filter(n => n.recipient === filter.recipient);
    }
    if (filter.status) {
      results = results.filter(n => n.status === filter.status);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  // ==========================================================================
  // OPT-OUT MANAGEMENT
  // ==========================================================================

  addToOptOutList(phone: Phone): void {
    this.optOutList.add(phone);
  }

  removeFromOptOutList(phone: Phone): void {
    this.optOutList.delete(phone);
  }

  isOptedOut(phone: Phone): boolean {
    return this.optOutList.has(phone);
  }
}

// ============================================================================
// SMS PROVIDER INTERFACE
// ============================================================================

interface SMSProviderResult {
  provider: string;
  messageId: string;
}

interface SMSProvider {
  send(notification: SMSNotification): Promise<SMSProviderResult>;
}

class MockSMSProvider implements SMSProvider {
  async send(notification: SMSNotification): Promise<SMSProviderResult> {
    // Simulate provider latency
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      provider: 'mock',
      messageId: `mock_sms_${randomUUID()}`,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const smsStore = new SMSStore();
