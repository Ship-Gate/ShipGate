/**
 * Webhook channel implementation
 */

import { NotificationChannel, ChannelMessage, ChannelResponse, ChannelConfig, WebhookAddress } from './channel';
import { Notification, NotificationStatus } from '../types';
import { WebhookError, ProviderError } from '../errors';

export interface WebhookConfig extends ChannelConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  defaultHeaders?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'api-key';
    token: string;
    username?: string; // For basic auth
    password?: string; // For basic auth
    headerName?: string; // For api-key auth
  };
}

export interface WebhookMessage extends ChannelMessage {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
}

export class WebhookChannel extends NotificationChannel {
  declare config: WebhookConfig;
  
  constructor(config: WebhookConfig) {
    super(config);
  }
  
  get channelType(): string {
    return 'WEBHOOK';
  }
  
  validateAddress(address: string): boolean {
    try {
      const url = new URL(address);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  formatNotification(notification: Notification): ChannelMessage {
    const webhookUrl = notification.data?.webhookUrl || 
                      notification.data?.url ||
                      notification.recipientEmail; // Fallback to email if URL not provided
    
    if (!webhookUrl || !this.validateAddress(webhookUrl)) {
      throw new WebhookError(webhookUrl || 'undefined', 0);
    }
    
    const payload = {
      notification: {
        id: notification.id,
        subject: notification.subject,
        body: notification.body,
        htmlBody: notification.htmlBody,
        category: notification.category,
        tags: notification.tags,
        priority: notification.priority,
        data: notification.data
      },
      recipient: {
        id: notification.recipientId,
        email: notification.recipientEmail,
        phone: notification.recipientPhone
      },
      timestamp: notification.createdAt.toISOString()
    };
    
    const webhookMessage: WebhookMessage = {
      url: webhookUrl,
      to: webhookUrl,
      method: notification.data?.webhookMethod || 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ISL-Notifications/1.0',
        ...this.config.defaultHeaders,
        ...notification.data?.webhookHeaders
      },
      metadata: {
        notificationId: notification.id,
        category: notification.category,
        tags: notification.tags
      }
    };
    
    return webhookMessage;
  }
  
  async send(message: ChannelMessage): Promise<ChannelResponse> {
    try {
      const webhookMessage = message as WebhookMessage;
      
      // Validate URL
      if (!this.validateAddress(webhookMessage.url)) {
        throw new WebhookError(webhookMessage.url, 0);
      }
      
      // Mock implementation
      if (webhookMessage.url.includes('mock://') || webhookMessage.url.includes('example.com')) {
        return this.mockSend(webhookMessage);
      }
      
      // Real webhook call
      return this.sendHttpRequest(webhookMessage);
    } catch (error) {
      if (error instanceof WebhookError) {
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
  
  private async mockSend(message: WebhookMessage): Promise<ChannelResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    
    // Simulate different response scenarios
    const rand = Math.random();
    if (rand < 0.05) {
      // Connection error
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: 'Connection refused',
        retriable: true
      };
    } else if (rand < 0.1) {
      // HTTP error
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: 'HTTP 500 Internal Server Error',
        retriable: true
      };
    } else if (rand < 0.15) {
      // Client error
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: 'HTTP 400 Bad Request',
        retriable: false
      };
    }
    
    return {
      success: true,
      messageId: `mock_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: NotificationStatus.SENT,
      metadata: {
        provider: 'webhook',
        url: message.url,
        method: message.method,
        statusCode: 200
      }
    };
  }
  
  private async sendHttpRequest(message: WebhookMessage): Promise<ChannelResponse> {
    // In a real implementation, this would use fetch or a HTTP client
    // For now, we'll throw an error to indicate it needs implementation
    throw new ProviderError('webhook', 'Actual HTTP webhook calls not implemented in this version');
  }
}
