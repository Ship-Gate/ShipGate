/**
 * Base channel interface and common types
 */

import { Notification, NotificationStatus, Email, PhoneNumber, DeviceToken } from '../types';

export interface ChannelMessage {
  to: string;
  subject?: string;
  body: string;
  htmlBody?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content?: string;
    url?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ChannelResponse {
  success: boolean;
  messageId?: string;
  status: NotificationStatus;
  error?: string;
  retriable?: boolean;
  metadata?: Record<string, any>;
}

export interface ChannelConfig {
  enabled: boolean;
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
  timeout?: number; // in milliseconds
  retryConfig?: {
    maxAttempts: number;
    backoffMs: number;
  };
  metadata?: Record<string, any>;
}

export abstract class NotificationChannel {
  protected config: ChannelConfig;
  
  constructor(config: ChannelConfig) {
    this.config = config;
  }
  
  abstract get channelType(): string;
  
  abstract validateAddress(address: string): boolean;
  
  abstract send(message: ChannelMessage): Promise<ChannelResponse>;
  
  abstract formatNotification(notification: Notification): ChannelMessage;
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  getRateLimit() {
    return this.config.rateLimit;
  }
  
  getTimeout() {
    return this.config.timeout || 30000; // Default 30 seconds
  }
  
  getRetryConfig() {
    return this.config.retryConfig || {
      maxAttempts: 3,
      backoffMs: 1000
    };
  }
}

// Channel-specific address types
export interface EmailAddress {
  email: Email;
  name?: string;
}

export interface SmsAddress {
  phone: PhoneNumber;
  countryCode?: string;
}

export interface PushAddress {
  token: DeviceToken;
  platform: 'ios' | 'android' | 'web';
}

export interface WebhookAddress {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT' | 'PATCH';
}

export interface InAppAddress {
  userId: string;
  sessionId?: string;
}
