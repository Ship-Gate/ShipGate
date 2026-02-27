/**
 * Core types for the notification system
 */

export type UUID = string;
export type Timestamp = Date;

export type NotificationId = UUID;
export type TemplateId = string;
export type RecipientId = UUID;

export type Email = string;
export type PhoneNumber = string;
export type DeviceToken = string;

export enum Channel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
  WEBHOOK = 'WEBHOOK',
  SLACK = 'SLACK',
  TEAMS = 'TEAMS',
  DISCORD = 'DISCORD'
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  UNSUBSCRIBED = 'UNSUBSCRIBED'
}

export enum Priority {
  CRITICAL = 'CRITICAL',     // Immediate delivery, bypass quiet hours
  HIGH = 'HIGH',             // Priority delivery
  NORMAL = 'NORMAL',         // Standard delivery
  LOW = 'LOW',               // Can be batched/delayed
  DIGEST = 'DIGEST'          // Include in digest only
}

export interface Attachment {
  filename: string;
  contentType: string;
  url?: string;
  content?: string;  // Base64 for inline
  size?: number;
}

export enum ActionType {
  LINK = 'LINK',
  BUTTON = 'BUTTON',
  DEEP_LINK = 'DEEP_LINK',
  DISMISS = 'DISMISS',
  REPLY = 'REPLY'
}

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  actionType: ActionType;
}

export interface Notification {
  id: NotificationId;
  
  // Template
  templateId: TemplateId;
  
  // Recipient
  recipientId: RecipientId;
  recipientEmail?: Email;
  recipientPhone?: PhoneNumber;
  recipientDeviceToken?: DeviceToken;
  
  // Channel
  channel: Channel;
  
  // Content (rendered from template)
  subject?: string;
  body: string;
  htmlBody?: string;
  
  // Rich content
  attachments?: Attachment[];
  actions?: NotificationAction[];
  
  // Metadata
  priority: Priority;
  category?: string;
  tags?: string[];
  data?: Record<string, any>;
  
  // Tracking
  status: NotificationStatus;
  provider?: string;
  providerMessageId?: string;
  
  // Events
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  openedAt?: Timestamp;
  clickedAt?: Timestamp;
  failedAt?: Timestamp;
  failureReason?: string;
  
  // Scheduling
  scheduledAt?: Timestamp;
  expiresAt?: Timestamp;
  
  // Idempotency
  idempotencyKey?: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Computed properties
  readonly isDelivered: boolean;
  readonly isFailed: boolean;
  readonly isPending: boolean;
  readonly wasOpened: boolean;
  readonly wasClicked: boolean;
  readonly deliveryLatency?: number;
}

export interface CreateNotificationInput {
  templateId: TemplateId;
  recipientId: RecipientId;
  recipientEmail?: Email;
  recipientPhone?: PhoneNumber;
  recipientDeviceToken?: DeviceToken;
  channel?: Channel;
  channels?: Channel[];
  subject?: string;
  body?: string;
  htmlBody?: string;
  attachments?: Attachment[];
  actions?: NotificationAction[];
  priority?: Priority;
  category?: string;
  tags?: string[];
  data?: Record<string, any>;
  scheduledAt?: Timestamp;
  expiresAt?: Timestamp;
  idempotencyKey?: string;
}

export interface SendResult {
  notifications: Notification[];
  failed: Array<{
    channel: Channel;
    error: string;
    retriable: boolean;
  }>;
}

export interface BatchRecipient {
  recipientId: RecipientId;
  variables?: Record<string, any>;
}

export interface TransactionalRecipient {
  email?: Email;
  phone?: PhoneNumber;
  deviceToken?: DeviceToken;
}

// Template types
export enum VariableType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  LIST = 'LIST',
  OBJECT = 'OBJECT'
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface ChannelTemplate {
  subject?: string;
  body: string;
  htmlBody?: string;
  // Push-specific
  title?: string;
  imageUrl?: string;
  sound?: string;
  badge?: number;
}

export interface Template {
  id: TemplateId;
  name: string;
  description?: string;
  
  // Channel-specific templates
  channels: Map<Channel, ChannelTemplate>;
  
  // Variables
  variables: TemplateVariable[];
  
  // Localization
  defaultLocale: string;
  locales: string[];
  
  // Settings
  category?: string;
  priority?: Priority;
  
  // Status
  active: boolean;
  
  // Versioning
  version: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RenderContext {
  recipient: {
    id: RecipientId;
    email?: Email;
    phone?: PhoneNumber;
    locale?: string;
    timezone?: string;
  };
  variables: Record<string, any>;
  locale?: string;
}

// Preference types
export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY'
}

export interface QuietHours {
  enabled: boolean;
  start: string;   // e.g., "22:00"
  end: string;     // e.g., "08:00"
  days?: DayOfWeek[];  // If null, applies to all days
}

export interface ChannelPreference {
  enabled: boolean;
  address?: string;  // Override default
}

export enum DigestFrequency {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY'
}

export interface RecipientPreferences {
  recipientId: RecipientId;
  
  // Global preferences
  enabled: boolean;
  quietHours?: QuietHours;
  timezone?: string;
  locale?: string;
  
  // Channel preferences
  channelPreferences: Map<Channel, ChannelPreference>;
  
  // Category preferences (opt-in/out per category)
  categoryPreferences: Map<string, boolean>;
  
  // Unsubscribed categories
  unsubscribedCategories: string[];
  
  // Frequency limits
  digestEnabled: boolean;
  digestFrequency?: DigestFrequency;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Delivery tracking types
export interface DeliveryEvent {
  id: string;
  notificationId: NotificationId;
  status: NotificationStatus;
  timestamp: Timestamp;
  provider?: string;
  providerMessageId?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface DeliveryStats {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
  averageDeliveryTime?: number;
}

// Error types
export class NotificationError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

export interface Clock {
  now(): Timestamp;
}

export interface DefaultClock extends Clock {
  now(): Timestamp;
}
