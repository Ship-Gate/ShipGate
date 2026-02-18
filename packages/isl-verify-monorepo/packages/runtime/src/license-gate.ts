import { LicenseStorage, LicenseValidator } from '@shipgate/shared';
import type { Tier } from '@shipgate/shared';

export class LicenseGate {
  private static cachedValidation: ReturnType<typeof LicenseStorage.validate> | null = null;

  /**
   * Check if the current license allows access to a tier
   */
  static checkTier(requiredTier: 'tier2' | 'tier3'): {
    allowed: boolean;
    message?: string;
    tier: Tier;
  } {
    const validation = this.getValidation();

    if (!validation.valid) {
      return {
        allowed: false,
        tier: 'free',
        message: this.getUpgradeMessage(requiredTier, validation.message),
      };
    }

    const hasAccess =
      requiredTier === 'tier2'
        ? ['team', 'enterprise'].includes(validation.tier)
        : ['enterprise', 'team'].includes(validation.tier);

    if (!hasAccess) {
      return {
        allowed: false,
        tier: validation.tier,
        message: this.getUpgradeMessage(requiredTier),
      };
    }

    return {
      allowed: true,
      tier: validation.tier,
    };
  }

  /**
   * Check if a feature is available
   */
  static checkFeature(feature: string): {
    allowed: boolean;
    message?: string;
    tier: Tier;
  } {
    const validation = this.getValidation();

    if (!validation.valid) {
      return {
        allowed: false,
        tier: 'free',
        message: this.getFeatureUpgradeMessage(feature, validation.message),
      };
    }

    const hasAccess = LicenseValidator.hasFeature(validation.tier, feature);

    if (!hasAccess) {
      return {
        allowed: false,
        tier: validation.tier,
        message: this.getFeatureUpgradeMessage(feature),
      };
    }

    return {
      allowed: true,
      tier: validation.tier,
    };
  }

  /**
   * Get current license validation (with caching)
   */
  private static getValidation() {
    if (!this.cachedValidation) {
      this.cachedValidation = LicenseStorage.validate();
    }
    return this.cachedValidation;
  }

  /**
   * Force revalidation (clears cache)
   */
  static revalidate(): void {
    this.cachedValidation = null;
  }

  /**
   * Get upgrade message for tier access
   */
  private static getUpgradeMessage(tier: string, reason?: string): string {
    const baseMessage = reason
      ? `License validation failed: ${reason}.`
      : 'Your current license does not include access to this tier.';

    return `${baseMessage}\n\nTo use ${tier.toUpperCase()} provers, upgrade to Team or Enterprise:\nhttps://isl-verify.com/pricing\n\nOr activate your license:\n  isl-verify activate <license-key>`;
  }

  /**
   * Get upgrade message for feature access
   */
  private static getFeatureUpgradeMessage(feature: string, reason?: string): string {
    const baseMessage = reason
      ? `License validation failed: ${reason}.`
      : 'Your current license does not include access to this feature.';

    return `${baseMessage}\n\nTo use ${feature}, upgrade your license:\nhttps://isl-verify.com/pricing`;
  }

  /**
   * Display license info
   */
  static getLicenseInfo(): {
    tier: Tier;
    valid: boolean;
    expiresAt?: string;
    daysUntilExpiry?: number;
    message?: string;
  } {
    const validation = this.getValidation();
    return validation;
  }
}
