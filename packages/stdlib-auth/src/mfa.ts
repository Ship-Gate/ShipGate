/**
 * Multi-Factor Authentication
 */

import { authenticator } from 'otplib';
import { v4 as uuid } from 'uuid';
import type { MFADevice, MFAType, AuthResult } from './types';

export interface MFAStore {
  createDevice(device: Omit<MFADevice, 'id' | 'createdAt'>): Promise<MFADevice>;
  findDevice(id: string): Promise<MFADevice | null>;
  findUserDevices(userId: string): Promise<MFADevice[]>;
  updateDevice(id: string, updates: Partial<MFADevice>): Promise<MFADevice>;
  deleteDevice(id: string): Promise<void>;
}

export class MFAService {
  constructor(private store: MFAStore) {}

  /**
   * Generate TOTP setup
   */
  async setupTOTP(
    userId: string,
    appName: string
  ): Promise<AuthResult<{
    device: MFADevice;
    secret: string;
    otpauthUrl: string;
    qrCode: string;
  }>> {
    const secret = authenticator.generateSecret();
    
    const device = await this.store.createDevice({
      userId,
      type: 'totp',
      secret,
      verified: false,
      name: 'Authenticator App',
    });

    const otpauthUrl = authenticator.keyuri(userId, appName, secret);
    
    // Generate QR code (data URL)
    const qrCode = await this.generateQRCode(otpauthUrl);

    return {
      ok: true,
      data: {
        device,
        secret,
        otpauthUrl,
        qrCode,
      },
    };
  }

  /**
   * Verify TOTP and enable device
   */
  async verifyTOTP(deviceId: string, code: string): Promise<AuthResult<MFADevice>> {
    const device = await this.store.findDevice(deviceId);
    
    if (!device) {
      return {
        ok: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'MFA device not found',
        },
      };
    }

    if (device.type !== 'totp' || !device.secret) {
      return {
        ok: false,
        error: {
          code: 'INVALID_DEVICE_TYPE',
          message: 'Device is not a TOTP device',
        },
      };
    }

    const isValid = authenticator.verify({ token: code, secret: device.secret });
    
    if (!isValid) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid verification code',
          retriable: true,
        },
      };
    }

    // Generate recovery codes
    const recoveryCodes = this.generateRecoveryCodes();

    const updatedDevice = await this.store.updateDevice(deviceId, {
      verified: true,
      recoveryCodes,
    });

    return { ok: true, data: updatedDevice };
  }

  /**
   * Verify MFA code
   */
  async verifyCode(
    userId: string,
    code: string,
    deviceId?: string
  ): Promise<AuthResult<{ device: MFADevice }>> {
    // Get user's MFA devices
    const devices = await this.store.findUserDevices(userId);
    const verifiedDevices = devices.filter((d) => d.verified);

    if (verifiedDevices.length === 0) {
      return {
        ok: false,
        error: {
          code: 'NO_MFA_DEVICES',
          message: 'No MFA devices configured',
        },
      };
    }

    // If specific device requested
    if (deviceId) {
      const device = verifiedDevices.find((d) => d.id === deviceId);
      if (!device) {
        return {
          ok: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'MFA device not found',
          },
        };
      }
      return this.verifyCodeForDevice(device, code);
    }

    // Try all devices
    for (const device of verifiedDevices) {
      const result = await this.verifyCodeForDevice(device, code);
      if (result.ok) {
        return result;
      }
    }

    // Check recovery codes
    for (const device of verifiedDevices) {
      if (device.recoveryCodes?.includes(code)) {
        // Use recovery code (single use)
        const remainingCodes = device.recoveryCodes.filter((c) => c !== code);
        await this.store.updateDevice(device.id, {
          recoveryCodes: remainingCodes,
          lastUsedAt: new Date(),
        });

        return {
          ok: true,
          data: { device },
        };
      }
    }

    return {
      ok: false,
      error: {
        code: 'INVALID_CODE',
        message: 'Invalid MFA code',
        retriable: true,
      },
    };
  }

  /**
   * Remove MFA device
   */
  async removeDevice(deviceId: string): Promise<AuthResult<void>> {
    const device = await this.store.findDevice(deviceId);
    
    if (!device) {
      return {
        ok: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'MFA device not found',
        },
      };
    }

    await this.store.deleteDevice(deviceId);
    return { ok: true, data: undefined };
  }

  /**
   * Get user's MFA devices
   */
  async getUserDevices(userId: string): Promise<MFADevice[]> {
    const devices = await this.store.findUserDevices(userId);
    
    // Remove secrets from response
    return devices.map((d) => ({
      ...d,
      secret: undefined,
      recoveryCodes: undefined,
    }));
  }

  /**
   * Generate new recovery codes
   */
  async regenerateRecoveryCodes(userId: string): Promise<AuthResult<string[]>> {
    const devices = await this.store.findUserDevices(userId);
    const verifiedDevices = devices.filter((d) => d.verified);

    if (verifiedDevices.length === 0) {
      return {
        ok: false,
        error: {
          code: 'NO_MFA_DEVICES',
          message: 'No MFA devices configured',
        },
      };
    }

    const newCodes = this.generateRecoveryCodes();

    // Update all devices with new codes
    for (const device of verifiedDevices) {
      await this.store.updateDevice(device.id, { recoveryCodes: newCodes });
    }

    return { ok: true, data: newCodes };
  }

  // Private methods

  private async verifyCodeForDevice(
    device: MFADevice,
    code: string
  ): Promise<AuthResult<{ device: MFADevice }>> {
    switch (device.type) {
      case 'totp':
        if (!device.secret) {
          return {
            ok: false,
            error: { code: 'INVALID_DEVICE', message: 'Device not configured' },
          };
        }
        
        const isValid = authenticator.verify({ token: code, secret: device.secret });
        if (isValid) {
          await this.store.updateDevice(device.id, { lastUsedAt: new Date() });
          return { ok: true, data: { device } };
        }
        break;

      case 'sms':
      case 'email':
        // Would verify against a stored OTP
        // This is a placeholder - real implementation would check stored code
        break;
    }

    return {
      ok: false,
      error: { code: 'INVALID_CODE', message: 'Invalid code', retriable: true },
    };
  }

  private generateRecoveryCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Array.from({ length: 8 }, () =>
        Math.random().toString(36).charAt(2)
      )
        .join('')
        .toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  private async generateQRCode(data: string): Promise<string> {
    // This would use a QR code library like 'qrcode'
    // For now, return placeholder
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>QR: ${encodeURIComponent(data)}</text></svg>`;
  }
}

/**
 * Create MFA service
 */
export function createMFAService(store: MFAStore): MFAService {
  return new MFAService(store);
}
