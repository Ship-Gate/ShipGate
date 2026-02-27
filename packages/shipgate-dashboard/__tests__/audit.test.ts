import { describe, it, expect } from 'vitest';
import { getAuditRequestContext } from '@/lib/audit';

describe('Audit: getAuditRequestContext', () => {
  it('extracts ipAddress from x-forwarded-for', async () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        'user-agent': 'TestAgent/1.0',
      },
    });
    const ctx = getAuditRequestContext(req as unknown as import('next/server').NextRequest);
    expect(ctx.ipAddress).toBe('192.168.1.1');
    expect(ctx.userAgent).toBe('TestAgent/1.0');
  });

  it('extracts ipAddress from x-real-ip when x-forwarded-for is missing', async () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-real-ip': '203.0.113.42',
        'user-agent': 'Mozilla/5.0',
      },
    });
    const ctx = getAuditRequestContext(req as unknown as import('next/server').NextRequest);
    expect(ctx.ipAddress).toBe('203.0.113.42');
  });

  it('extracts requestId from x-request-id', async () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-request-id': 'req-abc123',
      },
    });
    const ctx = getAuditRequestContext(req as unknown as import('next/server').NextRequest);
    expect(ctx.requestId).toBe('req-abc123');
  });

  it('returns null for missing headers', async () => {
    const req = new Request('http://localhost');
    const ctx = getAuditRequestContext(req as unknown as import('next/server').NextRequest);
    expect(ctx.ipAddress).toBeNull();
    expect(ctx.userAgent).toBeNull();
    expect(ctx.requestId).toBeNull();
    expect(ctx.sessionId).toBeNull();
  });
});
