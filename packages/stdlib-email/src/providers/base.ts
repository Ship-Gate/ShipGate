/**
 * Base Email Provider
 * 
 * Abstract base class for email providers.
 */

import type {
  EmailProvider,
  NormalizedEmail,
  EmailDeliveryResult,
  ProviderConfig,
  DeliveryStatus,
  DeliveryError,
  ErrorCategory,
} from '../types.js';

/**
 * Abstract base provider with common functionality
 */
export abstract class BaseEmailProvider implements EmailProvider {
  abstract name: string;
  protected config: ProviderConfig;
  
  constructor(config: ProviderConfig) {
    this.config = config;
  }
  
  abstract send(message: NormalizedEmail): Promise<EmailDeliveryResult>;
  
  async sendBatch(messages: NormalizedEmail[]): Promise<EmailDeliveryResult[]> {
    // Default implementation sends sequentially
    // Providers can override for batch API support
    const results: EmailDeliveryResult[] = [];
    
    for (const message of messages) {
      try {
        const result = await this.send(message);
        results.push(result);
        
        // Rate limiting
        if (this.config.rateLimit) {
          await this.delay(1000 / this.config.rateLimit);
        }
      } catch (error) {
        results.push(this.createErrorResult(message, error));
      }
    }
    
    return results;
  }
  
  async validateCredentials(): Promise<boolean> {
    // Default: assume valid, providers can override
    return true;
  }
  
  protected createSuccessResult(
    message: NormalizedEmail,
    providerId?: string
  ): EmailDeliveryResult {
    return {
      messageId: `<${message.id}@${this.name}>`,
      email: message.to[0]?.email || '',
      status: 'sent' as DeliveryStatus,
      provider: this.name,
      providerId,
      timestamp: new Date(),
      attempts: 1,
      metadata: message.metadata,
    };
  }
  
  protected createErrorResult(
    message: NormalizedEmail,
    error: unknown
  ): EmailDeliveryResult {
    const deliveryError = this.parseError(error);
    
    return {
      messageId: `<${message.id}@${this.name}>`,
      email: message.to[0]?.email || '',
      status: 'failed' as DeliveryStatus,
      provider: this.name,
      timestamp: new Date(),
      error: deliveryError,
      attempts: 1,
      metadata: message.metadata,
    };
  }
  
  protected parseError(error: unknown): DeliveryError {
    if (error instanceof Error) {
      return {
        code: 'PROVIDER_ERROR',
        message: error.message,
        category: this.categorizeError(error),
        permanent: false,
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      category: 'unknown',
      permanent: false,
    };
  }
  
  protected categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid') && message.includes('email')) {
      return 'invalid_email';
    }
    if (message.includes('bounce')) {
      return 'bounce';
    }
    if (message.includes('spam') || message.includes('rejected')) {
      return 'spam';
    }
    if (message.includes('rate') || message.includes('limit') || message.includes('throttl')) {
      return 'rate_limit';
    }
    if (message.includes('auth') || message.includes('credential') || message.includes('api key')) {
      return 'authentication';
    }
    if (message.includes('timeout') || message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('config') || message.includes('setting')) {
      return 'configuration';
    }
    
    return 'unknown';
  }
  
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
