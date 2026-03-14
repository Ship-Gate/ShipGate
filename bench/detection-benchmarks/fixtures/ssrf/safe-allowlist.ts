import { Request, Response } from 'express';
import axios from 'axios';
import { URL } from 'url';
import dns from 'dns/promises';
import { isIP } from 'net';

const ALLOWED_DOMAINS = new Set([
  'api.github.com',
  'api.stripe.com',
  'hooks.slack.com',
  'api.sendgrid.com',
  'api.twilio.com',
]);

const ALLOWED_SCHEMES = new Set(['https:']);

const BLOCKED_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '0.0.0.0', end: '0.255.255.255' },
];

function ipToNumber(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
}

function isPrivateIp(ip: string): boolean {
  if (!isIP(ip)) return false;

  const ipNum = ipToNumber(ip);

  for (const range of BLOCKED_IP_RANGES) {
    const start = ipToNumber(range.start);
    const end = ipToNumber(range.end);
    if (ipNum >= start && ipNum <= end) return true;
  }

  return false;
}

async function validateUrl(rawUrl: string): Promise<{
  valid: boolean;
  error?: string;
  parsed?: URL;
}> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { valid: false, error: `Scheme ${parsed.protocol} is not allowed` };
  }

  if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
    return {
      valid: false,
      error: `Domain ${parsed.hostname} is not in the allowlist`,
    };
  }

  try {
    const addresses = await dns.resolve4(parsed.hostname);

    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return {
          valid: false,
          error: `Domain resolves to private IP: ${addr}`,
        };
      }
    }
  } catch {
    return { valid: false, error: 'DNS resolution failed' };
  }

  return { valid: true, parsed };
}

export async function proxyRequest(req: Request, res: Response) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const validation = await validateUrl(url);

  if (!validation.valid) {
    return res.status(403).json({ error: validation.error });
  }

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 0,
      headers: { 'User-Agent': 'AppProxy/1.0' },
      validateStatus: (status) => status < 400,
    });

    return res.json({
      status: response.status,
      contentType: response.headers['content-type'],
      data: response.data,
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}

export async function sendWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const validation = await validateUrl(webhookUrl);

  if (!validation.valid) {
    console.error(`Webhook URL validation failed: ${validation.error}`);
    return false;
  }

  try {
    const response = await axios.post(webhookUrl, payload, {
      timeout: 5000,
      maxRedirects: 0,
      headers: { 'Content-Type': 'application/json' },
    });

    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}
