/**
 * Pro License Service (server-backed via PAT)
 *
 * Checks Pro subscription status by calling GET /api/v1/me with
 * the stored Personal Access Token. The server DB is the single
 * source of truth for isPro.
 */

import * as vscode from 'vscode';

const PAT_SECRET_KEY = 'shipgate.pat';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ProState {
  active: boolean;
  email: string | null;
  plan: 'free' | 'pro';
  scansUsed: number;
  scansLimit: number;
  canScan: boolean;
  error: string | null;
  checking: boolean;
}

interface MeResponse {
  data: {
    id: string;
    email: string;
    name: string;
    isPro: boolean;
    scansUsed: number;
    scansLimit: number;
    canScan: boolean;
  };
}

export class ProService {
  private state: ProState = {
    active: false,
    email: null,
    plan: 'free',
    scansUsed: 0,
    scansLimit: 25,
    canScan: true,
    error: null,
    checking: false,
  };

  private lastFetch = 0;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(private readonly secrets: vscode.SecretStorage) {}

  private getApiUrl(): string {
    const config = vscode.workspace.getConfiguration('shipgate');
    return config.get<string>('dashboardApiUrl', 'https://app.shipgate.dev');
  }

  async initialize(): Promise<void> {
    const token = await this.secrets.get(PAT_SECRET_KEY);
    if (token) {
      await this.refresh();
    }
  }

  async refresh(): Promise<boolean> {
    const token = await this.secrets.get(PAT_SECRET_KEY);
    if (!token) {
      this.resetState();
      return false;
    }

    this.state.checking = true;
    this.state.error = null;
    this.notifyChange();

    try {
      const url = `${this.getApiUrl()}/api/v1/me`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'shipgate-vscode',
        },
      });

      if (!res.ok) {
        const msg = res.status === 401
          ? 'API token is invalid or expired. Re-set it with "ShipGate: Set API Token".'
          : `Server returned ${res.status}`;
        this.state.checking = false;
        this.state.error = msg;
        this.notifyChange();
        return false;
      }

      const body = (await res.json()) as MeResponse;
      const d = body.data;

      this.state = {
        active: d.isPro,
        email: d.email,
        plan: d.isPro ? 'pro' : 'free',
        scansUsed: d.scansUsed,
        scansLimit: d.scansLimit,
        canScan: d.canScan,
        error: null,
        checking: false,
      };
      this.lastFetch = Date.now();
      this.notifyChange();
      return d.isPro;
    } catch (err) {
      this.state.checking = false;
      this.state.error = 'Could not reach ShipGate API. Check your connection.';
      this.notifyChange();
      return false;
    }
  }

  getState(): ProState {
    return { ...this.state };
  }

  isPro(): boolean {
    return this.state.active;
  }

  canScan(): boolean {
    return this.state.canScan;
  }

  getUpgradeUrl(): string {
    return `${this.getApiUrl()}/checkout`;
  }

  /**
   * Re-fetch if cache is stale (> CACHE_TTL_MS).
   * Returns current isPro status.
   */
  async ensureFresh(): Promise<boolean> {
    if (Date.now() - this.lastFetch > CACHE_TTL_MS) {
      return this.refresh();
    }
    return this.state.active;
  }

  onChange(cb: () => void): vscode.Disposable {
    this.onChangeCallbacks.push(cb);
    return {
      dispose: () => {
        this.onChangeCallbacks = this.onChangeCallbacks.filter((c) => c !== cb);
      },
    };
  }

  private resetState(): void {
    this.state = {
      active: false,
      email: null,
      plan: 'free',
      scansUsed: 0,
      scansLimit: 25,
      canScan: true,
      error: null,
      checking: false,
    };
    this.notifyChange();
  }

  private notifyChange(): void {
    for (const cb of this.onChangeCallbacks) {
      try { cb(); } catch { /* silent */ }
    }
  }
}
