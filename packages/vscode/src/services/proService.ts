/**
 * Pro License Service
 *
 * Manages Shipgate Pro subscription state:
 *  - Stores license token in VS Code SecretStorage
 *  - Verifies license with portal API
 *  - Caches shared API key for Pro features (heal, intent builder)
 *  - Exposes Pro status for sidebar gating
 */

import * as vscode from 'vscode';

const LICENSE_SECRET_KEY = 'shipgate.pro.licenseToken';
const PORTAL_BASE_URL = 'https://shipgate.dev';
const VERIFY_ENDPOINT = `${PORTAL_BASE_URL}/api/verify`;

// ── DEV/TEST MODE: set to true to bypass portal verification ──
// Any token will activate Pro, and the token itself is used as the API key.
// Set to false before shipping to production.
const DEV_MODE = true;

export interface ProState {
  active: boolean;
  email: string | null;
  plan: 'free' | 'pro';
  expiresAt: string | null;
  error: string | null;
  checking: boolean;
}

export class ProService {
  private state: ProState = {
    active: false,
    email: null,
    plan: 'free',
    expiresAt: null,
    error: null,
    checking: false,
  };

  private cachedApiKey: string | null = null;
  private licenseToken: string | null = null;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(private readonly secrets: vscode.SecretStorage) {}

  /**
   * Initialize: load stored license token and verify.
   */
  async initialize(): Promise<void> {
    try {
      const token = await this.secrets.get(LICENSE_SECRET_KEY);
      if (token) {
        this.licenseToken = token;
        await this.verify();
      }
    } catch {
      // Silent — no stored token
    }
  }

  /**
   * Activate Pro with a license token (from magic link URI callback).
   */
  async activate(token: string): Promise<boolean> {
    this.licenseToken = token;
    await this.secrets.store(LICENSE_SECRET_KEY, token);
    const ok = await this.verify();
    if (ok) {
      vscode.window.showInformationMessage('Shipgate Pro activated! 🎉 AI-powered features are now unlocked.');
    }
    return ok;
  }

  /**
   * Deactivate Pro (sign out).
   */
  async deactivate(): Promise<void> {
    this.licenseToken = null;
    this.cachedApiKey = null;
    await this.secrets.delete(LICENSE_SECRET_KEY);
    this.state = {
      active: false,
      email: null,
      plan: 'free',
      expiresAt: null,
      error: null,
      checking: false,
    };
    this.notifyChange();
  }

  /**
   * Verify the stored license token with the portal API.
   * Returns the shared API key on success.
   */
  async verify(): Promise<boolean> {
    if (!this.licenseToken) {
      this.state.active = false;
      this.state.plan = 'free';
      this.notifyChange();
      return false;
    }

    // ── DEV MODE: skip server verification, accept any token ──
    if (DEV_MODE) {
      this.state = {
        active: true,
        email: 'dev@shipgate.dev',
        plan: 'pro',
        expiresAt: null,
        error: null,
        checking: false,
      };
      // Use the token itself as the API key (paste your OpenAI key as the token)
      this.cachedApiKey = this.licenseToken;
      this.notifyChange();
      return true;
    }

    this.state.checking = true;
    this.state.error = null;
    this.notifyChange();

    try {
      const res = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.licenseToken}`,
        },
        body: JSON.stringify({ token: this.licenseToken }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.state.active = false;
        this.state.plan = 'free';
        this.state.error = res.status === 401 ? 'License expired or invalid' : `Verification failed: ${body}`;
        this.cachedApiKey = null;
        this.state.checking = false;
        this.notifyChange();
        return false;
      }

      const data = (await res.json()) as {
        active: boolean;
        email: string;
        plan: string;
        expiresAt: string;
        apiKey: string;
      };

      this.state = {
        active: data.active,
        email: data.email,
        plan: data.active ? 'pro' : 'free',
        expiresAt: data.expiresAt,
        error: null,
        checking: false,
      };
      this.cachedApiKey = data.apiKey || null;
      this.notifyChange();
      return data.active;
    } catch (err) {
      this.state.checking = false;
      this.state.error = 'Could not reach license server. Check your connection.';
      this.notifyChange();
      return false;
    }
  }

  /**
   * Get the shared API key for Pro users. Returns null if not Pro.
   */
  getApiKey(): string | null {
    return this.state.active ? this.cachedApiKey : null;
  }

  /**
   * Get current Pro state (for sidebar rendering).
   */
  getState(): ProState {
    return { ...this.state };
  }

  /**
   * Check if user has Pro access.
   */
  isPro(): boolean {
    return this.state.active;
  }

  /**
   * Get the portal URL for upgrading to Pro.
   */
  getUpgradeUrl(): string {
    return `${PORTAL_BASE_URL}/pro`;
  }

  /**
   * Register a callback for state changes.
   */
  onChange(cb: () => void): vscode.Disposable {
    this.onChangeCallbacks.push(cb);
    return { dispose: () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((c) => c !== cb);
    }};
  }

  private notifyChange(): void {
    for (const cb of this.onChangeCallbacks) {
      try { cb(); } catch { /* silent */ }
    }
  }
}
