/**
 * Email Standard Library Types
 */

// ============================================
// Core Types
// ============================================

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  id?: string;
  from: EmailAddress | string;
  to: (EmailAddress | string)[];
  cc?: (EmailAddress | string)[];
  bcc?: (EmailAddress | string)[];
  replyTo?: EmailAddress | string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  priority?: EmailPriority;
  tags?: string[];
  metadata?: Record<string, unknown>;
  templateId?: string;
  templateData?: Record<string, unknown>;
  scheduledAt?: Date;
}

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  contentId?: string;
  disposition?: AttachmentDisposition;
  encoding?: 'base64' | 'binary' | 'utf8';
}

export interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  subject: string;
  textTemplate?: string;
  htmlTemplate?: string;
  variables: TemplateVariable[];
  category?: string;
  locale?: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  defaultValue?: string;
  description?: string;
  validation?: string;
}

export interface EmailDeliveryResult {
  messageId: string;
  email: string;
  status: DeliveryStatus;
  provider: string;
  providerId?: string;
  timestamp: Date;
  error?: DeliveryError;
  attempts: number;
  metadata?: Record<string, unknown>;
}

export interface DeliveryError {
  code: string;
  message: string;
  category: ErrorCategory;
  permanent: boolean;
  retryAfter?: Date;
}

export interface EmailBatch {
  id: string;
  name: string;
  templateId: string;
  recipients: BatchRecipient[];
  status: BatchStatus;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface BatchRecipient {
  email: string;
  data: Record<string, unknown>;
  status: DeliveryStatus;
  sentAt?: Date;
  error?: string;
}

export interface DeliveryStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

// ============================================
// Enums
// ============================================

export type EmailPriority = 'low' | 'normal' | 'high' | 'urgent';

export type EmailStatus = 
  | 'draft'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'cancelled';

export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'failed';

export type AttachmentDisposition = 'attachment' | 'inline';

export type VariableType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object';

export type ErrorCategory =
  | 'invalid_email'
  | 'bounce'
  | 'block'
  | 'spam'
  | 'rate_limit'
  | 'authentication'
  | 'configuration'
  | 'network'
  | 'unknown';

export type BatchStatus =
  | 'created'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================
// Provider Types
// ============================================

export interface EmailProvider {
  name: string;
  send(message: NormalizedEmail): Promise<EmailDeliveryResult>;
  sendBatch?(messages: NormalizedEmail[]): Promise<EmailDeliveryResult[]>;
  getStatus?(messageId: string): Promise<EmailDeliveryResult>;
  validateCredentials?(): Promise<boolean>;
}

export interface NormalizedEmail {
  id: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  attachments: NormalizedAttachment[];
  headers: Record<string, string>;
  priority: EmailPriority;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface NormalizedAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId?: string;
  disposition: AttachmentDisposition;
  size: number;
}

export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  region?: string;
  endpoint?: string;
  from?: EmailAddress | string;
  replyTo?: EmailAddress | string;
  timeout?: number;
  retries?: number;
  rateLimit?: number;
  sandbox?: boolean;
}

// ============================================
// Template Engine Types
// ============================================

export interface TemplateEngine {
  name: string;
  render(template: string, data: Record<string, unknown>): Promise<string>;
  validate(template: string): Promise<TemplateValidation>;
  extractVariables(template: string): TemplateVariable[];
}

export interface TemplateValidation {
  valid: boolean;
  errors: TemplateError[];
  warnings: TemplateWarning[];
}

export interface TemplateError {
  line?: number;
  column?: number;
  message: string;
}

export interface TemplateWarning {
  line?: number;
  column?: number;
  message: string;
}

// ============================================
// Event Types
// ============================================

export interface EmailEvent {
  type: EmailEventType;
  messageId: string;
  email: string;
  timestamp: Date;
  provider: string;
  data?: Record<string, unknown>;
}

export type EmailEventType =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'dropped'
  | 'deferred';

export interface WebhookPayload {
  provider: string;
  events: EmailEvent[];
  signature?: string;
  timestamp: Date;
}

// ============================================
// Configuration Types
// ============================================

export interface EmailConfig {
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
  templates?: {
    directory?: string;
    engine?: string;
    cache?: boolean;
  };
  queue?: {
    enabled?: boolean;
    concurrency?: number;
    retries?: number;
    retryDelay?: number;
  };
  tracking?: {
    opens?: boolean;
    clicks?: boolean;
    unsubscribes?: boolean;
  };
  validation?: {
    verifyRecipients?: boolean;
    blockDisposable?: boolean;
    blockRoleBased?: boolean;
  };
}
