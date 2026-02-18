import jwt from 'jsonwebtoken';
import type { Tier } from '@shipgate/shared';

const SECRET = process.env.LICENSE_JWT_SECRET || 'default-secret-change-me';

export interface LicensePayload {
  tier: Tier;
  email: string;
  expiresAt: string;
  repoCount: number;
  features: string[];
}

export function signLicense(payload: LicensePayload): string {
  const fullPayload = {
    ...payload,
    issuer: 'shipgate',
    issuedAt: new Date().toISOString(),
  };

  return jwt.sign(fullPayload, SECRET, {
    algorithm: 'HS256',
  });
}

export function verifyLicense(token: string): LicensePayload & { issuer: string; issuedAt: string } {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
  }) as LicensePayload & { issuer: string; issuedAt: string };
}

export function getFeaturesByTier(tier: Tier): string[] {
  const featureMap: Record<Tier, string[]> = {
    free: ['tier1'],
    team: ['tier1', 'tier2', 'tier3', 'github-action', 'compliance', 'dashboard'],
    enterprise: [
      'tier1',
      'tier2',
      'tier3',
      'github-action',
      'compliance',
      'dashboard',
      'sso',
      'custom-provers',
      'on-prem',
      'sla',
      'audit-export',
    ],
  };

  return featureMap[tier] || [];
}
