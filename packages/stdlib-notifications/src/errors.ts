/**
 * Notification system errors
 */

import { NotificationError } from './types';

// Re-export NotificationError
export { NotificationError };

// Template errors
export class TemplateNotFoundError extends NotificationError {
  constructor(templateId: string) {
    super('TEMPLATE_NOT_FOUND', `Template ${templateId} not found`, false);
  }
}

export class TemplateInactiveError extends NotificationError {
  constructor(templateId: string) {
    super('TEMPLATE_INACTIVE', `Template ${templateId} is inactive`, false);
  }
}

export class TemplateRenderError extends NotificationError {
  constructor(message: string) {
    super('TEMPLATE_RENDER_ERROR', `Template rendering failed: ${message}`, false);
  }
}

export class InvalidVariableError extends NotificationError {
  constructor(variable: string) {
    super('INVALID_VARIABLE', `Invalid template variable: ${variable}`, false);
  }
}

export class MissingVariableError extends NotificationError {
  constructor(variable: string) {
    super('MISSING_VARIABLE', `Required template variable missing: ${variable}`, false);
  }
}

// Recipient errors
export class RecipientNotFoundError extends NotificationError {
  constructor(recipientId: string) {
    super('RECIPIENT_NOT_FOUND', `Recipient ${recipientId} not found`, false);
  }
}

export class ChannelNotConfiguredError extends NotificationError {
  constructor(channel: string) {
    super('CHANNEL_NOT_CONFIGURED', `Recipient has no address for channel: ${channel}`, false);
  }
}

// Preference errors
export class UnsubscribedError extends NotificationError {
  constructor(category: string) {
    super('UNSUBSCRIBED', `Recipient unsubscribed from category: ${category}`, false);
  }
}

export class QuietHoursError extends NotificationError {
  constructor() {
    super('QUIET_HOURS', 'Notification blocked due to quiet hours', true, 60 * 60 * 8); // 8 hours
  }
}

// Delivery errors
export class RateLimitedError extends NotificationError {
  constructor(retryAfter: number = 60) {
    super('RATE_LIMITED', 'Rate limit exceeded', true, retryAfter);
  }
}

export class ProviderError extends NotificationError {
  constructor(provider: string, message: string, retriable: boolean = true) {
    super('PROVIDER_ERROR', `${provider} error: ${message}`, retriable);
  }
}

export class DeliveryExpiredError extends NotificationError {
  constructor() {
    super('EXPIRED', 'Notification has expired', false);
  }
}

export class DeliveryFailedError extends NotificationError {
  constructor(reason: string, retriable: boolean = false) {
    super('DELIVERY_FAILED', `Delivery failed: ${reason}`, retriable);
  }
}

// Configuration errors
export class ConfigurationError extends NotificationError {
  constructor(message: string) {
    super('CONFIGURATION_ERROR', message, false);
  }
}

export class InvalidConfigurationError extends NotificationError {
  constructor(field: string, value: any) {
    super('INVALID_CONFIGURATION', `Invalid configuration for ${field}: ${value}`, false);
  }
}

// Channel-specific errors
export class EmailValidationError extends NotificationError {
  constructor(email: string) {
    super('EMAIL_INVALID', `Invalid email address: ${email}`, false);
  }
}

export class PhoneValidationError extends NotificationError {
  constructor(phone: string) {
    super('PHONE_INVALID', `Invalid phone number: ${phone}`, false);
  }
}

export class DeviceTokenError extends NotificationError {
  constructor(token: string) {
    super('DEVICE_TOKEN_INVALID', `Invalid device token: ${token}`, false);
  }
}

export class WebhookError extends NotificationError {
  constructor(url: string, status: number) {
    super('WEBHOOK_FAILED', `Webhook call failed to ${url}: ${status}`, true);
  }
}

// Batch errors
export class BatchTooLargeError extends NotificationError {
  constructor(size: number, max: number) {
    super('BATCH_TOO_LARGE', `Batch size ${size} exceeds maximum ${max}`, false);
  }
}

export class PartialBatchError extends NotificationError {
  constructor(
    public succeeded: number,
    public failed: number,
    public errors: Array<{ recipientId: string; error: string }>
  ) {
    super('PARTIAL_BATCH', `Partial batch failure: ${failed} of ${succeeded + failed} failed`, false);
  }
}
