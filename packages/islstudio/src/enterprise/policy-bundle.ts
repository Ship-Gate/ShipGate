/**
 * ISL Studio - Enterprise Policy Bundles
 * 
 * Signed policy bundles for org-wide governance.
 */

import * as crypto from 'crypto';

export interface PolicyBundle {
  id: string;
  version: string;
  name: string;
  description: string;
  organization: string;
  
  // Policy configuration
  config: {
    packs: Record<string, { enabled: boolean; severity?: string }>;
    threshold: number;
    paths?: { include?: string[]; exclude?: string[] };
  };
  
  // Metadata
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
  
  // Signature (for verification)
  signature?: string;
}

export interface BundleVerification {
  valid: boolean;
  error?: string;
  bundle?: PolicyBundle;
}

/**
 * Create a new policy bundle
 */
export function createBundle(
  name: string,
  organization: string,
  config: PolicyBundle['config'],
  createdBy: string
): PolicyBundle {
  const bundle: PolicyBundle = {
    id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0.0',
    name,
    description: `Policy bundle for ${organization}`,
    organization,
    config,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  
  return bundle;
}

/**
 * Sign a policy bundle
 */
export function signBundle(bundle: PolicyBundle, secret: string): PolicyBundle {
  const payload = JSON.stringify({
    id: bundle.id,
    version: bundle.version,
    config: bundle.config,
    organization: bundle.organization,
    createdAt: bundle.createdAt,
  });
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return {
    ...bundle,
    signature: `v1:${signature}`,
  };
}

/**
 * Verify a signed policy bundle
 */
export function verifyBundle(bundle: PolicyBundle, secret: string): BundleVerification {
  if (!bundle.signature) {
    return { valid: false, error: 'Bundle is not signed' };
  }
  
  const [version, sig] = bundle.signature.split(':');
  if (version !== 'v1') {
    return { valid: false, error: `Unknown signature version: ${version}` };
  }
  
  const payload = JSON.stringify({
    id: bundle.id,
    version: bundle.version,
    config: bundle.config,
    organization: bundle.organization,
    createdAt: bundle.createdAt,
  });
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  if (sig !== expected) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  // Check expiry
  if (bundle.expiresAt) {
    const expiry = new Date(bundle.expiresAt);
    if (expiry < new Date()) {
      return { valid: false, error: 'Bundle has expired' };
    }
  }
  
  return { valid: true, bundle };
}

/**
 * Format bundle for display
 */
export function formatBundle(bundle: PolicyBundle): string {
  const lines: string[] = [];
  
  lines.push(`Policy Bundle: ${bundle.name}`);
  lines.push(`  ID: ${bundle.id}`);
  lines.push(`  Version: ${bundle.version}`);
  lines.push(`  Organization: ${bundle.organization}`);
  lines.push(`  Created: ${bundle.createdAt}`);
  lines.push(`  Created By: ${bundle.createdBy}`);
  
  if (bundle.expiresAt) {
    lines.push(`  Expires: ${bundle.expiresAt}`);
  }
  
  lines.push(`  Signed: ${bundle.signature ? 'Yes' : 'No'}`);
  lines.push('');
  lines.push('  Configuration:');
  lines.push(`    Threshold: ${bundle.config.threshold}`);
  lines.push('    Packs:');
  
  for (const [pack, cfg] of Object.entries(bundle.config.packs)) {
    lines.push(`      - ${pack}: ${cfg.enabled ? 'enabled' : 'disabled'}`);
  }
  
  return lines.join('\n');
}
