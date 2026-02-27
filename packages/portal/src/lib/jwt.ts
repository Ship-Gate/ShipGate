import jwt from 'jsonwebtoken';

const SECRET = process.env.LICENSE_JWT_SECRET || 'shipgate-dev-secret-change-me';

export interface LicensePayload {
  email: string;
  plan: 'pro';
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  iat?: number;
  exp?: number;
}

export function signLicense(payload: Omit<LicensePayload, 'iat' | 'exp'>): string {
  return jwt.sign(
    { ...payload, plan: 'pro' },
    SECRET,
    { expiresIn: '365d' }
  );
}

export function verifyLicense(token: string): LicensePayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as LicensePayload;
    return decoded;
  } catch {
    return null;
  }
}
