/**
 * Main notification service that orchestrates all components
 */

import { 
  NotificationChannel,
  EmailChannel,
  SmsChannel,
  PushChannel,
  WebhookChannel,
  InAppChannel,
  MockChannel,
  EmailConfig,
  SmsConfig,
  PushConfig,
  WebhookConfig,
  InAppConfig,
  MockConfig
} from './channels';
import { 
  TemplateRegistry,
  TemplateEngine
} from './templates';
import {
  InMemoryDeliveryTracker,
  InMemoryScheduler,
  NotificationDispatcher
} from './delivery';
import {
  InMemoryPreferencesStore,
  DefaultPreferencesManager
} from './preferences';
import { 
  Channel,
  Priority,
  CreateNotificationInput,
  SendResult,
  Notification,
  Clock
} from './types';

export interface NotificationServiceConfig {
  // Channel configurations
  email?: EmailConfig;
  sms?: SmsConfig;
  push?: PushConfig;
  webhook?: WebhookConfig;
  inApp?: InAppConfig;
  mock?: MockConfig;
  
  // Service configuration
  defaultLocale?: string;
  timezone?: string;
  clock?: Clock;
  
  // Dispatch configuration
  maxRetries?: number;
  retryDelay?: number;
  fallbackChannels?: boolean;
  respectQuietHours?: boolean;
  rateLimitPerRecipient?: {
    count: number;
    window: number;
  };
}

export class NotificationService {
  private channels: Map<Channel, NotificationChannel> = new Map();
  private templateRegistry: TemplateRegistry;
  private templateEngine: TemplateEngine;
  private deliveryTracker: InMemoryDeliveryTracker;
  private scheduler: InMemoryScheduler;
  private preferencesStore: InMemoryPreferencesStore;
  private preferencesManager: DefaultPreferencesManager;
  private dispatcher: NotificationDispatcher;
  
  constructor(config: NotificationServiceConfig = {}) {
    // Initialize core components
    this.templateRegistry = new TemplateRegistry();
    this.templateEngine = new TemplateEngine();
    this.deliveryTracker = new InMemoryDeliveryTracker();
    this.scheduler = new InMemoryScheduler(config.clock);
    this.preferencesStore = new InMemoryPreferencesStore();
    this.preferencesManager = new DefaultPreferencesManager(
      this.preferencesStore,
      {
        locale: config.defaultLocale || 'en',
        timezone: config.timezone || 'UTC'
      }
    );
    
    // Initialize dispatcher
    this.dispatcher = new NotificationDispatcher({
      tracker: this.deliveryTracker,
      scheduler: this.scheduler,
      templateRegistry: this.templateRegistry,
      templateEngine: this.templateEngine,
      preferencesManager: this.preferencesManager,
      clock: config.clock,
      config: {
        maxRetries: config.maxRetries,
        retryDelay: config.retryDelay,
        fallbackChannels: config.fallbackChannels,
        respectQuietHours: config.respectQuietHours,
        rateLimitPerRecipient: config.rateLimitPerRecipient
      }
    });
    
    // Initialize channels
    this.initializeChannels(config);
  }
  
