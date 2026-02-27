// ============================================================================
// PCI Compliance Utilities
// ============================================================================

import { PaymentMethodToken, PCIMetadata } from './types';

// ==========================================================================
// PCI DSS COMPLIANCE HELPERS
// ==========================================================================

export const PCICompliance = {
  /**
   * Validates that no raw card data is present in an object
   */
  validateNoRawCardData(obj: unknown): boolean {
    const str = JSON.stringify(obj);
    
    // Check for potential card numbers (13-19 digits)
    const cardNumberPattern = /\b(?:\d[ -]*?){13,19}\b/;
    if (cardNumberPattern.test(str)) {
      // Verify it's not a false positive by running Luhn check
      const potentialCards = str.match(/\d{13,19}/g) ?? [];
      for (const num of potentialCards) {
        if (this.luhnCheck(num)) {
          return false;
        }
      }
    }
    
    // Check for CVV patterns (3-4 digits near card-related fields)
    const cvvPattern = /["']?(?:cvv|cvc|cvv2|cid|security.?code)["']?\s*[:=]\s*["']?\d{3,4}["']?/i;
    if (cvvPattern.test(str)) {
      return false;
    }
    
    return true;
  },
  
  /**
   * Luhn algorithm check for card number validation
   */
  luhnCheck(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  },
  
  /**
   * Sanitize logs to remove sensitive payment data
   */
  sanitizeLogs(logData: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = [
      'card_number', 'cardNumber', 'pan',
      'cvv', 'cvc', 'cvv2', 'cid', 'securityCode', 'security_code',
      'pin', 'password', 'secret',
      'track1', 'track2', 'magnetic_stripe',
    ];
    
    const sanitized = { ...logData };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    // Deep sanitize
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogs(value as Record<string, unknown>);
      }
    }
    
    return sanitized;
  },
  
  /**
   * Create PCI metadata for a tokenized payment
   */
  createPCIMetadata(
    tokenizationMethod: string,
    providerReference: string,
    complianceLevel: 1 | 2 | 3 | 4 = 1
  ): PCIMetadata {
    return {
      tokenizationMethod,
      tokenizedAt: new Date(),
      providerReference,
      complianceLevel,
    };
  },
  
  /**
   * Validate that a string is a valid payment token (not raw card data)
   */
  isValidToken(value: string): boolean {
    // Valid tokens should start with known prefixes
    const validPrefixes = ['pm_', 'tok_', 'card_', 'src_', 'btok_'];
    return validPrefixes.some(prefix => value.startsWith(prefix));
  },
};

// ==========================================================================
// CARD MASKING UTILITIES
// ==========================================================================

/**
 * Mask a card number, showing only last 4 digits
 */
export function maskCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 4) {
    return '****';
  }
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Format masked card number with spaces (e.g., **** **** **** 1234)
 */
export function formatMaskedCard(lastFour: string, brand?: string): string {
  const pattern = brand === 'AMEX' ? '**** ****** *' : '**** **** **** ';
  return pattern + lastFour;
}

/**
 * Extract last 4 digits from a card number
 */
export function extractLastFour(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  return cleaned.slice(-4);
}

// ==========================================================================
// TOKEN VALIDATION
// ==========================================================================

/**
 * Validate payment method token format
 */
export function validateTokenFormat(token: PaymentMethodToken): boolean {
  // Stripe-style tokens
  if (/^pm_[a-zA-Z0-9]{24,}$/.test(token)) {
    return true;
  }
  
  // Braintree-style tokens
  if (/^[a-zA-Z0-9]{32,}$/.test(token)) {
    return true;
  }
  
  // Adyen-style tokens
  if (/^[0-9]{16}XXXXXXXX[0-9]{4}$/.test(token)) {
    return true;
  }
  
  return false;
}

// ==========================================================================
// AUDIT LOGGING
// ==========================================================================

export interface AuditLogEntry {
  timestamp: Date;
  action: string;
  paymentId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
}

export class AuditLogger {
  private readonly logger: (entry: AuditLogEntry) => void;
  
  constructor(logger: (entry: AuditLogEntry) => void) {
    this.logger = logger;
  }
  
  log(
    action: string,
    details: Record<string, unknown>,
    context?: {
      paymentId?: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): void {
    // Sanitize before logging
    const sanitizedDetails = PCICompliance.sanitizeLogs(details);
    
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      action,
      paymentId: context?.paymentId,
      userId: context?.userId,
      ipAddress: context?.ipAddress ? this.maskIP(context.ipAddress) : undefined,
      userAgent: context?.userAgent,
      details: sanitizedDetails,
    };
    
    this.logger(entry);
  }
  
  private maskIP(ip: string): string {
    // Mask last octet for IPv4
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = 'xxx';
      return parts.join('.');
    }
    return ip;
  }
}

// ==========================================================================
// ENCRYPTION HELPERS
// ==========================================================================

export interface EncryptionService {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
}

/**
 * AES-256-GCM encryption service
 */
export class AESEncryptionService implements EncryptionService {
  private readonly key: Buffer;
  
  constructor(keyHex: string) {
    this.key = Buffer.from(keyHex, 'hex');
    if (this.key.length !== 32) {
      throw new Error('Key must be 256 bits (32 bytes)');
    }
  }
  
  async encrypt(data: string): Promise<string> {
    const crypto = require('crypto');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }
  
  async decrypt(encryptedData: string): Promise<string> {
    const crypto = require('crypto');
    const [ivB64, authTagB64, dataB64] = encryptedData.split(':');
    
    if (!ivB64 || !authTagB64 || !dataB64) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(dataB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
