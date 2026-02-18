export type Tier = 'free' | 'team' | 'enterprise';

export interface LicenseKey {
  tier: Tier;
  email: string;
  expiresAt: string;
  repoCount: number;
  features: string[];
  issuer: string;
  issuedAt: string;
}

export interface LicenseValidation {
  valid: boolean;
  tier: Tier;
  message?: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
}

export interface StoredLicense {
  key: string;
  decoded: LicenseKey;
  lastValidated: string;
}
