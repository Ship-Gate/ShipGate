/**
 * Persistent CLI configuration stored at ~/.shipgate/config.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface CliConfig {
  apiUrl: string;
  token?: string;
  defaultOrgId?: string;
  defaultProjectId?: string;
}

const CONFIG_DIR = join(homedir(), '.shipgate');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: CliConfig = {
  apiUrl: 'http://localhost:3001',
};

export function loadCliConfig(): CliConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveCliConfig(config: Partial<CliConfig>): CliConfig {
  const current = loadCliConfig();
  const merged = { ...current, ...config };
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

export function getToken(): string | null {
  return loadCliConfig().token ?? null;
}

export function getApiUrl(): string {
  return loadCliConfig().apiUrl;
}
