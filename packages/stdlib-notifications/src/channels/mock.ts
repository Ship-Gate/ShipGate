/**
 * Mock notification channel for testing
 */

import { NotificationChannel, ChannelMessage, ChannelResponse, ChannelConfig } from './channel';
import { Notification, NotificationStatus, Channel } from '../types';

export interface MockConfig extends ChannelConfig {
  failureRate?: number; // 0-1, probability of failure
  latencyMs?: {
    min: number;
    max: number;
  };
  alwaysSucceed?: boolean;
  alwaysFail?: boolean;
  failureError?: string;
  logMessages?: boolean;
}

export class MockChannel extends NotificationChannel {
  declare config: MockConfig;
  private sentMessages: ChannelMessage[] = [];
  
  constructor(config: MockConfig) {
    super(config);
  }
  
  get channelType(): string {
    return 'MOCK';
  }
  
  validateAddress(address: string): boolean {
    return address && address.length > 0;
  }
  
  formatNotification(notification: Notification): ChannelMessage {
    return {
      to: this.getRecipientAddress(notification),
      subject: notification.subject,
      body: notification.body,
      htmlBody: notification.htmlBody,
      metadata: {
        notificationId: notification.id,
        category: notification.category,
        tags: notification.tags
      }
    };
  }
  
  async send(message: ChannelMessage): Promise<ChannelResponse> {
    // Log message if enabled
    if (this.config.logMessages) {
      console.log(`[MockChannel] Sending to ${message.to}:`, message.body);
    }
    
    // Store message for inspection
    this.sentMessages.push(message);
    
    // Apply latency
    const latency = this.getLatency();
    if (latency > 0) {
      await new Promise(resolve => setTimeout(resolve, latency));
    }
    
    // Determine success/failure
    if (this.config.alwaysFail) {
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: this.config.failureError || 'Mock channel configured to always fail',
        retriable: true
      };
    }
    
    if (this.config.alwaysSucceed) {
      return {
        success: true,
        messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: NotificationStatus.SENT,
        metadata: {
          provider: 'mock',
          latency
        }
      };
    }
    
    // Random failure based on failure rate
    const failureRate = this.config.failureRate || 0;
    if (Math.random() < failureRate) {
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: this.config.failureError || 'Random mock failure',
        retriable: Math.random() < 0.5 // 50% chance of being retriable
      };
    }
    
    // Success
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: NotificationStatus.SENT,
      metadata: {
        provider: 'mock',
        latency
      }
    };
  }
  
  private getRecipientAddress(notification: Notification): string {
    switch (notification.channel) {
      case Channel.EMAIL:
        return notification.recipientEmail || 'mock@example.com';
      case Channel.SMS:
        return notification.recipientPhone || '+1234567890';
      case Channel.PUSH:
        return notification.recipientDeviceToken || 'mock_device_token';
      case Channel.WEBHOOK:
        return notification.data?.webhookUrl || 'https://mock.example.com/webhook';
      case Channel.IN_APP:
        return notification.recipientId;
      default:
        return 'mock@example.com';
    }
  }
  
  private getLatency(): number {
    if (!this.config.latencyMs) {
      return 0;
    }
    
    const { min, max } = this.config.latencyMs;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // Test helper methods
  getSentMessages(): ChannelMessage[] {
    return [...this.sentMessages];
  }
  
  clearSentMessages(): void {
    this.sentMessages = [];
  }
  
  getMessageCount(): number {
    return this.sentMessages.length;
  }
  
  getLastMessage(): ChannelMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }
  
  getMessagesToRecipient(recipient: string): ChannelMessage[] {
    return this.sentMessages.filter(m => m.to === recipient);
  }
}
