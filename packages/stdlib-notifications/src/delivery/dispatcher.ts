/**
 * Notification dispatcher with fallback mechanism
 */

import { 
  NotificationChannel, 
  ChannelMessage, 
  ChannelResponse 
} from '../channels/channel';
import { 
  Notification, 
  NotificationStatus, 
  Channel, 
  Priority,
  RecipientId,
  CreateNotificationInput,
  SendResult
} from '../types';
import { 
  DeliveryTracker,
  Scheduler,
  DispatchConfig,
  DispatchResult
} from './types';
import { 
  TemplateRegistry,
  TemplateEngine,
  RenderContext
} from '../templates';
import {
  RecipientPreferences,
  PreferencesManager
} from '../preferences';
import {
  NotificationError,
  DeliveryFailedError,
  RateLimitedError,
  QuietHoursError,
  UnsubscribedError,
  ChannelNotConfiguredError,
  DeliveryExpiredError
} from '../errors';
import { Clock } from '../types';

export class NotificationDispatcher {
  private channels: Map<Channel, NotificationChannel> = new Map();
  private tracker: DeliveryTracker;
  private scheduler: Scheduler;
  private templateRegistry: TemplateRegistry;
  private templateEngine: TemplateEngine;
  private preferencesManager: PreferencesManager;
  private clock: Clock;
  private config: DispatchConfig;
  
