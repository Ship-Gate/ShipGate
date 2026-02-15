/**
 * Hash utilities for ISL Certificate
 */

import { createHash, createHmac } from 'node:crypto';

/** SHA-256 hash of content */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** HMAC-SHA256 signature */
export function hmacSha256(content: string, secret: string): string {
  return createHmac('sha256', secret).update(content, 'utf-8').digest('hex');
}

/** Deterministic JSON stringify with sorted keys */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k]));
  return '{' + pairs.join(',') + '}';
}

/** Content to sign (excludes signature field) */
export function getSignableContent(cert: Record<string, unknown>): string {
  const { signature: _sig, ...rest } = cert;
  return stableStringify(rest);
}
