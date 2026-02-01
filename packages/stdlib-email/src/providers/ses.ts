/**
 * Amazon SES Email Provider
 * 
 * Sends emails via AWS Simple Email Service.
 */

import type {
  NormalizedEmail,
  EmailDeliveryResult,
  ProviderConfig,
} from '../types.js';

import { BaseEmailProvider } from './base.js';

export interface SesConfig extends ProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  configurationSetName?: string;
}

/**
 * Amazon SES provider
 */
export class SesProvider extends BaseEmailProvider {
  name = 'ses';
  private sesConfig: SesConfig;
  
  constructor(config: SesConfig) {
    super(config);
    this.sesConfig = config;
  }
  
  async send(message: NormalizedEmail): Promise<EmailDeliveryResult> {
    try {
      const payload = this.buildPayload(message);
      const response = await this.callSes(payload);
      
      return this.createSuccessResult(message, response.MessageId);
    } catch (error) {
      return this.createErrorResult(message, error);
    }
  }
  
  async sendBatch(messages: NormalizedEmail[]): Promise<EmailDeliveryResult[]> {
    // SES supports bulk templated sending
    // For raw messages, we send sequentially with rate limiting
    const results: EmailDeliveryResult[] = [];
    
    // SES has a rate limit of 14 emails/second by default
    const rateLimit = this.sesConfig.rateLimit || 14;
    
    for (const message of messages) {
      try {
        const result = await this.send(message);
        results.push(result);
        
        // Respect rate limit
        await this.delay(1000 / rateLimit);
      } catch (error) {
        results.push(this.createErrorResult(message, error));
      }
    }
    
    return results;
  }
  
  private buildPayload(message: NormalizedEmail): SesEmailPayload {
    const destination: SesDestination = {
      ToAddresses: message.to.map(addr => formatSesAddress(addr)),
    };
    
    if (message.cc.length > 0) {
      destination.CcAddresses = message.cc.map(addr => formatSesAddress(addr));
    }
    if (message.bcc.length > 0) {
      destination.BccAddresses = message.bcc.map(addr => formatSesAddress(addr));
    }
    
    const content: SesEmailContent = {
      Simple: {
        Subject: { Data: message.subject },
        Body: {},
      },
    };
    
    if (message.text) {
      content.Simple!.Body.Text = { Data: message.text };
    }
    if (message.html) {
      content.Simple!.Body.Html = { Data: message.html };
    }
    
    const payload: SesEmailPayload = {
      FromEmailAddress: formatSesAddress(message.from),
      Destination: destination,
      Content: content,
    };
    
    if (message.replyTo) {
      payload.ReplyToAddresses = [formatSesAddress(message.replyTo)];
    }
    
    if (message.tags.length > 0) {
      payload.EmailTags = message.tags.map(tag => ({
        Name: 'tag',
        Value: tag,
      }));
    }
    
    if (this.sesConfig.configurationSetName) {
      payload.ConfigurationSetName = this.sesConfig.configurationSetName;
    }
    
    return payload;
  }
  
  private async callSes(payload: SesEmailPayload): Promise<SesResponse> {
    // In a real implementation, this would use AWS SDK
    // const client = new SESv2Client({ region: this.sesConfig.region, credentials: ... });
    // const command = new SendEmailCommand(payload);
    // return client.send(command);
    
    // Simulated response
    const messageId = `${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${this.sesConfig.region}.amazonses.com`;
    
    await this.delay(50);
    
    return { MessageId: messageId };
  }
  
  async validateCredentials(): Promise<boolean> {
    try {
      // Real implementation would call GetAccount
      // const client = new SESv2Client({ region: this.sesConfig.region });
      // await client.send(new GetAccountCommand({}));
      return true;
    } catch {
      return false;
    }
  }
}

interface SesEmailPayload {
  FromEmailAddress: string;
  Destination: SesDestination;
  Content: SesEmailContent;
  ReplyToAddresses?: string[];
  EmailTags?: Array<{ Name: string; Value: string }>;
  ConfigurationSetName?: string;
}

interface SesDestination {
  ToAddresses: string[];
  CcAddresses?: string[];
  BccAddresses?: string[];
}

interface SesEmailContent {
  Simple?: {
    Subject: { Data: string };
    Body: {
      Text?: { Data: string };
      Html?: { Data: string };
    };
  };
  Raw?: {
    Data: Buffer;
  };
}

interface SesResponse {
  MessageId: string;
}

function formatSesAddress(addr: { email: string; name?: string }): string {
  if (addr.name) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}
