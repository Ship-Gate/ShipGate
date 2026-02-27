/**
 * Comprehensive tests for the notification system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  NotificationService,
  EmailChannel,
  SmsChannel,
  PushChannel,
  MockChannel,
  TemplateRegistry,
  TemplateEngine,
  InMemoryDeliveryTracker,
  InMemoryScheduler,
  InMemoryPreferencesStore,
  DefaultPreferencesManager,
  NotificationDispatcher
} from '../src';
import { 
  Channel, 
  Priority, 
  NotificationStatus,
  QuietHours,
  DigestFrequency
} from '../src/types';
import { UnsubscribedError, QuietHoursError } from '../src/errors';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockClock: any;
  
  beforeEach(() => {
    mockClock = {
      now: () => new Date('2024-01-01T12:00:00Z')
    };
    
    service = NotificationService.createTestService({
      clock: mockClock,
      mock: {
        enabled: true,
        failureRate: 0,
        logMessages: false
      }
    });
  });
  
  describe('Template Management', () => {
    it('should create and retrieve templates', async () => {
      const template = await service.createTemplate({
        id: 'welcome-email',
        name: 'Welcome Email',
        channels: {
          EMAIL: {
            subject: 'Welcome {{variables.name}}!',
            body: 'Hello {{variables.name}}, welcome to our service!',
            htmlBody: '<h1>Welcome {{variables.name}}!</h1><p>Hello {{variables.name}}, welcome to our service!</p>'
          }
        },
        variables: [
          { name: 'name', type: 'STRING' as any, required: true }
        ]
      });
      
      expect(template.id).toBe('welcome-email');
      expect(template.channels.size).toBe(1);
      
      const retrieved = await service.getTemplate('welcome-email');
      expect(retrieved.id).toBe('welcome-email');
    });
    
    it('should list templates with filters', async () => {
      await service.createTemplate({
        id: 'template1',
        name: 'Template 1',
        category: 'marketing',
        channels: {
          EMAIL: { body: 'Test 1' }
        }
      });
      
      await service.createTemplate({
        id: 'template2',
        name: 'Template 2',
        category: 'transactional',
        channels: {
          EMAIL: { body: 'Test 2' }
        }
      });
      
      const all = await service.listTemplates();
      expect(all).toHaveLength(2);
      
      const marketing = await service.listTemplates({ category: 'marketing' });
      expect(marketing).toHaveLength(1);
      expect(marketing[0].category).toBe('marketing');
    });
  });
  
  describe('Multi-channel Dispatch', () => {
    beforeEach(async () => {
      // Create a test template
      await service.createTemplate({
        id: 'test-template',
        name: 'Test Template',
        channels: {
          EMAIL: {
            subject: 'Test Subject',
            body: 'Test body for {{variables.name}}'
          },
          SMS: {
            body: 'SMS: Test body for {{variables.name}}'
          },
          PUSH: {
            title: 'Push Title',
            body: 'Push: Test body for {{variables.name}}'
          }
        },
        variables: [
          { name: 'name', type: 'STRING' as any, required: true }
        ]
      });
      
      // Set up recipient preferences
      await service.updatePreferences('user-123', {
        channelPreferences: {
          EMAIL: { enabled: true },
          SMS: { enabled: true },
          PUSH: { enabled: true }
        }
      });
    });
    
    it('should send to multiple channels', async () => {
      const result = await service.sendMultiChannel({
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        recipientPhone: '+1234567890',
        recipientDeviceToken: 'device-token-123',
        templateId: 'test-template',
        variables: { name: 'John' }
      });
      
      expect(result.notifications).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      
      const channels = result.notifications.map(n => n.channel);
      expect(channels).toContain(Channel.EMAIL);
      expect(channels).toContain(Channel.SMS);
      expect(channels).toContain(Channel.PUSH);
      
      // Check rendered content
      const email = result.notifications.find(n => n.channel === Channel.EMAIL);
      expect(email?.subject).toBe('Test Subject');
      expect(email?.body).toBe('Test body for John');
    });
    
    it('should use fallback when primary channel fails', async () => {
      // Create a service with failing email channel
      const failingService = new NotificationService({
        clock: mockClock,
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
        mock: {
          enabled: true,
          failureRate: 0,
          logMessages: false
        },
        fallbackChannels: true
      });
      
      // Make email channel fail
      const emailChannel = failingService.getChannel(Channel.EMAIL) as MockChannel;
      emailChannel['config'].failureRate = 1; // Always fail
      
      await failingService.createTemplate({
        id: 'fallback-test',
        name: 'Fallback Test',
        channels: {
          EMAIL: { subject: 'Test', body: 'Test' },
          SMS: { body: 'SMS fallback' }
        }
      });
      
      const result = await failingService.send({
        templateId: 'fallback-test',
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        recipientPhone: '+1234567890',
        channel: Channel.EMAIL
      });
      
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].channel).toBe(Channel.SMS);
    });
  });
  
  describe('Template Rendering', () => {
    beforeEach(async () => {
      await service.createTemplate({
        id: 'render-test',
        name: 'Render Test',
        channels: {
          EMAIL: {
            subject: 'Order {{variables.orderNumber}}',
            body: 'Your order {{variables.orderNumber}} total is ${{variables.total | number:2}}',
            htmlBody: '<p>Your order <strong>{{variables.orderNumber}}</strong> total is ${{variables.total | number:2}}</p>'
          }
        },
        variables: [
          { name: 'orderNumber', type: 'STRING' as any, required: true },
          { name: 'total', type: 'NUMBER' as any, required: true }
        ]
      });
    });
    
    it('should render templates with variables and filters', async () => {
      const result = await service.sendEmail({
        to: 'test@example.com',
        recipientId: 'user-123',
        templateId: 'render-test',
        variables: {
          orderNumber: 'ORD-001',
          total: 123.456
        }
      });
      
      const notification = result.notifications[0];
      expect(notification.subject).toBe('Order ORD-001');
      expect(notification.body).toBe('Your order ORD-001 total is $123.46');
      expect(notification.htmlBody).toBe('<p>Your order <strong>ORD-001</strong> total is $123.46</p>');
    });
    
    it('should escape HTML in email templates', async () => {
      await service.createTemplate({
        id: 'xss-test',
        name: 'XSS Test',
        channels: {
          EMAIL: {
            subject: 'Test',
            body: 'Hello {{variables.name}}',
            htmlBody: 'Hello <strong>{{variables.name}}</strong>'
          }
        }
      });
      
      const result = await service.sendEmail({
        to: 'test@example.com',
        recipientId: 'user-123',
        templateId: 'xss-test',
        variables: {
          name: '<script>alert("xss")</script>'
        }
      });
      
      const notification = result.notifications[0];
      expect(notification.htmlBody).toBe('Hello <strong>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</strong>');
    });
  });
  
  describe('User Preferences', () => {
    beforeEach(async () => {
      await service.createTemplate({
        id: 'pref-test',
        name: 'Pref Test',
        category: 'marketing',
        channels: {
          EMAIL: { subject: 'Marketing', body: 'Marketing email' },
          SMS: { body: 'Marketing SMS' }
        }
      });
    });
    
    it('should respect channel preferences', async () => {
      await service.updatePreferences('user-123', {
        channelPreferences: {
          EMAIL: { enabled: false },
          SMS: { enabled: true }
        }
      });
      
      const result = await service.send({
        templateId: 'pref-test',
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        recipientPhone: '+1234567890',
        channels: [Channel.EMAIL, Channel.SMS]
      });
      
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].channel).toBe(Channel.SMS);
    });
    
    it('should respect category opt-outs', async () => {
      await service.unsubscribeFromCategory('user-123', 'marketing');
      
      await expect(
        service.send({
          templateId: 'pref-test',
          recipientId: 'user-123',
          recipientEmail: 'test@example.com',
          channel: Channel.EMAIL
        })
      ).rejects.toThrow(UnsubscribedError);
    });
    
    it('should respect quiet hours', async () => {
      await service.updatePreferences('user-123', {
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        }
      });
      
      // Mock current time to be during quiet hours
      mockClock.now = () => new Date('2024-01-01T23:00:00Z');
      
      await expect(
        service.send({
          templateId: 'pref-test',
          recipientId: 'user-123',
          recipientEmail: 'test@example.com',
          channel: Channel.EMAIL,
          priority: Priority.NORMAL
        })
      ).rejects.toThrow(QuietHoursError);
      
      // But critical messages should still go through
      const result = await service.send({
        templateId: 'pref-test',
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        channel: Channel.EMAIL,
        priority: Priority.CRITICAL
      });
      
      expect(result.notifications).toHaveLength(1);
    });
  });
  
  describe('Delivery Tracking', () => {
    it('should track delivery events', async () => {
      await service.createTemplate({
        id: 'tracking-test',
        name: 'Tracking Test',
        channels: {
          EMAIL: { subject: 'Test', body: 'Test' }
        }
      });
      
      const result = await service.sendEmail({
        to: 'test@example.com',
        recipientId: 'user-123',
        templateId: 'tracking-test'
      });
      
      const notificationId = result.notifications[0].id;
      
      // Get delivery events
      const events = await service.getDeliveryEvents(notificationId);
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe(NotificationStatus.SENT);
      
      // Get stats
      const stats = await service.getDeliveryStats();
      expect(stats.total).toBe(1);
      expect(stats.sent).toBe(1);
    });
  });
  
  describe('Scheduled Notifications', () => {
    it('should schedule notifications for future delivery', async () => {
      await service.createTemplate({
        id: 'scheduled-test',
        name: 'Scheduled Test',
        channels: {
          EMAIL: { subject: 'Scheduled', body: 'Scheduled email' }
        }
      });
      
      const scheduledTime = new Date('2024-01-01T15:00:00Z');
      
      await service.send({
        templateId: 'scheduled-test',
        recipientId: 'user-123',
        recipientEmail: 'test@example.com',
        channel: Channel.EMAIL,
        scheduledAt: scheduledTime
      });
      
      const scheduled = await service.getScheduledNotifications();
      expect(scheduled).toHaveLength(1);
    });
  });
  
  describe('Batch Operations', () => {
    beforeEach(async () => {
      await service.createTemplate({
        id: 'batch-test',
        name: 'Batch Test',
        channels: {
          EMAIL: { subject: 'Batch', body: 'Batch email for {{variables.name}}' }
        },
        variables: [
          { name: 'name', type: 'STRING' as any, required: true }
        ]
      });
    });
    
    it('should send batch notifications', async () => {
      const inputs = [
        {
          templateId: 'batch-test',
          recipientId: 'user-1',
          recipientEmail: 'user1@example.com',
          channel: Channel.EMAIL,
          data: { name: 'User 1' }
        },
        {
          templateId: 'batch-test',
          recipientId: 'user-2',
          recipientEmail: 'user2@example.com',
          channel: Channel.EMAIL,
          data: { name: 'User 2' }
        },
        {
          templateId: 'batch-test',
          recipientId: 'user-3',
          recipientEmail: 'user3@example.com',
          channel: Channel.EMAIL,
          data: { name: 'User 3' }
        }
      ];
      
      const result = await service.sendBatch(inputs);
      
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      
      const bodies = result.successful.map(n => n.body);
      expect(bodies).toContain('Batch email for User 1');
      expect(bodies).toContain('Batch email for User 2');
      expect(bodies).toContain('Batch email for User 3');
    });
  });
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits per recipient', async () => {
      const serviceWithRateLimit = new NotificationService({
        clock: mockClock,
        mock: { enabled: true },
        rateLimitPerRecipient: {
          count: 2,
          window: 3600
        }
      });
      
      await serviceWithRateLimit.createTemplate({
        id: 'rate-limit-test',
        name: 'Rate Limit Test',
        channels: {
          EMAIL: { subject: 'Test', body: 'Test' }
        }
      });
      
      // Send first two - should succeed
      const result1 = await serviceWithRateLimit.sendEmail({
        to: 'test@example.com',
        recipientId: 'user-123',
        templateId: 'rate-limit-test'
      });
      expect(result1.notifications).toHaveLength(1);
      
      const result2 = await serviceWithRateLimit.sendEmail({
        to: 'test@example.com',
        recipientId: 'user-123',
        templateId: 'rate-limit-test'
      });
      expect(result2.notifications).toHaveLength(1);
      
      // Third should fail due to rate limit
      await expect(
        serviceWithRateLimit.sendEmail({
          to: 'test@example.com',
          recipientId: 'user-123',
          templateId: 'rate-limit-test'
        })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });
});
