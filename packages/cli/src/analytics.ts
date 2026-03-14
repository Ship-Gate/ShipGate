/**
 * Opt-in CLI Analytics
 *
 * Anonymous usage tracking via PostHog. Disabled by default.
 * Enable with: shipgate config set analytics.enabled true
 * Or set env: SHIPGATE_ANALYTICS=1
 *
 * Collected: command name, duration, verdict, error codes, OS, Node version.
 * NOT collected: file paths, code content, API keys, user identity.
 */

import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const POSTHOG_HOST = 'https://us.i.posthog.com';
const POSTHOG_KEY = 'phc_shipgate_cli_analytics';

interface AnalyticsEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
  distinct_id: string;
}

let _enabled: boolean | null = null;
let _distinctId: string | null = null;

/**
 * Check if analytics is enabled. Returns false by default.
 */
export function isAnalyticsEnabled(): boolean {
  if (_enabled !== null) return _enabled;

  if (process.env.SHIPGATE_ANALYTICS === '0' || process.env.SHIPGATE_DO_NOT_TRACK === '1') {
    _enabled = false;
    return false;
  }

  if (process.env.SHIPGATE_ANALYTICS === '1') {
    _enabled = true;
    return true;
  }

  try {
    const configPath = path.join(os.homedir(), '.shipgate', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    _enabled = config?.analytics?.enabled === true;
  } catch {
    _enabled = false;
  }

  return _enabled;
}

function getDistinctId(): string {
  if (_distinctId) return _distinctId;

  try {
    const idPath = path.join(os.homedir(), '.shipgate', 'analytics-id');
    if (fs.existsSync(idPath)) {
      _distinctId = fs.readFileSync(idPath, 'utf8').trim();
    } else {
      _distinctId = createHash('sha256')
        .update(randomUUID())
        .digest('hex')
        .slice(0, 16);
      const dir = path.join(os.homedir(), '.shipgate');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(idPath, _distinctId);
    }
  } catch {
    _distinctId = 'anonymous';
  }

  return _distinctId;
}

/**
 * Track a CLI command execution. Fire-and-forget, never throws.
 */
export function trackCommand(
  command: string,
  properties: Record<string, unknown> = {},
): void {
  if (!isAnalyticsEnabled()) return;

  const event: AnalyticsEvent = {
    event: 'cli_command',
    distinct_id: getDistinctId(),
    timestamp: new Date().toISOString(),
    properties: {
      command,
      os: os.platform(),
      os_version: os.release(),
      node_version: process.version,
      cli_version: process.env.npm_package_version ?? 'unknown',
      ci: !!(process.env.CI || process.env.GITHUB_ACTIONS),
      ...properties,
    },
  };

  sendEvent(event);
}

/**
 * Track a command's result. Fire-and-forget.
 */
export function trackResult(
  command: string,
  verdict: string,
  durationMs: number,
  properties: Record<string, unknown> = {},
): void {
  if (!isAnalyticsEnabled()) return;

  trackCommand(`${command}_result`, {
    verdict,
    duration_ms: durationMs,
    ...properties,
  });
}

function sendEvent(event: AnalyticsEvent): void {
  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event: event.event,
    properties: {
      ...event.properties,
      distinct_id: event.distinct_id,
      $lib: 'shipgate-cli',
    },
    timestamp: event.timestamp,
  });

  try {
    const url = new URL('/capture/', POSTHOG_HOST);
    fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {
    // Never block the CLI
  }
}

/**
 * Enable or disable analytics.
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  _enabled = enabled;
  try {
    const dir = path.join(os.homedir(), '.shipgate');
    fs.mkdirSync(dir, { recursive: true });
    const configPath = path.join(dir, 'config.json');
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch { /* empty */ }
    config.analytics = { enabled };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  } catch {
    // Best effort
  }
}
