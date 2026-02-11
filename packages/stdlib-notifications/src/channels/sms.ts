/**
 * SMS channel implementation
 */

import { NotificationChannel, ChannelMessage, ChannelResponse, ChannelConfig, SmsAddress } from './channel';
import { Notification, NotificationStatus } from '../types';
import { PhoneValidationError, ProviderError } from '../errors';

export interface SmsConfig extends ChannelConfig {
  provider?: 'twilio' | 'vonage' | 'plivo' | 'sns' | 'mock';
  from: string; // From phone number or sender ID
  alphaNumeric?: boolean;
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  region?: string;
}

export class SmsChannel extends NotificationChannel {
  declare config: SmsConfig;
  
  constructor(config: SmsConfig) {
    super(config);
  }
  
  get channelType(): string {
    return 'SMS';
  }
  
  validateAddress(address: string): boolean {
    // E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(address);
  }
  
  formatNotification(notification: Notification): ChannelMessage {
    if (!notification.recipientPhone) {
      throw new PhoneValidationError(notification.recipientPhone || 'undefined');
    }
    
    // SMS doesn't support HTML or attachments
    return {
      to: notification.recipientPhone,
      body: notification.body,
      metadata: {
        notificationId: notification.id,
        category: notification.category,
        tags: notification.tags
      }
    };
  }
  
  async send(message: ChannelMessage): Promise<ChannelResponse> {
    try {
      // Validate phone number
      if (!this.validateAddress(message.to)) {
        throw new PhoneValidationError(message.to);
      }
      
      // Check message length (SMS limit is typically 160 characters for GSM-7)
      if (message.body.length > 1600) { // Allow for multi-part messages
        throw new ProviderError('sms', 'Message too long for SMS');
      }
      
      // Mock implementation
      if (this.config.provider === 'mock' || !this.config.provider) {
        return this.mockSend(message);
      }
      
      // Real provider implementations
      switch (this.config.provider) {
        case 'twilio':
          return this.sendViaTwilio(message);
        case 'vonage':
          return this.sendViaVonage(message);
        case 'plivo':
          return this.sendViaPlivo(message);
        case 'sns':
          return this.sendViaSNS(message);
        default:
          throw new ProviderError(this.config.provider, 'Unknown provider');
      }
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
  
  private async mockSend(message: ChannelMessage): Promise<ChannelResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
    
    // Simulate occasional failure (5% chance - SMS is generally more reliable)
    if (Math.random() < 0.05) {
      return {
        success: false,
        status: NotificationStatus.FAILED,
        error: 'Mock SMS failure',
        retriable: true
      };
    }
    
    return {
      success: true,
      messageId: `mock_sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: NotificationStatus.SENT,
      metadata: {
        provider: 'mock',
        from: this.config.from,
        segments: Math.ceil(message.body.length / 160)
      }
    };
  }
  
  private async sendViaTwilio(message: ChannelMessage): Promise<ChannelResponse> {
    // Implementation would use Twilio SDK
    throw new ProviderError('twilio', 'Twilio integration not implemented');
  }
  
  private async sendViaVonage(message: ChannelMessage): Promise<ChannelResponse> {
    // Implementation would use Vonage/Nexmo SDK
    throw new ProviderError('vonage', 'Vonage integration not implemented');
  }
  
  private async sendViaPlivo(message: ChannelMessage): Promise<ChannelResponse> {
    // Implementation would use Plivo SDK
    throw new ProviderError('plivo', 'Plivo integration not implemented');
  }
  
  private async sendViaSNS(message: ChannelMessage): Promise<ChannelResponse> {
    // Implementation would use AWS SNS SDK
    throw new ProviderError('sns', 'AWS SNS integration not implemented');
  }
}
