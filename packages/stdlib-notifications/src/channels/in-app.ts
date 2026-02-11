/**
 * In-app notification channel implementation
 */

import { NotificationChannel, ChannelMessage, ChannelResponse, ChannelConfig, InAppAddress } from './channel';
import { Notification, NotificationStatus } from '../types';
import { ProviderError } from '../errors';

export interface InAppConfig extends ChannelConfig {
  storage?: 'memory' | 'redis' | 'database';
  maxNotifications?: number;
  ttl?: number; // Time to live in seconds
}

export interface InAppMessage extends ChannelMessage {
  userId: string;
  sessionId?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  readAt?: Date;
  expiresAt?: Date;
}

// In-memory storage for demo purposes
const inAppStore = new Map<string, InAppMessage[]>();

export class InAppChannel extends NotificationChannel {
  declare config: InAppConfig;
  
  constructor(config: InAppConfig) {
    super(config);
  }
  
  get channelType(): string {
    return 'IN_APP';
  }
  
  validateAddress(address: string): boolean {
    // In-app notifications use user IDs
    return address && address.length > 0;
  }
  
  formatNotification(notification: Notification): ChannelMessage {
    const userId = notification.recipientId;
    
    if (!this.validateAddress(userId)) {
      throw new ProviderError('in-app', 'Invalid user ID');
    }
    
    const inAppMessage: InAppMessage = {
      userId,
      sessionId: notification.data?.sessionId,
      to: userId,
      subject: notification.subject,
      body: notification.body,
      htmlBody: notification.htmlBody,
      type: notification.data?.type || this.deriveTypeFromPriority(notification.priority),
      read: false,
      expiresAt: notification.expiresAt,
      metadata: {
        notificationId: notification.id,
        category: notification.category,
        tags: notification.tags,
        actions: notification.actions
      }
    };
    
    return inAppMessage;
  }
  
  async send(message: ChannelMessage): Promise<ChannelResponse> {
    try {
      const inAppMessage = message as InAppMessage;
      
      // Validate user ID
      if (!this.validateAddress(inAppMessage.userId)) {
        throw new ProviderError('in-app', 'Invalid user ID');
      }
      
      // Store the notification
      await this.storeNotification(inAppMessage);
      
      return {
        success: true,
        messageId: `inapp_${inAppMessage.userId}_${Date.now()}`,
        status: NotificationStatus.DELIVERED, // In-app notifications are instantly "delivered"
        metadata: {
          provider: 'in-app',
          userId: inAppMessage.userId,
          type: inAppMessage.type
        }
      };
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        retriable: false
      };
    }
  }
  
  private async storeNotification(message: InAppMessage): Promise<void> {
    const storage = this.config.storage || 'memory';
    
    switch (storage) {
      case 'memory':
        await this.storeInMemory(message);
        break;
      case 'redis':
        await this.storeInRedis(message);
        break;
      case 'database':
        await this.storeInDatabase(message);
        break;
      default:
        throw new ProviderError('in-app', `Unknown storage type: ${storage}`);
    }
  }
  
  private async storeInMemory(message: InAppMessage): Promise<void> {
    const userNotifications = inAppStore.get(message.userId) || [];
    
    // Add new notification
    userNotifications.push(message);
    
    // Apply max notifications limit
    const maxNotifications = this.config.maxNotifications || 50;
    if (userNotifications.length > maxNotifications) {
      userNotifications.splice(0, userNotifications.length - maxNotifications);
    }
    
    // Remove expired notifications
    const now = new Date();
    const validNotifications = userNotifications.filter(n => 
      !n.expiresAt || n.expiresAt > now
    );
    
    inAppStore.set(message.userId, validNotifications);
  }
  
  private async storeInRedis(message: InAppMessage): Promise<void> {
    // Implementation would store in Redis
    throw new ProviderError('in-app', 'Redis storage not implemented');
  }
  
  private async storeInDatabase(message: InAppMessage): Promise<void> {
    // Implementation would store in database
    throw new ProviderError('in-app', 'Database storage not implemented');
  }
  
  private deriveTypeFromPriority(priority: string): 'info' | 'success' | 'warning' | 'error' {
    switch (priority) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'info';
    }
  }
  
  // Helper methods for retrieving notifications
  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<InAppMessage[]> {
    const userNotifications = inAppStore.get(userId) || [];
    
    if (unreadOnly) {
      return userNotifications.filter(n => !n.read);
    }
    
    return userNotifications;
  }
  
  async markAsRead(userId: string, messageId: string): Promise<void> {
    const userNotifications = inAppStore.get(userId) || [];
    const message = userNotifications.find(n => n.metadata?.notificationId === messageId);
    
    if (message && !message.read) {
      message.read = true;
      message.readAt = new Date();
    }
  }
  
  async markAllAsRead(userId: string): Promise<void> {
    const userNotifications = inAppStore.get(userId) || [];
    const now = new Date();
    
    userNotifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        n.readAt = now;
      }
    });
  }
  
  async deleteNotification(userId: string, messageId: string): Promise<void> {
    const userNotifications = inAppStore.get(userId) || [];
    const index = userNotifications.findIndex(n => n.metadata?.notificationId === messageId);
    
    if (index !== -1) {
      userNotifications.splice(index, 1);
    }
  }
}
