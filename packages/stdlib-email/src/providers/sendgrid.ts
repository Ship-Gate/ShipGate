/**
 * SendGrid Email Provider
 * 
 * Sends emails via SendGrid API.
 */

import type {
  NormalizedEmail,
  EmailDeliveryResult,
  ProviderConfig,
} from '../types.js';

import { BaseEmailProvider } from './base.js';

export interface SendGridConfig extends ProviderConfig {
  apiKey: string;
  sandbox?: boolean;
}

/**
 * SendGrid provider
 */
export class SendGridProvider extends BaseEmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private sandbox: boolean;
  
  constructor(config: SendGridConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.sandbox = config.sandbox ?? false;
  }
  
  async send(message: NormalizedEmail): Promise<EmailDeliveryResult> {
    try {
      const payload = this.buildPayload(message);
      const response = await this.callApi('/v3/mail/send', payload);
      
      // SendGrid returns message ID in headers
      const messageId = response.headers?.['x-message-id'] || message.id;
      
      return this.createSuccessResult(message, messageId);
    } catch (error) {
      return this.createErrorResult(message, error);
    }
  }
  
  async sendBatch(messages: NormalizedEmail[]): Promise<EmailDeliveryResult[]> {
    // SendGrid supports batch sending via personalizations
    // For simplicity, we'll use the default sequential implementation
    // A production implementation would batch up to 1000 per request
    return super.sendBatch(messages);
  }
  
  private buildPayload(message: NormalizedEmail): SendGridPayload {
    const payload: SendGridPayload = {
      personalizations: [
        {
          to: message.to.map(addr => ({ email: addr.email, name: addr.name })),
          cc: message.cc.length > 0 
            ? message.cc.map(addr => ({ email: addr.email, name: addr.name }))
            : undefined,
          bcc: message.bcc.length > 0
            ? message.bcc.map(addr => ({ email: addr.email, name: addr.name }))
            : undefined,
          subject: message.subject,
        },
      ],
      from: { email: message.from.email, name: message.from.name },
      reply_to: message.replyTo 
        ? { email: message.replyTo.email, name: message.replyTo.name }
        : undefined,
      content: [],
      attachments: message.attachments.length > 0
        ? message.attachments.map(a => ({
            content: a.content.toString('base64'),
            filename: a.filename,
            type: a.contentType,
            disposition: a.disposition,
            content_id: a.contentId,
          }))
        : undefined,
      categories: message.tags,
      custom_args: message.metadata as Record<string, string>,
      mail_settings: this.sandbox ? { sandbox_mode: { enable: true } } : undefined,
    };
    
    if (message.text) {
      payload.content.push({ type: 'text/plain', value: message.text });
    }
    if (message.html) {
      payload.content.push({ type: 'text/html', value: message.html });
    }
    
    // Add headers
    if (Object.keys(message.headers).length > 0) {
      payload.headers = message.headers;
    }
    
    return payload;
  }
  
  private async callApi(endpoint: string, payload: unknown): Promise<ApiResponse> {
    const response = await fetch(`https://api.sendgrid.com${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `SendGrid API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
  
  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

interface SendGridPayload {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>;
    cc?: Array<{ email: string; name?: string }>;
    bcc?: Array<{ email: string; name?: string }>;
    subject?: string;
  }>;
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject?: string;
  content: Array<{ type: string; value: string }>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string;
    content_id?: string;
  }>;
  headers?: Record<string, string>;
  categories?: string[];
  custom_args?: Record<string, string>;
  mail_settings?: {
    sandbox_mode?: { enable: boolean };
  };
}

interface ApiResponse {
  status: number;
  headers: Record<string, string>;
}
