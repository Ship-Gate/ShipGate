/**
 * @intentos/stdlib-email
 * 
 * ISL Standard Library for email templating, validation, and delivery.
 * 
 * @example
 * ```typescript
 * import { createEmailClient } from '@intentos/stdlib-email';
 * 
 * const email = createEmailClient({
 *   defaultProvider: 'sendgrid',
 *   providers: {
 *     sendgrid: { apiKey: process.env.SENDGRID_API_KEY },
 *   },
 * });
 * 
 * // Send simple email
 * await email.send({
 *   from: 'sender@example.com',
 *   to: ['recipient@example.com'],
 *   subject: 'Hello',
 *   html: '<h1>Hello World</h1>',
 * });
 * 
 * // Send templated email
 * email.registerTemplate({
 *   id: '1',
 *   slug: 'welcome',
 *   name: 'Welcome Email',
 *   subject: 'Welcome, {{name}}!',
 *   htmlTemplate: '<h1>Welcome, {{name}}!</h1>',
 *   variables: [{ name: 'name', type: 'string', required: true }],
 *   version: 1,
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 * 
 * await email.sendTemplated('welcome', {
 *   to: ['user@example.com'],
 *   data: { name: 'John' },
 * });
 * ```
 */

// Export types
export type {
  EmailAddress,
  EmailMessage,
  Attachment,
  EmailTemplate,
  TemplateVariable,
  EmailDeliveryResult,
  DeliveryError,
  EmailBatch,
  BatchRecipient,
  DeliveryStats,
  EmailPriority,
  EmailStatus,
  DeliveryStatus,
  AttachmentDisposition,
  VariableType,
  ErrorCategory,
  BatchStatus,
  EmailProvider,
  NormalizedEmail,
  NormalizedAttachment,
  ProviderConfig,
  TemplateEngine,
  TemplateValidation,
  TemplateError,
  TemplateWarning,
  EmailEvent,
  EmailEventType,
  WebhookPayload,
  EmailConfig,
} from './types.js';

// Export client
export { EmailClient, createEmailClient } from './client.js';

// Export providers
export {
  BaseEmailProvider,
  SmtpProvider,
  SendGridProvider,
  SesProvider,
  createProvider,
  type SmtpConfig,
  type SendGridConfig,
  type SesConfig,
} from './providers/index.js';

// Export templates
export {
  SimpleTemplateEngine,
  HandlebarsTemplateEngine,
  renderTemplate,
  renderHandlebarsTemplate,
  validateTemplate,
  validateHandlebarsTemplate,
  extractTemplateVariables,
  extractHandlebarsVariables,
  escapeHtml,
  createTemplateEngine,
} from './templates/index.js';

// Utility functions
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'mailinator.com',
    'guerrillamail.com',
    'tempmail.com',
    '10minutemail.com',
    'throwaway.email',
    'temp-mail.org',
    'fakeinbox.com',
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}

export function isRoleBasedEmail(email: string): boolean {
  const roleBasedPrefixes = [
    'admin',
    'administrator',
    'info',
    'support',
    'sales',
    'contact',
    'help',
    'noreply',
    'no-reply',
    'webmaster',
    'postmaster',
    'hostmaster',
    'abuse',
    'security',
    'billing',
    'marketing',
    'team',
    'hello',
    'office',
    'mail',
    'feedback',
  ];
  
  const localPart = email.split('@')[0]?.toLowerCase();
  return roleBasedPrefixes.includes(localPart);
}

export function normalizeEmailAddress(email: string): string {
  // Lowercase and trim
  let normalized = email.toLowerCase().trim();
  
  // Handle Gmail-style plus addressing
  const [localPart, domain] = normalized.split('@');
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Remove dots and plus addressing
    const cleanLocal = localPart.split('+')[0].replace(/\./g, '');
    normalized = `${cleanLocal}@gmail.com`;
  }
  
  return normalized;
}

export function parseEmailAddress(address: string): { email: string; name?: string } {
  // Parse "Name <email>" format
  const match = address.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: address.trim() };
}

export function formatEmailAddress(address: { email: string; name?: string }): string {
  if (address.name) {
    return `"${address.name}" <${address.email}>`;
  }
  return address.email;
}