  // Rate limiting per recipient
  private recipientRateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(options: {
    tracker: DeliveryTracker;
    scheduler: Scheduler;
    templateRegistry: TemplateRegistry;
    templateEngine: TemplateEngine;
    preferencesManager: PreferencesManager;
    clock?: Clock;
    config?: DispatchConfig;
  }) {
    this.tracker = options.tracker;
    this.scheduler = options.scheduler;
    this.templateRegistry = options.templateRegistry;
    this.templateEngine = options.templateEngine;
    this.preferencesManager = options.preferencesManager;
    this.clock = options.clock || { now: () => new Date() };
    this.config = {
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      fallbackChannels: true,
      respectQuietHours: true,
      rateLimitPerRecipient: {
        count: 10,
        window: 3600 // 1 hour
      },
      ...options.config
    };
  }
  
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.channelType as Channel, channel);
  }
  
  async send(input: CreateNotificationInput): Promise<SendResult> {
    const notifications: Notification[] = [];
    const failed: Array<{ channel: Channel; error: string; retriable: boolean }> = [];
    
    try {
      // Determine which channels to use
      const channels = input.channels || [input.channel].filter(Boolean) as Channel[];
      
      if (channels.length === 0) {
        // Use recipient preferences to determine channels
        const preferences = await this.preferencesManager.getPreferences(input.recipientId);
        channels.push(...this.getPreferredChannels(preferences));
      }
      
      if (channels.length === 0) {
        throw new NotificationError('NO_CHANNELS', 'No channels available for delivery', false);
      }
      
      // Create notification objects for each channel
      for (const channel of channels) {
        try {
          const notification = await this.createNotification(input, channel);
          notifications.push(notification);
        } catch (error) {
          failed.push({
            channel,
            error: error instanceof Error ? error.message : 'Unknown error',
            retriable: false
          });
        }
      }
      
      // Send notifications
      const results: DispatchResult[] = [];
      for (const notification of notifications) {
        const result = await this.dispatchNotification(notification);
        results.push(result);
        
        if (!result.status || result.status === NotificationStatus.FAILED) {
          failed.push({
            channel: notification.channel,
            error: result.error || 'Dispatch failed',
            retriable: result.retriable || false
          });
        }
      }
      
      return {
        notifications,
        failed
      };
    } catch (error) {
      if (error instanceof NotificationError) {
        throw error;
      }
      throw new NotificationError('SEND_FAILED', error instanceof Error ? error.message : 'Unknown error', false);
    }
  }
  
  async sendBatch(inputs: CreateNotificationInput[]): Promise<{
    successful: Notification[];
    failed: Array<{ input: CreateNotificationInput; error: string; retriable: boolean }>;
  }> {
    const successful: Notification[] = [];
    const failed: Array<{ input: CreateNotificationInput; error: string; retriable: boolean }> = [];
    
    // Process batch in parallel with concurrency limit
    const concurrency = 10;
    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency);
      const promises = batch.map(async input => {
        try {
          const result = await this.send(input);
          successful.push(...result.notifications);
          
          // Add failed channels
          failed.push(...result.failed.map(f => ({
            input,
            error: f.error,
            retriable: f.retriable
          })));
        } catch (error) {
          failed.push({
            input,
            error: error instanceof Error ? error.message : 'Unknown error',
            retriable: error instanceof NotificationError ? error.retriable : false
          });
        }
      });
      
      await Promise.all(promises);
    }
    
    return { successful, failed };
  }
  
  private async createNotification(input: CreateNotificationInput, channel: Channel): Promise<Notification> {
    const now = this.clock.now();
    
    // Check if recipient has opted out
    if (input.category) {
      const preferences = await this.preferencesManager.getPreferences(input.recipientId);
      if (!this.isCategoryEnabled(preferences, input.category)) {
        throw new UnsubscribedError(input.category);
      }
    }
    
    // Check quiet hours
    if (this.config.respectQuietHours && input.priority !== Priority.CRITICAL) {
      const preferences = await this.preferencesManager.getPreferences(input.recipientId);
      if (this.isInQuietHours(preferences)) {
        throw new QuietHoursError();
      }
    }
    
    // Check rate limiting
    if (!this.checkRateLimit(input.recipientId)) {
      throw new RateLimitedError(this.config.rateLimitPerRecipient?.window);
    }
    
    // Check expiration
    if (input.expiresAt && input.expiresAt <= now) {
      throw new DeliveryExpiredError();
    }
    
    // Get template
    const template = await this.templateRegistry.getTemplateForChannel(input.templateId, channel);
    
    // Render template
    const context: RenderContext = {
      recipient: {
        id: input.recipientId,
        email: input.recipientEmail,
        phone: input.recipientPhone,
        locale: undefined, // Will be loaded from preferences
        timezone: undefined // Will be loaded from preferences
      },
      variables: input.data || {},
      locale: undefined // Will be loaded from preferences
    };
    
    // Load recipient preferences for locale/timezone
    const preferences = await this.preferencesManager.getPreferences(input.recipientId);
    context.recipient.locale = preferences.locale;
    context.recipient.timezone = preferences.timezone;
    context.locale = preferences.locale;
    
    // Render with HTML escaping for email
    const wasEscaping = this.templateEngine['escapeHtml'];
    if (channel === Channel.EMAIL) {
      this.templateEngine.setEscapeHtml(true);
    }
    
    const rendered = await this.templateEngine.render(template, context);
    
    // Restore escaping setting
    this.templateEngine.setEscapeHtml(wasEscaping);
    
    // Create notification object
    const notification: Notification = {
      id: this.generateId(),
      templateId: input.templateId,
      recipientId: input.recipientId,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      recipientDeviceToken: input.recipientDeviceToken,
      channel,
      subject: input.subject || rendered.subject,
      body: input.body || rendered.body,
      htmlBody: input.htmlBody || rendered.htmlBody,
      priority: input.priority || Priority.NORMAL,
      category: input.category,
      tags: input.tags,
      data: input.data,
      status: input.scheduledAt ? NotificationStatus.QUEUED : NotificationStatus.SENDING,
      createdAt: now,
      updatedAt: now,
      scheduledAt: input.scheduledAt,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      
      // Computed properties
      get isDelivered() { return this.status === NotificationStatus.DELIVERED; },
      get isFailed() { return this.status in [NotificationStatus.FAILED, NotificationStatus.BOUNCED]; },
      get isPending() { return this.status in [NotificationStatus.QUEUED, NotificationStatus.SENDING]; },
      get wasOpened() { return this.openedAt !== undefined; },
      get wasClicked() { return this.clickedAt !== undefined; },
      get deliveryLatency() { 
        return this.deliveredAt && this.sentAt 
          ? this.deliveredAt.getTime() - this.sentAt.getTime() 
          : undefined; 
      }
    };
    
    // Schedule if needed
    if (input.scheduledAt) {
      await this.scheduler.schedule(notification.id, input.scheduledAt);
    }
    
    // Track initial status
    await this.tracker.updateStatus(notification.id, notification.status);
    
    return notification;
  }
  
  private async dispatchNotification(notification: Notification): Promise<DispatchResult> {
    const channel = this.channels.get(notification.channel);
    if (!channel) {
      throw new NotificationError('CHANNEL_NOT_FOUND', `Channel ${notification.channel} not registered`, false);
    }
    
    if (!channel.isEnabled()) {
      throw new NotificationError('CHANNEL_DISABLED', `Channel ${notification.channel} is disabled`, false);
    }
    
    let attempts = 0;
    let lastError: string | undefined;
    let lastResponse: ChannelResponse | undefined;
    let fallbackUsed = false;
    
    while (attempts < this.config.maxRetries!) {
      attempts++;
      
      try {
        // Format message
        const message = channel.formatNotification(notification);
        
        // Send
        const response = await channel.send(message);
        lastResponse = response;
        
        if (response.success) {
          // Update status
          await this.tracker.updateStatus(
            notification.id, 
            response.status,
            {
              provider: response.metadata?.provider,
              providerMessageId: response.messageId,
              attempts,
              fallbackUsed
            }
          );
          
          return {
            notificationId: notification.id,
            status: response.status,
            channel: notification.channel,
            messageId: response.messageId,
            attempts,
            fallbackUsed
          };
        } else {
          lastError = response.error;
          
          // Check if we should try fallback
          if (this.config.fallbackChannels && attempts === 1 && !fallbackUsed) {
            const fallbackChannel = await this.getFallbackChannel(notification.channel);
            if (fallbackChannel) {
              fallbackUsed = true;
              notification.channel = fallbackChannel;
              continue; // Retry with fallback channel
            }
          }
          
          // Check if retriable
          if (!response.retriable) {
            break;
          }
          
          // Wait before retry
          if (attempts < this.config.maxRetries!) {
            await this.delay(this.config.retryDelay! * attempts);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        // Check if error is retriable
        if (error instanceof NotificationError && !error.retriable) {
          break;
        }
        
        // Wait before retry
        if (attempts < this.config.maxRetries!) {
          await this.delay(this.config.retryDelay! * attempts);
        }
      }
    }
    
    // All attempts failed
    await this.tracker.updateStatus(
      notification.id,
      NotificationStatus.FAILED,
      {
        error: lastError,
        attempts,
        fallbackUsed
      }
    );
    
    return {
      notificationId: notification.id,
      status: NotificationStatus.FAILED,
      channel: notification.channel,
      error: lastError,
      retriable: false,
      attempts,
      fallbackUsed
    };
  }
  
  private getPreferredChannels(preferences: RecipientPreferences): Channel[] {
    const channels: Channel[] = [];
    
    for (const [channel, pref] of preferences.channelPreferences) {
      if (pref.enabled) {
        channels.push(channel);
      }
    }
    
    return channels;
  }
  
  private isCategoryEnabled(preferences: RecipientPreferences, category: string): boolean {
    // Check if globally disabled
    if (!preferences.enabled) {
      return false;
    }
    
    // Check if category is unsubscribed
    if (preferences.unsubscribedCategories.includes(category)) {
      return false;
    }
    
    // Check category preference
    const categoryPref = preferences.categoryPreferences.get(category);
    if (categoryPref !== undefined) {
      return categoryPref;
    }
    
    // Default to enabled
    return true;
  }
  
  private isInQuietHours(preferences: RecipientPreferences): boolean {
    if (!preferences.quietHours || !preferences.quietHours.enabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    // Check if current day is included
    if (preferences.quietHours.days) {
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][dayOfWeek];
      if (!preferences.quietHours.days.includes(dayName as any)) {
        return false;
      }
    }
    
    // Check if current time is in quiet hours window
    if (startTime <= endTime) {
      // Same day window (e.g., 22:00 to 08:00 doesn't cross midnight)
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Cross-midnight window (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }
  
  private checkRateLimit(recipientId: RecipientId): boolean {
    if (!this.config.rateLimitPerRecipient) {
      return true;
    }
    
    const now = this.clock.now().getTime();
    const key = recipientId;
    const limit = this.recipientRateLimits.get(key);
    
    if (!limit || now > limit.resetTime) {
      // Reset or initialize
      this.recipientRateLimits.set(key, {
        count: 1,
        resetTime: now + (this.config.rateLimitPerRecipient.window * 1000)
      });
      return true;
    }
    
    if (limit.count >= this.config.rateLimitPerRecipient.count) {
      return false;
    }
    
    limit.count++;
    return true;
  }
  
  private async getFallbackChannel(primaryChannel: Channel): Promise<Channel | null> {
    // Define fallback hierarchy
    const fallbackMap: Record<Channel, Channel[]> = {
      [Channel.EMAIL]: [Channel.SMS, Channel.PUSH, Channel.IN_APP],
      [Channel.SMS]: [Channel.EMAIL, Channel.PUSH, Channel.IN_APP],
      [Channel.PUSH]: [Channel.EMAIL, Channel.SMS, Channel.IN_APP],
      [Channel.IN_APP]: [Channel.EMAIL, Channel.SMS, Channel.PUSH],
      [Channel.WEBHOOK]: [], // No fallback for webhooks
      [Channel.SLACK]: [],
      [Channel.TEAMS]: [],
      [Channel.DISCORD]: []
    };
    
    const fallbacks = fallbackMap[primaryChannel] || [];
    
    for (const fallback of fallbacks) {
      const channel = this.channels.get(fallback);
      if (channel && channel.isEnabled()) {
        return fallback;
      }
    }
    
    return null;
  }
  
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
