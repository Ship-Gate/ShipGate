import { createHmac, createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import * as os from 'node:os';
import type { ProofBundle } from './types.js';

export interface SignatureOptions {
  projectPath: string;
  secret?: string;
}

export async function createSignature(
  bundle: Omit<ProofBundle, 'signature'>,
  options: SignatureOptions
): Promise<string> {
  const signingKey = deriveSigningKey(options);
  const payload = createCanonicalPayload(bundle);
  
  const hmac = createHmac('sha256', signingKey);
  hmac.update(payload);
  
  return hmac.digest('hex');
}

export async function verifySignature(
  bundle: ProofBundle,
  options: SignatureOptions
): Promise<boolean> {
  const { signature, ...bundleWithoutSignature } = bundle;
  const expectedSignature = await createSignature(bundleWithoutSignature, options);
  
  return signature === expectedSignature;
}

function deriveSigningKey(options: SignatureOptions): string {
  if (options.secret) {
    // Use user-configured secret
    return options.secret;
  }

  // Fallback: derive from project metadata
  const components: string[] = [];
  
  // Try to get git remote URL
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd: options.projectPath,
      encoding: 'utf-8',
    }).trim();
    components.push(remoteUrl);
  } catch {
    // No git remote
  }

  // Add project path (normalized)
  components.push(options.projectPath);

  // Machine-specific fallback: hostname + username
  components.push(os.hostname());
  components.push(os.userInfo().username);

  // Hash all components together
  const hash = createHash('sha256');
  hash.update(components.join('|'));
  
  return hash.digest('hex');
}

function createCanonicalPayload(bundle: Omit<ProofBundle, 'signature'>): string {
  // Create a deterministic JSON representation
  // Sort keys at all levels to ensure consistency
  const sortedBundle = sortObjectKeys(bundle);
  return JSON.stringify(sortedBundle);
}

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }

  return sorted;
}
