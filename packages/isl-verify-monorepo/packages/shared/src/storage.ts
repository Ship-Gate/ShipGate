import fs from 'fs';
import path from 'path';
import os from 'os';
import type { StoredLicense, LicenseValidation } from './types';
import { LicenseValidator } from './license';

export class LicenseStorage {
  private static LICENSE_DIR = path.join(os.homedir(), '.isl-verify');
  private static LICENSE_FILE = path.join(LicenseStorage.LICENSE_DIR, 'license.json');
  private static CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Ensure license directory exists
   */
  private static ensureDir(): void {
    if (!fs.existsSync(this.LICENSE_DIR)) {
      fs.mkdirSync(this.LICENSE_DIR, { recursive: true });
    }
  }

  /**
   * Store a license key
   */
  static store(licenseKey: string): void {
    const decoded = LicenseValidator.decode(licenseKey);
    if (!decoded) {
      throw new Error('Invalid license key format');
    }

    this.ensureDir();

    const stored: StoredLicense = {
      key: licenseKey,
      decoded,
      lastValidated: new Date().toISOString(),
    };

    fs.writeFileSync(this.LICENSE_FILE, JSON.stringify(stored, null, 2), 'utf-8');
  }

  /**
   * Load stored license
   */
  static load(): StoredLicense | null {
    try {
      if (!fs.existsSync(this.LICENSE_FILE)) {
        return null;
      }

      const content = fs.readFileSync(this.LICENSE_FILE, 'utf-8');
      const stored = JSON.parse(content) as StoredLicense;

      return stored;
    } catch {
      return null;
    }
  }

  /**
   * Remove stored license
   */
  static remove(): void {
    if (fs.existsSync(this.LICENSE_FILE)) {
      fs.unlinkSync(this.LICENSE_FILE);
    }
  }

  /**
   * Validate stored license (with caching)
   */
  static validate(forceRevalidate = false): LicenseValidation {
    const stored = this.load();

    if (!stored) {
      return {
        valid: false,
        tier: 'free',
        message: 'No license found',
      };
    }

    // Check cache validity
    const lastValidatedTime = new Date(stored.lastValidated).getTime();
    const now = Date.now();
    const needsRevalidation = forceRevalidate || now - lastValidatedTime > this.CACHE_DURATION_MS;

    const validation = LicenseValidator.validate(stored.key);

    // Update last validated timestamp if needed
    if (needsRevalidation && validation.valid) {
      stored.lastValidated = new Date().toISOString();
      fs.writeFileSync(this.LICENSE_FILE, JSON.stringify(stored, null, 2), 'utf-8');
    }

    return validation;
  }

  /**
   * Get license key from storage or environment variable
   */
  static getLicenseKey(): string | null {
    // Check environment variable first (for CI)
    const envKey = process.env.ISL_VERIFY_LICENSE;
    if (envKey) {
      return envKey;
    }

    // Check stored license
    const stored = this.load();
    return stored?.key ?? null;
  }
}
