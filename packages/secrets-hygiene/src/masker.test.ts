/**
 * Tests for Secrets Masker
 */

import { describe, it, expect } from 'vitest';
import { SecretsMasker, createMasker } from './masker.js';

describe('SecretsMasker', () => {
  it('should mask API keys', () => {
    const masker = createMasker();
    const text = 'API_KEY=sk_live_1234567890abcdef';
    const masked = masker.mask(text);
    expect(masked).toContain('***');
    expect(masked).not.toContain('sk_live_1234567890abcdef');
  });

  it('should mask passwords', () => {
    const masker = createMasker();
    const text = 'password=mySecretPassword123';
    const masked = masker.mask(text);
    expect(masked).toContain('***');
    expect(masked).not.toContain('mySecretPassword123');
  });

  it('should mask JWT tokens', () => {
    const masker = createMasker();
    const text = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjg';
    const masked = masker.mask(text);
    expect(masked).toContain('***');
    expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('should mask Stripe keys', () => {
    const masker = createMasker();
    const text = 'sk_live_1234567890abcdef1234567890abcdef';
    const masked = masker.mask(text);
    expect(masked).toContain('***');
    expect(masked).not.toContain('sk_live_');
  });

  it('should mask GitHub tokens', () => {
    const masker = createMasker();
    const text = 'ghp_1234567890abcdef1234567890abcdef12345678';
    const masked = masker.mask(text);
    expect(masked).toContain('***');
    expect(masked).not.toContain('ghp_');
  });

  it('should mask private keys', () => {
    const masker = createMasker();
    const text = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----`;
    const masked = masker.mask(text);
    expect(masked).toContain('***');
    expect(masked).not.toContain('BEGIN PRIVATE KEY');
  });

  it('should mask environment variables not in allowlist', () => {
    const masker = createMasker({
      allowedEnvVars: ['PATH', 'HOME'],
      maskEnvVars: true,
    });
    const text = 'SECRET_KEY=mysecret123\nPATH=/usr/bin';
    const masked = masker.mask(text);
    expect(masked).toContain('SECRET_KEY=***');
    expect(masked).toContain('PATH=/usr/bin'); // PATH should be unmasked
  });

  it('should mask deep objects', () => {
    const masker = createMasker();
    const obj = {
      user: 'alice',
      password: 'secret123',
      apiKey: 'sk_live_1234567890',
      nested: {
        token: 'bearer_token_here',
      },
    };
    const masked = masker.maskObject(obj);
    expect(masked).toEqual({
      user: 'alice',
      password: '***',
      apiKey: '***',
      nested: {
        token: '***',
      },
    });
  });

  it('should detect secret types', () => {
    const masker = createMasker();
    const text = 'API_KEY=sk_live_123\npassword=secret123';
    const result = masker.maskWithDetails(text);
    expect(result.secretsDetected).toBeGreaterThan(0);
    expect(result.secretTypes.length).toBeGreaterThan(0);
  });

  it('should handle empty text', () => {
    const masker = createMasker();
    expect(masker.mask('')).toBe('');
  });

  it('should handle text with no secrets', () => {
    const masker = createMasker();
    const text = 'This is just normal text with no secrets';
    const masked = masker.mask(text);
    expect(masked).toBe(text);
  });
});
