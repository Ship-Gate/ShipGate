/**
 * Push Notification Implementation
 * 
 * Send push notifications to mobile devices.
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
export type DeviceToken = string;

export type NotificationStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'FAILED';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type PushPlatform = 'IOS' | 'ANDROID' | 'WEB' | 'HUAWEI' | 'AMAZON';

export interface PushNotification {
  id: NotificationId;
  channel: 'PUSH';
  deviceToken: DeviceToken;
  platform?: PushPlatform;
  templateId: string;
  variables: Map<string, string>;
  title?: string;
  body?: string;
  // iOS
  badge?: number;
  sound?: string;
  contentAvailable?: boolean;
  mutableContent?: boolean;
  category?: string;
  threadId?: string;
  // Android
  icon?: string;
  color?: string;
  clickAction?: string;
  channelId?: string;
  // Data payload
  data?: Map<string, string>;
  priority: NotificationPriority;
  status: NotificationStatus;
  senderId: string;
  campaignId?: string;
  tags: Map<string, string>;
  ttl?: number;
  collapseKey?: string;
  createdAt: Date;
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  failedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  provider?: string;
  providerMessageId?: string;
  retryCount: number;
  maxRetries: number;
}

export interface SendPushInput {
  deviceToken: DeviceToken;
  platform?: PushPlatform;
  templateId: string;
  variables?: Record<string, string>;
  title?: string;
  body?: string;
  badge?: number;
  sound?: string;
  contentAvailable?: boolean;
  mutableContent?: boolean;
  category?: string;
  threadId?: string;
  icon?: string;
  color?: string;
  clickAction?: string;
  channelId?: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
  ttl?: number;
  collapseKey?: string;
  campaignId?: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export interface SendPushDirectInput {
  deviceToken: DeviceToken;
  platform?: PushPlatform;
  title: string;
  body: string;
  badge?: number;
  sound?: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
  ttl?: number;
  collapseKey?: string;
}

export interface DeviceRegistration {
  id: string;
  userId: string;
  deviceToken: DeviceToken;
  platform: PushPlatform;
  deviceName?: string;
  appVersion?: string;
  registeredAt: Date;
  lastActiveAt: Date;
}

// ============================================================================
// ERRORS
// ============================================================================

export class PushError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean = false,
    public retryAfter?: number,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PushError';
  }
}

// ============================================================================
// PUSH STORE
// ============================================================================

export class PushStore {
  private notifications: Map<NotificationId, PushNotification> = new Map();
  private idempotencyCache: Map<string, NotificationId> = new Map();
  private devices: Map<string, DeviceRegistration> = new Map();
  private userDevices: Map<string, Set<string>> = new Map();
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();
  
  // Provider simulation
  private provider: PushProvider;

  constructor() {
    this.provider = new MockPushProvider();
  }

  // ==========================================================================
  // SEND PUSH
  // ==========================================================================

  async sendPush(input: SendPushInput, senderId: string): Promise<PushNotification> {
    // Check idempotency
    if (input.idempotencyKey) {
      const existingId = this.idempotencyCache.get(input.idempotencyKey);
      if (existingId) {
        const existing = this.notifications.get(existingId);
        if (existing) return existing;
      }
    }

    // Validate device token
    if (input.deviceToken.length < 32) {
      throw new PushError('INVALID_TOKEN', 'Device token is too short');
    }

    // Check rate limits
    this.checkRateLimit(senderId, input.deviceToken);

    // Get and validate template
    const template = templateStore.getTemplate(input.templateId);
    if (!template) {
      throw new PushError('TEMPLATE_NOT_FOUND', `Template not found: ${input.templateId}`);
    }
    if (template.channel !== 'PUSH') {
      throw new PushError('INVALID_TEMPLATE', 'Template is not for push channel');
    }
    if (!template.active) {
      throw new PushError('TEMPLATE_INACTIVE', 'Template is not active');
    }

    // Validate variables
    const variables = new Map(Object.entries(input.variables ?? {}));
    const missingVars = this.validateVariables(template, variables);
    if (missingVars.length > 0) {
      throw new PushError(
        'MISSING_VARIABLE',
        `Missing required variables: ${missingVars.join(', ')}`,
        false,
        undefined,
        { missing: missingVars }
      );
    }

    // Render template
    const rendered = renderTemplate(template, variables);

    // Detect platform from token if not provided
    const platform = input.platform ?? this.detectPlatform(input.deviceToken);

    // Create notification
    const notification: PushNotification = {
      id: randomUUID(),
      channel: 'PUSH',
      deviceToken: input.deviceToken,
      platform,
      templateId: input.templateId,
      variables,
      title: rendered.subject ?? input.title,
      body: rendered.body ?? input.body,
      badge: input.badge,
      sound: input.sound,
      contentAvailable: input.contentAvailable,
      mutableContent: input.mutableContent,
      category: input.category,
      threadId: input.threadId,
      icon: input.icon,
      color: input.color,
      clickAction: input.clickAction,
      channelId: input.channelId,
      data: input.data ? new Map(Object.entries(input.data)) : undefined,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      senderId,
      campaignId: input.campaignId,
      tags: new Map(Object.entries(input.tags ?? {})),
      ttl: input.ttl,
      collapseKey: input.collapseKey,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    // Check payload size
    const payloadSize = this.calculatePayloadSize(notification);
    if (payloadSize > 4096) {
      throw new PushError('PAYLOAD_TOO_LARGE', `Payload size ${payloadSize} exceeds 4KB limit`);
    }

    this.notifications.set(notification.id, notification);

    // Cache idempotency key
    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, notification.id);
    }

    await this.processNotification(notification);

    return notification;
  }

  // ==========================================================================
  // SEND PUSH DIRECT
  // ==========================================================================

  async sendPushDirect(input: SendPushDirectInput, senderId: string): Promise<PushNotification> {
    // Validate device token
    if (input.deviceToken.length < 32) {
      throw new PushError('INVALID_TOKEN', 'Device token is too short');
    }

    // Check rate limits
    this.checkRateLimit(senderId, input.deviceToken);

    // Detect platform
    const platform = input.platform ?? this.detectPlatform(input.deviceToken);

    // Create notification
    const notification: PushNotification = {
      id: randomUUID(),
      channel: 'PUSH',
      deviceToken: input.deviceToken,
      platform,
      templateId: '_direct',
      variables: new Map(),
      title: input.title,
      body: input.body,
      badge: input.badge,
      sound: input.sound,
      data: input.data ? new Map(Object.entries(input.data)) : undefined,
      priority: input.priority ?? 'NORMAL',
      status: 'PENDING',
      senderId,
      tags: new Map(),
      ttl: input.ttl,
      collapseKey: input.collapseKey,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    // Check payload size
    const payloadSize = this.calculatePayloadSize(notification);
    if (payloadSize > 4096) {
      throw new PushError('PAYLOAD_TOO_LARGE', `Payload size ${payloadSize} exceeds 4KB limit`);
    }

    this.notifications.set(notification.id, notification);
    await this.processNotification(notification);

    return notification;
  }

  // ==========================================================================
  // SEND TO USER (all devices)
  // ==========================================================================

  async sendToUser(
    userId: string,
    input: Omit<SendPushInput, 'deviceToken'>,
    senderId: string
  ): Promise<PushNotification[]> {
    const deviceIds = this.userDevices.get(userId);
    if (!deviceIds || deviceIds.size === 0) {
      throw new PushError('NO_DEVICES', 'User has no registered devices');
    }

    const notifications: PushNotification[] = [];
    
    for (const deviceId of deviceIds) {
      const device = this.devices.get(deviceId);
      if (!device) continue;

      try {
        const notification = await this.sendPush(
          { ...input, deviceToken: device.deviceToken, platform: device.platform },
          senderId
        );
        notifications.push(notification);
      } catch {
        // Continue with other devices
      }
    }

    return notifications;
  }

  // ==========================================================================
  // PROCESS NOTIFICATION
  // ==========================================================================

  private async processNotification(notification: PushNotification): Promise<void> {
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
      }, 30);

    } catch (error) {
      const err = error as { code?: string; unregistered?: boolean };
      
      if (err.unregistered) {
        // Handle unregistered device
        notification.status = 'FAILED';
        notification.errorCode = 'UNREGISTERED_DEVICE';
        notification.errorMessage = 'Device is no longer registered';
      } else {
        notification.status = 'FAILED';
        notification.errorCode = err.code ?? 'SEND_FAILED';
        notification.errorMessage = error instanceof Error ? error.message : String(error);
      }
      notification.failedAt = new Date();
    }
  }

  // ==========================================================================
  // DEVICE REGISTRATION
  // ==========================================================================

  registerDevice(input: {
    userId: string;
    deviceToken: DeviceToken;
    platform: PushPlatform;
    deviceName?: string;
    appVersion?: string;
  }): DeviceRegistration {
    // Check device limit per user
    const userDeviceSet = this.userDevices.get(input.userId) ?? new Set();
    if (userDeviceSet.size >= 10) {
      throw new PushError('DEVICE_LIMIT_EXCEEDED', 'User has too many registered devices');
    }

    const registration: DeviceRegistration = {
      id: randomUUID(),
      userId: input.userId,
      deviceToken: input.deviceToken,
      platform: input.platform,
      deviceName: input.deviceName,
      appVersion: input.appVersion,
      registeredAt: new Date(),
      lastActiveAt: new Date(),
    };

    this.devices.set(registration.id, registration);
    
    userDeviceSet.add(registration.id);
    this.userDevices.set(input.userId, userDeviceSet);

    return registration;
  }

  unregisterDevice(deviceToken: DeviceToken): boolean {
    // Find and remove device
    for (const [id, device] of this.devices) {
      if (device.deviceToken === deviceToken) {
        this.devices.delete(id);
        
        const userDeviceSet = this.userDevices.get(device.userId);
        if (userDeviceSet) {
          userDeviceSet.delete(id);
        }
        
        return true;
      }
    }
    
    throw new PushError('DEVICE_NOT_FOUND', 'Device not registered');
  }

  getDevice(deviceId: string): DeviceRegistration | undefined {
    return this.devices.get(deviceId);
  }

  getUserDevices(userId: string): DeviceRegistration[] {
    const deviceIds = this.userDevices.get(userId);
    if (!deviceIds) return [];
    
    return Array.from(deviceIds)
      .map(id => this.devices.get(id))
      .filter((d): d is DeviceRegistration => d !== undefined);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private validateVariables(template: Template, variables: Map<string, string>): string[] {
    const missing: string[] = [];
    for (const v of template.variables) {
      if (v.required && !variables.has(v.name) && !v.defaultValue) {
        missing.push(v.name);
      }
    }
    return missing;
  }

  private detectPlatform(deviceToken: string): PushPlatform {
    // Simple heuristic based on token format
    if (deviceToken.length === 64 && /^[a-f0-9]+$/i.test(deviceToken)) {
      return 'IOS';
    }
    if (deviceToken.includes(':')) {
      return 'ANDROID';
    }
    return 'ANDROID'; // Default
  }

  private calculatePayloadSize(notification: PushNotification): number {
    const payload: Record<string, unknown> = {
      title: notification.title,
      body: notification.body,
      badge: notification.badge,
      sound: notification.sound,
      data: notification.data ? Object.fromEntries(notification.data) : undefined,
    };
    return JSON.stringify(payload).length;
  }

  private checkRateLimit(senderId: string, deviceToken: string): void {
    const now = new Date();
    
    // Check sender limit (high throughput for push)
    const senderKey = `sender:${senderId}`;
    const senderLimit = this.rateLimits.get(senderKey);
    if (senderLimit) {
      if (senderLimit.resetAt > now && senderLimit.count >= 1000) {
        throw new PushError('RATE_LIMITED', 'Sender rate limit exceeded', true, 10000);
      }
      if (senderLimit.resetAt <= now) {
        this.rateLimits.set(senderKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
      } else {
        senderLimit.count++;
      }
    } else {
      this.rateLimits.set(senderKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
    }

    // Check device limit
    const deviceKey = `device:${deviceToken}`;
    const deviceLimit = this.rateLimits.get(deviceKey);
    if (deviceLimit) {
      if (deviceLimit.resetAt > now && deviceLimit.count >= 100) {
        throw new PushError('RATE_LIMITED', 'Device rate limit exceeded', true, 10000);
      }
      if (deviceLimit.resetAt <= now) {
        this.rateLimits.set(deviceKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
      } else {
        deviceLimit.count++;
      }
    } else {
      this.rateLimits.set(deviceKey, { count: 1, resetAt: new Date(now.getTime() + 60000) });
    }
  }

  // ==========================================================================
  // NOTIFICATION OPERATIONS
  // ==========================================================================

  getNotification(id: NotificationId): PushNotification | undefined {
    return this.notifications.get(id);
  }

  listNotifications(filter: {
    deviceToken?: string;
    status?: NotificationStatus;
    limit?: number;
  }): PushNotification[] {
    let results = Array.from(this.notifications.values());

    if (filter.deviceToken) {
      results = results.filter(n => n.deviceToken === filter.deviceToken);
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

  // Mark notification as opened (from client callback)
  markOpened(id: NotificationId): boolean {
    const notification = this.notifications.get(id);
    if (!notification) return false;
    
    notification.status = 'OPENED';
    notification.openedAt = new Date();
    return true;
  }
}

// ============================================================================
// PUSH PROVIDER INTERFACE
// ============================================================================

interface PushProviderResult {
  provider: string;
  messageId: string;
}

interface PushProvider {
  send(notification: PushNotification): Promise<PushProviderResult>;
}

class MockPushProvider implements PushProvider {
  async send(notification: PushNotification): Promise<PushProviderResult> {
    // Simulate provider latency
    await new Promise(resolve => setTimeout(resolve, 5));
    
    return {
      provider: 'mock',
      messageId: `mock_push_${randomUUID()}`,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const pushStore = new PushStore();