  private initializeChannels(config: NotificationServiceConfig): void {
    // Email channel
    if (config.email) {
      const emailChannel = new EmailChannel(config.email);
      this.registerChannel(emailChannel);
    }
    
    // SMS channel
    if (config.sms) {
      const smsChannel = new SmsChannel(config.sms);
      this.registerChannel(smsChannel);
    }
    
    // Push channel
    if (config.push) {
      const pushChannel = new PushChannel(config.push);
      this.registerChannel(pushChannel);
    }
    
    // Webhook channel
    if (config.webhook) {
      const webhookChannel = new WebhookChannel(config.webhook);
      this.registerChannel(webhookChannel);
    }
    
    // In-app channel
    if (config.inApp) {
      const inAppChannel = new InAppChannel(config.inApp);
      this.registerChannel(inAppChannel);
    }
    
    // Mock channel (for testing)
    if (config.mock) {
      const mockChannel = new MockChannel(config.mock);
      this.registerChannel(mockChannel);
    }
  }
  
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.channelType as Channel, channel);
    this.dispatcher.registerChannel(channel);
  }
  
  getChannel(channelType: Channel): NotificationChannel | undefined {
    return this.channels.get(channelType);
  }
  
  // Template management
  async createTemplate(input: any) {
    return await this.templateRegistry.createTemplate(input);
  }
  
  async updateTemplate(id: string, updates: any) {
    return await this.templateRegistry.updateTemplate(id, updates);
  }
  
  async getTemplate(id: string) {
    return await this.templateRegistry.getTemplate(id);
  }
  
  async listTemplates(filter?: any) {
    return await this.templateRegistry.listTemplates(filter);
  }
  
  async deleteTemplate(id: string) {
    return await this.templateRegistry.deleteTemplate(id);
  }
  
  // Notification sending
  async send(input: CreateNotificationInput): Promise<SendResult> {
    return await this.dispatcher.send(input);
  }
  
  async sendBatch(inputs: CreateNotificationInput[]) {
    return await this.dispatcher.sendBatch(inputs);
  }
  
  // Preferences management
  async getPreferences(recipientId: string) {
    return await this.preferencesManager.getPreferences(recipientId);
  }
  
  async updatePreferences(recipientId: string, updates: any) {
    return await this.preferencesManager.updatePreferences(recipientId, updates);
  }
  
  async enableChannel(recipientId: string, channel: Channel, address?: string) {
    return await this.preferencesManager.enableChannel(recipientId, channel, address);
  }
  
  async disableChannel(recipientId: string, channel: Channel) {
    return await this.preferencesManager.disableChannel(recipientId, channel);
  }
  
  async subscribeToCategory(recipientId: string, category: string) {
    return await this.preferencesManager.subscribeToCategory(recipientId, category);
  }
  
  async unsubscribeFromCategory(recipientId: string, category: string) {
    return await this.preferencesManager.unsubscribeFromCategory(recipientId, category);
  }
  
  // Delivery tracking
  async getDeliveryEvents(notificationId: string) {
    return await this.deliveryTracker.getEvents(notificationId);
  }
  
  async getDeliveryStats(filter?: any) {
    return await this.deliveryTracker.getStats(filter);
  }
  
  // Scheduling
  async getScheduledNotifications(maxCount?: number) {
    return await this.scheduler.getScheduled(maxCount);
  }
  
  // Convenience methods for common use cases
  
  /**
   * Send a simple email notification
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    htmlBody?: string;
    recipientId: string;
    templateId?: string;
    variables?: Record<string, any>;
    priority?: Priority;
  }) {
    const input: CreateNotificationInput = {
      templateId: params.templateId || 'simple-email',
      recipientId: params.recipientId,
      recipientEmail: params.to,
      channel: Channel.EMAIL,
      subject: params.subject,
      body: params.body,
      htmlBody: params.htmlBody,
      data: params.variables,
      priority: params.priority || Priority.NORMAL
    };
    
    return await this.send(input);
  }
  
  /**
   * Send a simple SMS notification
   */
  async sendSMS(params: {
    to: string;
    body: string;
    recipientId: string;
    templateId?: string;
    variables?: Record<string, any>;
    priority?: Priority;
  }) {
    const input: CreateNotificationInput = {
      templateId: params.templateId || 'simple-sms',
      recipientId: params.recipientId,
      recipientPhone: params.to,
      channel: Channel.SMS,
      body: params.body,
      data: params.variables,
      priority: params.priority || Priority.NORMAL
    };
    
    return await this.send(input);
  }
  
  /**
   * Send a simple push notification
   */
  async sendPush(params: {
    to: string;
    title?: string;
    body: string;
    recipientId: string;
    templateId?: string;
    variables?: Record<string, any>;
    priority?: Priority;
  }) {
    const input: CreateNotificationInput = {
      templateId: params.templateId || 'simple-push',
      recipientId: params.recipientId,
      recipientDeviceToken: params.to,
      channel: Channel.PUSH,
      body: params.body,
      data: {
        ...params.variables,
        title: params.title
      },
      priority: params.priority || Priority.NORMAL
    };
    
    return await this.send(input);
  }
  
  /**
   * Send a multi-channel notification with fallback
   */
  async sendMultiChannel(params: {
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientDeviceToken?: string;
    templateId: string;
    variables?: Record<string, any>;
    channels?: Channel[];
    subject?: string;
    priority?: Priority;
    category?: string;
  }) {
    const input: CreateNotificationInput = {
      templateId: params.templateId,
      recipientId: params.recipientId,
      recipientEmail: params.recipientEmail,
      recipientPhone: params.recipientPhone,
      recipientDeviceToken: params.recipientDeviceToken,
      channels: params.channels || [Channel.EMAIL, Channel.SMS, Channel.PUSH],
      data: params.variables,
      subject: params.subject,
      priority: params.priority || Priority.NORMAL,
      category: params.category
    };
    
    return await this.send(input);
  }
  
  /**
   * Create a test service with mock channels
   */
  static createTestService(overrides?: Partial<NotificationServiceConfig>): NotificationService {
    return new NotificationService({
      mock: {
        enabled: true,
        failureRate: 0, // Always succeed for tests
        logMessages: true
      },
      email: {
        enabled: true,
        provider: 'mock',
        from: { email: 'test@example.com' }
      },
      sms: {
        enabled: true,
        provider: 'mock',
        from: '+1234567890'
      },
      push: {
        enabled: true,
        provider: 'mock'
      },
      ...overrides
    });
  }
  
  /**
   * Create a production service with real channel configurations
   */
  static createProductionService(config: NotificationServiceConfig): NotificationService {
    return new NotificationService({
      fallbackChannels: true,
      respectQuietHours: true,
      maxRetries: 3,
      retryDelay: 5000,
      rateLimitPerRecipient: {
        count: 10,
        window: 3600
      },
      ...config
    });
  }
}
