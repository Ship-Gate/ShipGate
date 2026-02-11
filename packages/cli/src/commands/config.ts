/**
 * Config Command
 * 
 * Manage ISL CLI configuration including AI API keys.
 * 
 * Usage:
 *   isl config set <key> <value>    # Set a config value
 *   isl config get <key>            # Get a config value
 *   isl config list                 # List all config values
 *   isl config path                 # Show config file path
 * 
 * Examples:
 *   isl config set ai.provider anthropic
 *   isl config set ai.apiKey ${ANTHROPIC_API_KEY}
 *   isl config set ai.model claude-sonnet-4-20250514
 *   isl config get ai.provider
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import chalk from 'chalk';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_FILENAMES = ['.islrc.yaml', '.islrc.yml', '.islrc.json', 'isl.config.yaml'];
const DEFAULT_CONFIG_FILE = '.islrc.yaml';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfigCommandResult {
  success: boolean;
  action: 'set' | 'get' | 'list' | 'path';
  key?: string;
  value?: string;
  configPath?: string;
  entries?: Array<{ key: string; value: string }>;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config File Discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the config file path, searching up from cwd.
 */
function findConfigFile(startDir?: string): string | null {
  let dir = resolve(startDir ?? process.cwd());
  const root = dirname(dir) === dir ? dir : undefined;

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(dir);
    if (parent === dir || parent === root) break;
    dir = parent;
  }

  return null;
}

/**
 * Get the default config file path (for creating new config).
 */
function getDefaultConfigPath(): string {
  return resolve(process.cwd(), DEFAULT_CONFIG_FILE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Read/Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the config file and return as a plain object.
 */
async function readConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(configPath, 'utf-8');
    if (configPath.endsWith('.json')) {
      return JSON.parse(content) as Record<string, unknown>;
    }
    return (parseYaml(content) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/**
 * Write the config object to the config file.
 */
async function writeConfig(configPath: string, config: Record<string, unknown>): Promise<void> {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  let content: string;
  if (configPath.endsWith('.json')) {
    content = JSON.stringify(config, null, 2) + '\n';
  } else {
    content = stringifyYaml(config, { indent: 2 });
  }

  await writeFile(configPath, content, 'utf-8');
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Flatten a nested object into dot-notation key-value pairs.
 */
function flattenConfig(obj: Record<string, unknown>, prefix = ''): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenConfig(value as Record<string, unknown>, fullKey));
    } else {
      entries.push({ key: fullKey, value: String(value) });
    }
  }

  return entries;
}

/**
 * Parse a string value into the appropriate type.
 */
function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set a config value.
 */
export async function configSet(key: string, value: string): Promise<ConfigCommandResult> {
  const configPath = findConfigFile() ?? getDefaultConfigPath();
  const config = await readConfig(configPath);

  setNestedValue(config, key, parseValue(value));
  await writeConfig(configPath, config);

  return {
    success: true,
    action: 'set',
    key,
    value,
    configPath,
  };
}

/**
 * Get a config value.
 */
export async function configGet(key: string): Promise<ConfigCommandResult> {
  const configPath = findConfigFile();
  if (!configPath) {
    return {
      success: false,
      action: 'get',
      key,
      error: 'No config file found. Run `isl config set <key> <value>` to create one.',
    };
  }

  const config = await readConfig(configPath);
  const value = getNestedValue(config, key);

  if (value === undefined) {
    return {
      success: false,
      action: 'get',
      key,
      configPath,
      error: `Key "${key}" not found in config.`,
    };
  }

  return {
    success: true,
    action: 'get',
    key,
    value: String(value),
    configPath,
  };
}

/**
 * List all config values.
 */
export async function configList(): Promise<ConfigCommandResult> {
  const configPath = findConfigFile();
  if (!configPath) {
    return {
      success: true,
      action: 'list',
      entries: [],
      error: 'No config file found.',
    };
  }

  const config = await readConfig(configPath);
  const entries = flattenConfig(config);

  return {
    success: true,
    action: 'list',
    configPath,
    entries,
  };
}

/**
 * Show config file path.
 */
export async function configPath(): Promise<ConfigCommandResult> {
  const configPath = findConfigFile();

  return {
    success: true,
    action: 'path',
    configPath: configPath ?? `(none found, would create: ${getDefaultConfigPath()})`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print config command result.
 */
export function printConfigResult(result: ConfigCommandResult, options: { format?: string } = {}): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success && result.error) {
    console.error(chalk.red(result.error));
    return;
  }

  switch (result.action) {
    case 'set':
      console.log(chalk.green(`✓ Set ${chalk.bold(result.key!)} = ${result.value}`));
      console.log(chalk.gray(`  Config: ${result.configPath}`));
      break;

    case 'get':
      console.log(result.value);
      break;

    case 'list':
      if (!result.entries || result.entries.length === 0) {
        console.log(chalk.gray('No configuration found.'));
        console.log(chalk.gray(`Run ${chalk.cyan('isl config set ai.provider anthropic')} to get started.`));
        return;
      }
      console.log(chalk.bold('Configuration:'));
      console.log(chalk.gray(`  File: ${result.configPath}`));
      console.log('');
      for (const entry of result.entries) {
        // Mask API keys
        const displayValue = entry.key.toLowerCase().includes('apikey') || entry.key.toLowerCase().includes('api_key')
          ? entry.value.slice(0, 8) + '...' + entry.value.slice(-4)
          : entry.value;
        console.log(`  ${chalk.cyan(entry.key)} = ${displayValue}`);
      }
      break;

    case 'path':
      console.log(result.configPath);
      break;
  }
}

/**
 * Get exit code for config result.
 */
export function getConfigExitCode(result: ConfigCommandResult): number {
  return result.success ? 0 : 1;
}
