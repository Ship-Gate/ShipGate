/**
 * ShipGate Configuration Loader
 *
 * Searches for .shipgate.yml / .shipgate.yaml / shipgate.config.yml
 * walking up directories from the given start path (or cwd).
 * Parses YAML, validates against the schema, and returns with defaults applied.
 */

import { readFile, access } from 'fs/promises';
import { resolve, dirname, join, parse as parsePath } from 'path';
import { parse as parseYaml } from 'yaml';
import type { ShipGateConfig } from './schema.js';
import { applyDefaults, DEFAULT_SHIPGATE_CONFIG } from './schema.js';
import { validateConfig, formatValidationErrors } from './validator.js';
import type { ValidationError } from './validator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadConfigResult {
  /** Fully-resolved config with defaults applied */
  config: ShipGateConfig;
  /** Path to the config file (null if using defaults) */
  configPath: string | null;
  /** Whether the config was loaded from a file or fell back to defaults */
  source: 'file' | 'defaults';
  /** Validation errors (only populated if config was invalid) */
  errors?: ValidationError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Config file names (in search priority order)
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_FILE_NAMES = [
  '.shipgate.yml',
  '.shipgate.yaml',
  'shipgate.config.yml',
  'shipgate.config.yaml',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk up from `startDir` looking for a config file.
 * Returns the path if found, null otherwise.
 */
async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);

  // Walk up until root
  // eslint-disable-next-line no-constant-condition
  while (true) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = join(dir, name);
      if (await fileExists(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      // Reached filesystem root
      break;
    }
    dir = parent;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load ShipGate configuration.
 *
 * Search order:
 *   1. .shipgate.yml
 *   2. .shipgate.yaml
 *   3. shipgate.config.yml
 *   4. shipgate.config.yaml
 *
 * Walks up directories from `searchFrom` (defaults to cwd).
 * If no config file is found, returns default config.
 *
 * @throws Error if config file exists but contains invalid YAML or fails schema validation
 */
export async function loadShipGateConfig(searchFrom?: string): Promise<LoadConfigResult> {
  const startDir = searchFrom ?? process.cwd();
  const configPath = await findConfigFile(startDir);

  if (!configPath) {
    return {
      config: { ...DEFAULT_SHIPGATE_CONFIG },
      configPath: null,
      source: 'defaults',
    };
  }

  return loadShipGateConfigFromFile(configPath);
}

/**
 * Load and validate a config from a specific file path.
 *
 * @throws Error if file cannot be read, contains invalid YAML, or fails validation
 */
export async function loadShipGateConfigFromFile(configPath: string): Promise<LoadConfigResult> {
  const content = await readFile(configPath, 'utf-8');

  // Parse YAML
  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse ${configPath}: ${message}`);
  }

  // Handle empty file
  if (raw === null || raw === undefined) {
    throw new Error(`${configPath} is empty`);
  }

  // Validate
  const validation = validateConfig(raw);
  if (!validation.valid) {
    const formatted = formatValidationErrors(validation.errors, configPath);
    throw new ShipGateConfigError(formatted, validation.errors, configPath);
  }

  // Apply defaults
  const config = applyDefaults(validation.config!);

  return {
    config,
    configPath,
    source: 'file',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom error class
// ─────────────────────────────────────────────────────────────────────────────

export class ShipGateConfigError extends Error {
  public readonly validationErrors: ValidationError[];
  public readonly configPath: string;

  constructor(message: string, errors: ValidationError[], configPath: string) {
    super(message);
    this.name = 'ShipGateConfigError';
    this.validationErrors = errors;
    this.configPath = configPath;
  }
}
