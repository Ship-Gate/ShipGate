/**
 * Notifications Standard Library Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Templates
  templateStore,
  TemplateStore,
  TemplateError,
  renderTemplate,
  validateTemplate,
  type Template,
  type NotificationChannel,
  
  // Email
  emailStore,
  EmailStore,
  EmailError,
  
  // SMS
  smsStore,
  SMSStore,
  SMSError,
  
  // Push
  pushStore,
  PushStore,
  PushError,
  
  // Behaviors
  SendEmail,
  SendSMS,
  SendPush,
  BatchSend,
  CreateTemplate,
  GetTemplate,
  DeleteTemplate,
  SendVerificationSMS,
  RegisterDevice,
  UnregisterDevice,
} from '../implementations/typescript/index.js';

// ============================================================================
// TEMPLATE TESTS
// ============================================================================

describe('TemplateStore', () => {
  let store: TemplateStore;

  beforeEach(() => {
    store = new TemplateStore();
  });

  describe('createTemplate', () => {
    it('should create an email template', () => {
      const template = store.createTemplate({
        id: 'welcome-email',
        channel: 'EMAIL',
        name: 'Welcome Email',
        subject: 'Welcome to {{app_name}}!',
        body: 'Hello {{name}}, welcome to our platform!',
      }, 'test-user');

      expect(template.id).toBe('welcome-email');
      expect(template.channel).toBe('EMAIL');
      expect(template.subject).toBe('Welcome to {{app_name}}!');
      expect(template.variables).toHaveLength(2);
      expect(template.active).toBe(true);
      expect(template.version).toBe(1);
    });

    it('should create an SMS template', () => {
      const template = store.createTemplate({
        id: 'otp-sms',
        channel: 'SMS',
        name: 'OTP SMS',
        body: 'Your verification code is {{code}}. Valid for {{minutes}} minutes.',
      }, 'test-user');

      expect(template.channel).toBe('SMS');
      expect(template.variables).toHaveLength(2);
    });

    it('should reject duplicate template IDs', () => {
      store.createTemplate({
        id: 'test-template',
        channel: 'EMAIL',
        name: 'Test',
        subject: 'Test',
        body: 'Test',
      }, 'test-user');

      expect(() => store.createTemplate({
        id: 'test-template',
        channel: 'EMAIL',
        name: 'Test 2',
        subject: 'Test 2',
        body: 'Test 2',
      }, 'test-user')).toThrow(TemplateError);
    });

    it('should require subject for email templates', () => {
      expect(() => store.createTemplate({
        id: 'no-subject',
        channel: 'EMAIL',
        name: 'No Subject',
        body: 'Test body',
      }, 'test-user')).toThrow('requires subject');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', () => {
      const template = store.createTemplate({
        id: 'render-test',
        channel: 'EMAIL',
        name: 'Render Test',
        subject: 'Hello {{name}}',
        body: 'Dear {{name}}, your order #{{order_id}} is ready.',
      }, 'test-user');

      const result = renderTemplate(template, new Map([
        ['name', 'John'],
        ['order_id', '12345'],
      ]));

      expect(result.subject).toBe('Hello John');
      expect(result.body).toBe('Dear John, your order #12345 is ready.');
    });

    it('should throw on missing required variable', () => {
      const template = store.createTemplate({
        id: 'missing-var-test',
        channel: 'SMS',
        name: 'Test',
        body: 'Hello {{name}}!',
        variables: [{ name: 'name', type: 'STRING', required: true }],
      }, 'test-user');

      expect(() => renderTemplate(template, new Map()))
        .toThrow('Missing required variable');
    });

    it('should use default values', () => {
      const template = store.createTemplate({
        id: 'default-test',
        channel: 'SMS',
        name: 'Test',
        body: 'Hello {{name}}!',
        variables: [{ name: 'name', type: 'STRING', required: true, defaultValue: 'Guest' }],
      }, 'test-user');

      const result = renderTemplate(template, new Map());
      expect(result.body).toBe('Hello Guest!');
    });
  });

  describe('validateTemplate', () => {
    it('should validate valid template', () => {
      const result = validateTemplate({
        channel: 'EMAIL',
        subject: 'Test',
        body: 'Hello {{name}}!',
        variables: [{ name: 'name', type: 'STRING', required: true }],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.detectedVariables).toContain('name');
    });

    it('should detect undeclared variables', () => {
      const result = validateTemplate({
        channel: 'SMS',
        body: 'Hello {{name}}, code: {{code}}',
        variables: [{ name: 'name', type: 'STRING', required: true }],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('code'))).toBe(true);
    });
  });
});

// ============================================================================
// EMAIL TESTS
// ============================================================================

describe('EmailStore', () => {
  let store: EmailStore;

  beforeEach(() => {
    store = new EmailStore();
    // Create test template
    templateStore.createTemplate({
      id: 'test-email',
      channel: 'EMAIL',
      name: 'Test Email',
      subject: 'Hello {{name}}',
      body: 'Hello {{name}}, this is a test.',
    }, 'test');
  });

  describe('sendEmail', () => {
    it('should send an email', async () => {
      const notification = await store.sendEmail({
        to: 'user@example.com',
        templateId: 'test-email',
        variables: { name: 'John' },
      }, 'sender-1');

      expect(notification.channel).toBe('EMAIL');
      expect(notification.recipient).toBe('user@example.com');
      expect(notification.subject).toBe('Hello John');
      expect(notification.status).toBe('SENT');
    });

    it('should reject invalid email', async () => {
      await expect(store.sendEmail({
        to: 'invalid-email',
        templateId: 'test-email',
        variables: { name: 'John' },
      }, 'sender-1')).rejects.toThrow('INVALID_RECIPIENT');
    });

    it('should reject missing template', async () => {
      await expect(store.sendEmail({
        to: 'user@example.com',
        templateId: 'nonexistent',
        variables: {},
      }, 'sender-1')).rejects.toThrow('TEMPLATE_NOT_FOUND');
    });

    it('should handle idempotency', async () => {
      const first = await store.sendEmail({
        to: 'user@example.com',
        templateId: 'test-email',
        variables: { name: 'John' },
        idempotencyKey: 'unique-key-1',
      }, 'sender-1');

      const second = await store.sendEmail({
        to: 'user@example.com',
        templateId: 'test-email',
        variables: { name: 'John' },
        idempotencyKey: 'unique-key-1',
      }, 'sender-1');

      expect(first.id).toBe(second.id);
    });

    it('should respect unsubscribe list', async () => {
      store.addToUnsubscribeList('blocked@example.com');

      await expect(store.sendEmail({
        to: 'blocked@example.com',
        templateId: 'test-email',
        variables: { name: 'John' },
      }, 'sender-1')).rejects.toThrow('RECIPIENT_UNSUBSCRIBED');
    });
  });
});

// ============================================================================
// SMS TESTS
// ============================================================================

describe('SMSStore', () => {
  let store: SMSStore;

  beforeEach(() => {
    store = new SMSStore();
    // Create test template
    templateStore.createTemplate({
      id: 'test-sms',
      channel: 'SMS',
      name: 'Test SMS',
      body: 'Hello {{name}}, your code is {{code}}.',
    }, 'test');
  });

  describe('sendSMS', () => {
    it('should send an SMS', async () => {
      const notification = await store.sendSMS({
        to: '+14155551234',
        templateId: 'test-sms',
        variables: { name: 'John', code: '1234' },
      }, 'sender-1');

      expect(notification.channel).toBe('SMS');
      expect(notification.recipient).toBe('+14155551234');
      expect(notification.body).toBe('Hello John, your code is 1234.');
      expect(notification.status).toBe('SENT');
    });

    it('should reject invalid phone number', async () => {
      await expect(store.sendSMS({
        to: '1234567890',  // Missing +
        templateId: 'test-sms',
        variables: { name: 'John', code: '1234' },
      }, 'sender-1')).rejects.toThrow('INVALID_PHONE');
    });

    it('should calculate segments correctly', async () => {
      templateStore.createTemplate({
        id: 'long-sms',
        channel: 'SMS',
        name: 'Long SMS',
        body: 'X'.repeat(200),  // > 160 chars
      }, 'test');

      const notification = await store.sendSMS({
        to: '+14155551234',
        templateId: 'long-sms',
        variables: {},
      }, 'sender-1');

      expect(notification.segments).toBe(2);
    });
  });

  describe('sendVerificationSMS', () => {
    it('should send verification SMS', async () => {
      const result = await store.sendVerificationSMS({
        to: '+14155551234',
        code: '123456',
        expiresIn: 600000,
      }, 'sender-1');

      expect(result.notification.status).toBe('SENT');
      expect(result.verificationId).toBeDefined();
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should verify code correctly', async () => {
      const result = await store.sendVerificationSMS({
        to: '+14155551234',
        code: '654321',
      }, 'sender-1');

      expect(store.verifyCode(result.verificationId, '654321')).toBe(true);
      expect(store.verifyCode(result.verificationId, '654321')).toBe(false); // Second attempt fails
    });

    it('should reject invalid code format', async () => {
      await expect(store.sendVerificationSMS({
        to: '+14155551234',
        code: 'abc',  // Not digits
      }, 'sender-1')).rejects.toThrow('INVALID_CODE');
    });
  });
});

// ============================================================================
// PUSH TESTS
// ============================================================================

describe('PushStore', () => {
  let store: PushStore;

  beforeEach(() => {
    store = new PushStore();
    // Create test template
    templateStore.createTemplate({
      id: 'test-push',
      channel: 'PUSH',
      name: 'Test Push',
      subject: 'New Message',
      body: 'You have a message from {{sender}}',
    }, 'test');
  });

  describe('sendPush', () => {
    it('should send a push notification', async () => {
      const notification = await store.sendPush({
        deviceToken: 'a'.repeat(64),
        templateId: 'test-push',
        variables: { sender: 'John' },
        badge: 1,
      }, 'sender-1');

      expect(notification.channel).toBe('PUSH');
      expect(notification.title).toBe('New Message');
      expect(notification.body).toBe('You have a message from John');
      expect(notification.badge).toBe(1);
      expect(notification.status).toBe('SENT');
    });

    it('should reject invalid device token', async () => {
      await expect(store.sendPush({
        deviceToken: 'short',
        templateId: 'test-push',
        variables: { sender: 'John' },
      }, 'sender-1')).rejects.toThrow('INVALID_TOKEN');
    });

    it('should detect iOS platform from token', async () => {
      const notification = await store.sendPush({
        deviceToken: 'a'.repeat(64),  // iOS-like token
        templateId: 'test-push',
        variables: { sender: 'John' },
      }, 'sender-1');

      expect(notification.platform).toBe('IOS');
    });
  });

  describe('device registration', () => {
    it('should register a device', () => {
      const registration = store.registerDevice({
        userId: 'user-123',
        deviceToken: 'device-token-123'.repeat(4),
        platform: 'ANDROID',
        deviceName: 'Pixel 7',
      });

      expect(registration.userId).toBe('user-123');
      expect(registration.platform).toBe('ANDROID');
    });

    it('should limit devices per user', () => {
      for (let i = 0; i < 10; i++) {
        store.registerDevice({
          userId: 'user-limit',
          deviceToken: `token-${i}`.repeat(10),
          platform: 'IOS',
        });
      }

      expect(() => store.registerDevice({
        userId: 'user-limit',
        deviceToken: 'token-11'.repeat(10),
        platform: 'IOS',
      })).toThrow('DEVICE_LIMIT_EXCEEDED');
    });

    it('should unregister device', () => {
      const token = 'unregister-token'.repeat(4);
      store.registerDevice({
        userId: 'user-unreg',
        deviceToken: token,
        platform: 'IOS',
      });

      expect(store.unregisterDevice(token)).toBe(true);
    });
  });
});

// ============================================================================
// BEHAVIOR TESTS
// ============================================================================

describe('Behaviors', () => {
  beforeEach(() => {
    // Ensure test templates exist
    try {
      templateStore.createTemplate({
        id: 'behavior-email',
        channel: 'EMAIL',
        name: 'Behavior Test Email',
        subject: 'Test: {{subject}}',
        body: 'Content: {{content}}',
      }, 'test');
    } catch { /* ignore if exists */ }

    try {
      templateStore.createTemplate({
        id: 'behavior-sms',
        channel: 'SMS',
        name: 'Behavior Test SMS',
        body: 'SMS: {{message}}',
      }, 'test');
    } catch { /* ignore if exists */ }

    try {
      templateStore.createTemplate({
        id: 'behavior-push',
        channel: 'PUSH',
        name: 'Behavior Test Push',
        subject: 'Push Title',
        body: 'Push: {{message}}',
      }, 'test');
    } catch { /* ignore if exists */ }
  });

  describe('SendEmail', () => {
    it('should send email successfully', async () => {
      const result = await SendEmail({
        to: 'test@example.com',
        templateId: 'behavior-email',
        variables: { subject: 'Hello', content: 'World' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('EMAIL');
        expect(result.data.subject).toBe('Test: Hello');
      }
    });

    it('should return error for invalid email', async () => {
      const result = await SendEmail({
        to: 'not-an-email',
        templateId: 'behavior-email',
        variables: { subject: 'Test', content: 'Test' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_RECIPIENT');
      }
    });
  });

  describe('SendSMS', () => {
    it('should send SMS successfully', async () => {
      const result = await SendSMS({
        to: '+14155559999',
        templateId: 'behavior-sms',
        variables: { message: 'Hello SMS' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('SMS');
        expect(result.data.body).toBe('SMS: Hello SMS');
      }
    });
  });

  describe('SendPush', () => {
    it('should send push successfully', async () => {
      const result = await SendPush({
        deviceToken: 'b'.repeat(64),
        templateId: 'behavior-push',
        variables: { message: 'Hello Push' },
        badge: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('PUSH');
        expect(result.data.badge).toBe(5);
      }
    });
  });

  describe('BatchSend', () => {
    it('should send to multiple recipients', async () => {
      const result = await BatchSend({
        templateId: 'behavior-email',
        recipients: [
          { channel: 'EMAIL', address: 'user1@example.com', variables: { subject: 'A', content: '1' } },
          { channel: 'EMAIL', address: 'user2@example.com', variables: { subject: 'B', content: '2' } },
          { channel: 'EMAIL', address: 'user3@example.com', variables: { subject: 'C', content: '3' } },
        ],
        campaignId: 'test-campaign',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(3);
        expect(result.data.successful).toBe(3);
        expect(result.data.failed).toBe(0);
        expect(result.data.notifications).toHaveLength(3);
      }
    });

    it('should handle partial failures', async () => {
      const result = await BatchSend({
        templateId: 'behavior-email',
        recipients: [
          { channel: 'EMAIL', address: 'valid@example.com', variables: { subject: 'A', content: '1' } },
          { channel: 'EMAIL', address: 'invalid-email', variables: { subject: 'B', content: '2' } },
        ],
        campaignId: 'partial-test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.successful).toBe(1);
        expect(result.data.failed).toBe(1);
        expect(result.data.errors).toHaveLength(1);
      }
    });

    it('should reject too many recipients', async () => {
      const recipients = Array.from({ length: 1001 }, (_, i) => ({
        channel: 'EMAIL' as const,
        address: `user${i}@example.com`,
      }));

      const result = await BatchSend({
        templateId: 'behavior-email',
        recipients,
        campaignId: 'too-many',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('TOO_MANY_RECIPIENTS');
      }
    });
  });

  describe('Template CRUD', () => {
    it('should create template', async () => {
      const result = await CreateTemplate({
        id: 'crud-test-template',
        channel: 'SMS',
        name: 'CRUD Test',
        body: 'Test message',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('crud-test-template');
      }
    });

    it('should get template', async () => {
      await CreateTemplate({
        id: 'get-test-template',
        channel: 'SMS',
        name: 'Get Test',
        body: 'Test',
      });

      const result = await GetTemplate('get-test-template');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Get Test');
      }
    });

    it('should delete template', async () => {
      await CreateTemplate({
        id: 'delete-test-template',
        channel: 'SMS',
        name: 'Delete Test',
        body: 'Test',
      });

      const result = await DeleteTemplate('delete-test-template');

      expect(result.success).toBe(true);
      
      const getResult = await GetTemplate('delete-test-template');
      expect(getResult.success).toBe(false);
    });
  });

  describe('Device Registration', () => {
    it('should register and unregister device', async () => {
      const registerResult = await RegisterDevice({
        userId: 'reg-test-user',
        deviceToken: 'reg-test-token'.repeat(5),
        platform: 'IOS',
        deviceName: 'Test iPhone',
      });

      expect(registerResult.success).toBe(true);
      if (registerResult.success) {
        expect(registerResult.data.userId).toBe('reg-test-user');
      }

      const unregisterResult = await UnregisterDevice('reg-test-token'.repeat(5));
      expect(unregisterResult.success).toBe(true);
    });
  });

  describe('SendVerificationSMS', () => {
    it('should send and verify code', async () => {
      const sendResult = await SendVerificationSMS({
        to: '+14155558888',
        code: '999888',
      });

      expect(sendResult.success).toBe(true);
      if (sendResult.success) {
        expect(sendResult.data.verificationId).toBeDefined();
        
        // Verify the code
        const verified = smsStore.verifyCode(
          sendResult.data.verificationId, 
          '999888'
        );
        expect(verified).toBe(true);
      }
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  it('should return error for nonexistent template', async () => {
    const result = await SendEmail({
      to: 'test@example.com',
      templateId: 'does-not-exist',
      variables: {},
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('TEMPLATE_NOT_FOUND');
    }
  });

  it('should return error for missing variables', async () => {
    try {
      templateStore.createTemplate({
        id: 'missing-vars-test',
        channel: 'EMAIL',
        name: 'Missing Vars',
        subject: 'Test {{required_var}}',
        body: 'Content: {{required_var}}',
        variables: [{ name: 'required_var', type: 'STRING', required: true }],
      }, 'test');
    } catch { /* ignore if exists */ }

    const result = await SendEmail({
      to: 'test@example.com',
      templateId: 'missing-vars-test',
      variables: {},  // Missing required_var
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('MISSING_VARIABLE');
    }
  });
});
