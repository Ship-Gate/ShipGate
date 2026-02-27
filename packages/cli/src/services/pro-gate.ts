/**
 * Pro tier gating for CLI commands.
 * Calls GET /api/v1/me to check license status.
 */

import chalk from 'chalk';
import { api } from './api-client.js';
import { getToken, getApiUrl } from './config-store.js';

interface MeResponse {
  isPro: boolean;
  scansUsed: number;
  scansLimit: number;
  canScan: boolean;
}

/**
 * Check if the current user is a Pro subscriber.
 * Returns true if Pro, false if free (and prints upgrade message).
 * If not authenticated, prints auth message and returns false.
 */
export async function requirePro(commandName: string): Promise<boolean> {
  if (!getToken()) {
    console.error(chalk.yellow(`\n⚠ Not authenticated. Run \`shipgate auth login <token>\` first.`));
    return false;
  }

  try {
    const res = await api.get<MeResponse>('/api/v1/me');
    if (res.data?.isPro) return true;

    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.replace(/\/api\/v1$/, '').replace(/\/$/, '');

    console.error(chalk.yellow(`\n⚠ "${commandName}" requires ShipGate Pro.`));
    console.error(chalk.gray(`  Your plan: Free`));
    if (res.data?.scansLimit && isFinite(res.data.scansLimit)) {
      console.error(chalk.gray(`  Scans: ${res.data.scansUsed}/${res.data.scansLimit} this month`));
    }
    console.error(chalk.cyan(`  Upgrade → ${baseUrl}/checkout\n`));
    return false;
  } catch {
    console.error(chalk.yellow(`\n⚠ Could not verify Pro status. Check your connection and token.`));
    return false;
  }
}

/**
 * Format the 402 scan-limit error returned by POST /api/v1/runs
 */
export function formatScanLimitError(error: { message?: string; upgradeUrl?: string }): string {
  const lines = [
    chalk.yellow(`\n⚠ ${error.message ?? "You've reached your monthly scan limit."}`),
    chalk.cyan(`  Upgrade to Pro: ${error.upgradeUrl ?? 'https://app.shipgate.dev/checkout'}`),
    '',
  ];
  return lines.join('\n');
}
