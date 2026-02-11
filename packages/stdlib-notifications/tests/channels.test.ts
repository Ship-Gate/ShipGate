/**
 * Tests for notification channels
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  EmailChannel,
  SmsChannel,
  PushChannel,
  WebhookChannel,
  InAppChannel,
  MockChannel,
  Channel,
  NotificationStatus
} from '../src/channels';
import { Notification, Priority } from '../src/types';

describe('EmailChannel', () => {
  let channel: EmailChannel;
  let notification: Notification;
  
  beforeEach(() => {
    channel = new EmailChannel({
      enabled: true,
      provider: 'mock',
      from: { email: 'sender@example.com', name: 'Test Sender' }
    });
    
    notification = {
      id: 'notif-123',
      templateId: 'template-123',
      recipientId: 'user-123',
      recipientEmail: 'recipient@example.com',
      channel: Channel.EMAIL,
      subject: 'Test Subject',
      body: 'Test body',
      status: NotificationStatus.SENDING,
      priority: Priority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });
  
  it('should validate email addresses', () => {
    expect(channel.validateAddress('test@example.com')).toBe(true);
    expect(channel.validateAddress('invalid-email')).toBe(false);
    expect(channel.validateAddress('')).toBe(false);
  });
  
  it('should format notification for email', () => {
    const message = channel.formatNotification(notification);
    
    expect(message.to).toBe('recipient@example.com');
    expect(message.subject).toBe('Test Subject');
    expect(message.body).toBe('Test body');
  });
  
  it('should send email successfully', async () => {
    const response = await channel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(true);
    expect(response.status).toBe(NotificationStatus.SENT);
    expect(response.messageId).toBeDefined();
  });
  
  it('should handle sending failures', async () => {
    // Create a channel with high failure rate
    const failingChannel = new EmailChannel({
      enabled: true,
      provider: 'mock',
      from: { email: 'sender@example.com' }
    });
    (failingChannel as any).config.failureRate = 1;
    
    const response = await failingChannel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(false);
    expect(response.status).toBe(NotificationStatus.FAILED);
    expect(response.error).toBeDefined();
  });
});

describe('SmsChannel', () => {
  let channel: SmsChannel;
  let notification: Notification;
  
  beforeEach(() => {
    channel = new SmsChannel({
      enabled: true,
      provider: 'mock',
      from: '+1234567890'
    });
    
    notification = {
      id: 'notif-123',
      templateId: 'template-123',
      recipientId: 'user-123',
      recipientPhone: '+1987654321',
      channel: Channel.SMS,
      body: 'Test SMS message',
      status: NotificationStatus.SENDING,
      priority: Priority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });
  
  it('should validate phone numbers', () => {
    expect(channel.validateAddress('+1234567890')).toBe(true);
    expect(channel.validateAddress('1234567890')).toBe(false);
    expect(channel.validateAddress('+0123456789')).toBe(false); // Can't start with 0
  });
  
  it('should format notification for SMS', () => {
    const message = channel.formatNotification(notification);
    
    expect(message.to).toBe('+1987654321');
    expect(message.body).toBe('Test SMS message');
    expect(message.subject).toBeUndefined(); // SMS doesn't have subject
  });
  
  it('should reject messages that are too long', async () => {
    const longMessage = 'a'.repeat(2000);
    notification.body = longMessage;
    
    const response = await channel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('too long');
  });
});

describe('PushChannel', () => {
  let channel: PushChannel;
  let notification: Notification;
  
  beforeEach(() => {
    channel = new PushChannel({
      enabled: true,
      provider: 'mock'
    });
    
    notification = {
      id: 'notif-123',
      templateId: 'template-123',
      recipientId: 'user-123',
      recipientDeviceToken: 'device-token-123456789',
      channel: Channel.PUSH,
      body: 'Test push message',
      data: {
        title: 'Push Title',
        imageUrl: 'https://example.com/image.png',
        badge: 1
      },
      status: NotificationStatus.SENDING,
      priority: Priority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });
  
  it('should validate device tokens', () => {
    expect(channel.validateAddress('device-token-123456789')).toBe(true);
    expect(channel.validateAddress('short')).toBe(false);
    expect(channel.validateAddress('')).toBe(false);
  });
  
  it('should format notification for push', () => {
    const message = channel.formatNotification(notification);
    
    expect(message.to).toBe('device-token-123456789');
    expect(message.body).toBe('Test push message');
    expect((message as any).title).toBe('Push Title');
    expect((message as any).imageUrl).toBe('https://example.com/image.png');
    expect((message as any).badge).toBe(1);
  });
  
  it('should reject payloads that are too large', async () => {
    // Create a large data object
    const largeData = { data: 'x'.repeat(5000) };
    notification.data = largeData;
    
    const response = await channel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('too large');
  });
});

describe('WebhookChannel', () => {
  let channel: WebhookChannel;
  let notification: Notification;
  
  beforeEach(() => {
    channel = new WebhookChannel({
      enabled: true,
      timeout: 5000
    });
    
    notification = {
      id: 'notif-123',
      templateId: 'template-123',
      recipientId: 'user-123',
      channel: Channel.WEBHOOK,
      body: 'Webhook payload',
      data: {
        webhookUrl: 'https://mock.example.com/webhook',
        webhookMethod: 'POST'
      },
      status: NotificationStatus.SENDING,
      priority: Priority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });
  
  it('should validate URLs', () => {
    expect(channel.validateAddress('https://example.com/webhook')).toBe(true);
    expect(channel.validateAddress('http://localhost:3000/webhook')).toBe(true);
    expect(channel.validateAddress('invalid-url')).toBe(false);
    expect(channel.validateAddress('ftp://example.com')).toBe(false);
  });
  
  it('should format notification for webhook', () => {
    const message = channel.formatNotification(notification);
    
    expect((message as any).url).toBe('https://mock.example.com/webhook');
    expect((message as any).method).toBe('POST');
    const payload = JSON.parse(message.body!);
    expect(payload.notification.body).toBe('Webhook payload');
  });
  
  it('should handle mock webhook calls', async () => {
    const response = await channel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(true);
    expect(response.status).toBe(NotificationStatus.SENT);
  });
});

describe('InAppChannel', () => {
  let channel: InAppChannel;
  let notification: Notification;
  
  beforeEach(() => {
    channel = new InAppChannel({
      enabled: true,
      storage: 'memory',
      maxNotifications: 10
    });
    
    notification = {
      id: 'notif-123',
      templateId: 'template-123',
      recipientId: 'user-123',
      channel: Channel.IN_APP,
      body: 'In-app notification',
      data: {
        type: 'info',
        sessionId: 'session-123'
      },
      status: NotificationStatus.SENDING,
      priority: Priority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });
  
  it('should validate user IDs', () => {
    expect(channel.validateAddress('user-123')).toBe(true);
    expect(channel.validateAddress('')).toBe(false);
  });
  
  it('should store and retrieve notifications', async () => {
    const response = await channel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(true);
    expect(response.status).toBe(NotificationStatus.DELIVERED);
    
    // Retrieve notifications
    const notifications = await channel.getNotifications('user-123');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe('In-app notification');
    expect(notifications[0].read).toBe(false);
  });
  
  it('should mark notifications as read', async () => {
    await channel.send(channel.formatNotification(notification));
    
    await channel.markAsRead('user-123', 'notif-123');
    
    const notifications = await channel.getNotifications('user-123');
    expect(notifications[0].read).toBe(true);
    expect(notifications[0].readAt).toBeDefined();
  });
  
  it('should limit stored notifications', async () => {
    const limitedChannel = new InAppChannel({
      enabled: true,
      storage: 'memory',
      maxNotifications: 2
    });
    
    // Send 3 notifications
    for (let i = 0; i < 3; i++) {
      const notif = { ...notification, id: `notif-${i}` };
      await limitedChannel.send(limitedChannel.formatNotification(notif));
    }
    
    const notifications = await limitedChannel.getNotifications('user-123');
    expect(notifications).toHaveLength(2); // Should be limited to 2
  });
});

describe('MockChannel', () => {
  let channel: MockChannel;
  let notification: Notification;
  
  beforeEach(() => {
    channel = new MockChannel({
      enabled: true,
      failureRate: 0.2, // 20% failure rate
      latencyMs: { min: 10, max: 50 }
    });
    
    notification = {
      id: 'notif-123',
      templateId: 'template-123',
      recipientId: 'user-123',
      channel: Channel.EMAIL,
      recipientEmail: 'test@example.com',
      subject: 'Test',
      body: 'Test body',
      status: NotificationStatus.SENDING,
      priority: Priority.NORMAL,
      createdAt: new Date(),
      updatedAt: new Date(),
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
  });
  
  it('should track sent messages', async () => {
    expect(channel.getMessageCount()).toBe(0);
    
    await channel.send(channel.formatNotification(notification));
    
    expect(channel.getMessageCount()).toBe(1);
    
    const sent = channel.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('test@example.com');
  });
  
  it('should always succeed when configured', async () => {
    const alwaysSuccessChannel = new MockChannel({
      enabled: true,
      alwaysSucceed: true
    });
    
    const response = await alwaysSuccessChannel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(true);
  });
  
  it('should always fail when configured', async () => {
    const alwaysFailChannel = new MockChannel({
      enabled: true,
      alwaysFail: true,
      failureError: 'Configured failure'
    });
    
    const response = await alwaysFailChannel.send(channel.formatNotification(notification));
    
    expect(response.success).toBe(false);
    expect(response.error).toBe('Configured failure');
  });
  
  it('should filter messages by recipient', async () => {
    const notification2 = { ...notification, id: 'notif-456', recipientEmail: 'other@example.com' };
    
    await channel.send(channel.formatNotification(notification));
    await channel.send(channel.formatNotification(notification2));
    
    const messagesToTest = channel.getMessagesToRecipient('test@example.com');
    expect(messagesToTest).toHaveLength(1);
    expect(messagesToTest[0].to).toBe('test@example.com');
  });
});
