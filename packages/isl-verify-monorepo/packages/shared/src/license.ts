import jwt from 'jsonwebtoken';
import type { LicenseKey, LicenseValidation, Tier } from './types';

const LICENSE_SECRET = process.env.ISL_VERIFY_LICENSE_SECRET || 'isl-verify-secret-key-change-in-production';

export class LicenseValidator {
  /**
   * Generate a license key JWT
   */
  static generate(payload: Omit<LicenseKey, 'issuer' | 'issuedAt'>): string {
    const fullPayload: LicenseKey = {
      ...payload,
      issuer: 'isl-verify',
      issuedAt: new Date().toISOString(),
    };

    return jwt.sign(fullPayload, LICENSE_SECRET, {
      algorithm: 'HS256',
    });
  }

  /**
   * Validate a license key and return decoded payload
   */
  static validate(licenseKey: string): LicenseValidation {
    try {
      const decoded = jwt.verify(licenseKey, LICENSE_SECRET, {
        algorithms: ['HS256'],
      }) as LicenseKey;

      if (!decoded || !decoded.tier || !decoded.email) {
        return {
          valid: false,
          tier: 'free',
          message: 'Invalid license format',
        };
      }

      const expiresAt = new Date(decoded.expiresAt);
      const now = new Date();

      if (expiresAt < now) {
        return {
          valid: false,
          tier: 'free',
          message: 'License expired',
          expiresAt: decoded.expiresAt,
          daysUntilExpiry: Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        };
      }

      const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        valid: true,
        tier: decoded.tier,
        expiresAt: decoded.expiresAt,
        daysUntilExpiry,
      };
    } catch (error) {
      return {
        valid: false,
        tier: 'free',
        message: error instanceof Error ? error.message : 'Invalid license key',
      };
    }
  }

  /**
   * Decode a license key without validation (for display purposes)
   */
  static decode(licenseKey: string): LicenseKey | null {
    try {
      const decoded = jwt.decode(licenseKey) as LicenseKey;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Check if a tier has access to a feature
   */
  static hasFeature(tier: Tier, feature: string): boolean {
    const tierFeatures: Record<Tier, string[]> = {
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

    return tierFeatures[tier]?.includes(feature) ?? false;
  }

  /**
   * Get the maximum tier allowed for a license
   */
  static getMaxTier(licenseValidation: LicenseValidation): 'tier1' | 'tier2' | 'tier3' {
    if (!licenseValidation.valid) return 'tier1';

    switch (licenseValidation.tier) {
      case 'team':
      case 'enterprise':
        return 'tier3';
      default:
        return 'tier1';
    }
  }
}
