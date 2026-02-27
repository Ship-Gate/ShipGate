# @intentos/stdlib-notifications

ISL Standard Library - Notifications

Multi-channel notification system supporting email, SMS, and push notifications with template management, rate limiting, and compliance features.

## Features

- **Multi-Channel**: Email, SMS, Push notifications
- **Templates**: Variable interpolation, validation, versioning
- **Rate Limiting**: Per-sender and per-recipient limits
- **Batch Sending**: Send to 1000+ recipients efficiently
- **Device Management**: Push notification device registry
- **Verification**: SMS OTP with expiration
- **Compliance**: CAN-SPAM, GDPR, TCPA support

## Installation

```bash
pnpm add @intentos/stdlib-notifications
```

## Quick Start

```typescript
import { 
  CreateTemplate,
  SendEmail, 
  SendSMS, 
  SendPush,
  BatchSend 
} from '@intentos/stdlib-notifications';

// 1. Create a template
await CreateTemplate({
  id: 'welcome-email',
  channel: 'EMAIL',
  name: 'Welcome Email',
  subject: 'Welcome to {{app_name}}!',
  body: 'Hello {{name}}, welcome aboard!',
});

// 2. Send an email
const result = await SendEmail({
  to: 'user@example.com',
  templateId: 'welcome-email',
  variables: { app_name: 'MyApp', name: 'John' },
});

// 3. Send SMS
await SendSMS({
  to: '+14155551234',
  templateId: 'verification-sms',
  variables: { code: '123456' },
});

// 4. Send push notification
await SendPush({
  deviceToken: 'device-token-here',
  templateId: 'new-message',
  variables: { sender: 'Alice' },
  badge: 1,
});
```

## ISL Specification

The notification domain is fully specified in ISL. See the `intents/` directory:

- `domain.isl` - Main domain with types, invariants, policies
- `notification.isl` - Notification entity with lifecycle
- `template.isl` - Template entity and operations
- `behaviors/` - All behavior specifications

## API Reference

### Templates

#### CreateTemplate

```typescript
await CreateTemplate({
  id: 'order-confirmation',
  channel: 'EMAIL',
  name: 'Order Confirmation',
  subject: 'Order #{{order_id}} Confirmed',
  body: 'Your order for {{item}} has been confirmed.',
  htmlBody: '<h1>Order Confirmed</h1><p>...</p>',
  variables: [
    { name: 'order_id', type: 'STRING', required: true },
    { name: 'item', type: 'STRING', required: true },
  ],
  locale: 'en',
  category: 'transactional',
});
```

#### GetTemplate / DeleteTemplate

```typescript
const template = await GetTemplate('order-confirmation');
await DeleteTemplate('old-template');
```

### Email

#### SendEmail

```typescript
await SendEmail({
  to: 'user@example.com',
  cc: ['manager@example.com'],
  bcc: ['audit@example.com'],
  templateId: 'order-confirmation',
  variables: { order_id: '12345', item: 'Widget' },
  priority: 'HIGH',
  attachments: [{
    filename: 'receipt.pdf',
    contentType: 'application/pdf',
    content: base64Content,
    size: 1024,
  }],
  campaignId: 'order-emails',
  idempotencyKey: 'order-12345-confirmation',
});
```

### SMS

#### SendSMS

```typescript
await SendSMS({
  to: '+14155551234',
  templateId: 'shipping-update',
  variables: { tracking: 'ABC123' },
  priority: 'NORMAL',
});
```

#### SendVerificationSMS

```typescript
const result = await SendVerificationSMS({
  to: '+14155551234',
  code: '123456',
  expiresIn: 600000,  // 10 minutes
});

// Later, verify the code
const isValid = smsStore.verifyCode(result.data.verificationId, '123456');
```

### Push Notifications

#### SendPush

```typescript
await SendPush({
  deviceToken: 'apns-device-token',
  platform: 'IOS',
  templateId: 'new-message',
  variables: { sender: 'Alice' },
  badge: 3,
  sound: 'default',
  data: { messageId: '456' },
  priority: 'HIGH',
  collapseKey: 'messages',
});
```

#### RegisterDevice / UnregisterDevice

```typescript
await RegisterDevice({
  userId: 'user-123',
  deviceToken: 'apns-token',
  platform: 'IOS',
  deviceName: 'iPhone 15',
  appVersion: '2.0.0',
});

await UnregisterDevice('apns-token');
```

### Batch Sending

#### BatchSend

```typescript
await BatchSend({
  templateId: 'newsletter',
  recipients: [
    { channel: 'EMAIL', address: 'user1@example.com', variables: { name: 'Alice' } },
    { channel: 'EMAIL', address: 'user2@example.com', variables: { name: 'Bob' } },
    // ... up to 1000 recipients
  ],
  sharedVariables: { month: 'January', year: '2024' },
  campaignId: 'newsletter-2024-01',
  priority: 'LOW',
});
```

## Notification Status Flow

```
PENDING → QUEUED → SENT → DELIVERED → OPENED → CLICKED
                     ↓         ↓
                  FAILED    BOUNCED
                     ↓
              UNSUBSCRIBED
```

## Template Variables

Templates support variable interpolation using `{{variable_name}}` syntax:

```typescript
{
  subject: 'Hello {{name}}!',
  body: 'Your order #{{order_id}} will arrive on {{delivery_date}}.',
}
```

Variable types:
- `STRING` - Plain text
- `NUMBER` - Numeric values
- `DATE` - Date/time formatting
- `URL` - URLs (validated)
- `EMAIL` - Email addresses
- `PHONE` - Phone numbers
- `CURRENCY` - Monetary values
- `HTML` - HTML content (sanitized)

## Rate Limits

Default rate limits per channel:

| Channel | Per Sender | Per Recipient |
|---------|------------|---------------|
| EMAIL   | 100/min    | 10/min        |
| SMS     | 60/min     | 10/min        |
| PUSH    | 1000/min   | 100/min       |

## Compliance

### Email (CAN-SPAM)
- Unsubscribe link required
- Physical address required
- Accurate from header
- No deceptive subjects

### SMS (TCPA)
- Prior consent required
- Opt-out mechanism required
- Time restrictions (8am-9pm local)

### GDPR
- Consent tracking
- Right to erasure
- Data portability

## Error Handling

```typescript
const result = await SendEmail({ ... });

if (!result.success) {
  switch (result.code) {
    case 'TEMPLATE_NOT_FOUND':
      // Handle missing template
      break;
    case 'INVALID_RECIPIENT':
      // Handle invalid email
      break;
    case 'RATE_LIMITED':
      // Retry after delay
      break;
    case 'RECIPIENT_UNSUBSCRIBED':
      // User has unsubscribed
      break;
  }
}
```

## Best Practices

### 1. Use Idempotency Keys

```typescript
await SendEmail({
  ...input,
  idempotencyKey: `order-${orderId}-confirmation`,
});
```

### 2. Set Appropriate Priorities

```typescript
// Transactional (high priority)
await SendEmail({ ...input, priority: 'HIGH' });

// Marketing (low priority)
await SendEmail({ ...input, priority: 'LOW' });

// Critical alerts
await SendPush({ ...input, priority: 'URGENT' });
```

### 3. Use Campaign IDs for Tracking

```typescript
await BatchSend({
  ...input,
  campaignId: 'promo-summer-2024',
});
```

### 4. Handle Unsubscribes

```typescript
emailStore.addToUnsubscribeList('user@example.com');
smsStore.addToOptOutList('+14155551234');
```

## License

MIT
