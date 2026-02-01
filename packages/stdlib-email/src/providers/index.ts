/**
 * Email Providers Module
 */

export { BaseEmailProvider } from './base.js';
export { SmtpProvider, type SmtpConfig } from './smtp.js';
export { SendGridProvider, type SendGridConfig } from './sendgrid.js';
export { SesProvider, type SesConfig } from './ses.js';

import type { EmailProvider, ProviderConfig } from '../types.js';
import { SmtpProvider, type SmtpConfig } from './smtp.js';
import { SendGridProvider, type SendGridConfig } from './sendgrid.js';
import { SesProvider, type SesConfig } from './ses.js';

/**
 * Create email provider by type
 */
export function createProvider(
  type: 'smtp' | 'sendgrid' | 'ses' | 'postmark' | 'mailgun',
  config: ProviderConfig
): EmailProvider {
  switch (type) {
    case 'smtp':
      return new SmtpProvider(config as SmtpConfig);
    case 'sendgrid':
      return new SendGridProvider(config as SendGridConfig);
    case 'ses':
      return new SesProvider(config as SesConfig);
    case 'postmark':
      // Would implement PostmarkProvider
      throw new Error('Postmark provider not yet implemented');
    case 'mailgun':
      // Would implement MailgunProvider
      throw new Error('Mailgun provider not yet implemented');
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
