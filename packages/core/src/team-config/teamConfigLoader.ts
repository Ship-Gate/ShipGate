/**
 * Team Config Loader
 *
 * Searches for .shipgate-team.yml walking up directories from the given
 * start path. Parses YAML, validates against the schema, and returns
 * with defaults applied.
 *
 * Team config can be found in:
 *   1. File in repo root (.shipgate-team.yml)
 *   2. File in parent directory (monorepo root)
 *   3. Explicit file path passed by caller
 */

import { readFile, access } from 'fs/promises';
import { resolve, dirname, join } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  TeamConfig,
  LoadTeamConfigResult,
  TeamConfigValidationError,
} from './teamConfigTypes.js';
import { TEAM_CONFIG_FILE_NAMES, applyTeamConfigDefaults, DEFAULT_TEAM_CONFIG } from './teamConfigSchema.js';
import { validateTeamConfig, formatTeamConfigErrors } from './teamConfigValidator.js';

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
 * Walk up from `startDir` looking for a team config file.
 * Returns the path if found, null otherwise.
 */
async function findTeamConfigFile(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);

  while (true) {
    for (const name of TEAM_CONFIG_FILE_NAMES) {
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
// Custom error class
// ─────────────────────────────────────────────────────────────────────────────

/** Error thrown when a team config file is invalid */
export class TeamConfigError extends Error {
  public readonly validationErrors: TeamConfigValidationError[];
  public readonly configPath: string;

  constructor(message: string, errors: TeamConfigValidationError[], configPath: string) {
    super(message);
    this.name = 'TeamConfigError';
    this.validationErrors = errors;
    this.configPath = configPath;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load team configuration by searching up directories.
 *
 * Search order per directory:
 *   1. .shipgate-team.yml
 *   2. .shipgate-team.yaml
 *   3. shipgate-team.config.yml
 *   4. shipgate-team.config.yaml
 *
 * Walks up directories from `searchFrom` (defaults to cwd).
 * If no config file is found, returns default config.
 *
 * @throws TeamConfigError if config file exists but is invalid
 */
export async function loadTeamConfig(searchFrom?: string): Promise<LoadTeamConfigResult> {
  const startDir = searchFrom ?? process.cwd();
  const configPath = await findTeamConfigFile(startDir);

  if (!configPath) {
    return {
      config: { ...DEFAULT_TEAM_CONFIG, policies: { ...DEFAULT_TEAM_CONFIG.policies } },
      configPath: null,
      source: 'defaults',
    };
  }

  return loadTeamConfigFromFile(configPath);
}

/**
 * Load and validate a team config from a specific file path.
 *
 * @throws TeamConfigError if file cannot be read, contains invalid YAML, or fails validation
 */
export async function loadTeamConfigFromFile(configPath: string): Promise<LoadTeamConfigResult> {
  const content = await readFile(configPath, 'utf-8');

  // Parse YAML
  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new TeamConfigError(
      `Failed to parse ${configPath}: ${message}`,
      [{ path: '', message: `Invalid YAML: ${message}` }],
      configPath,
    );
  }

  // Handle empty file
  if (raw === null || raw === undefined) {
    throw new TeamConfigError(
      `${configPath} is empty`,
      [{ path: '', message: 'Team config file is empty' }],
      configPath,
    );
  }

  // Validate
  const validation = validateTeamConfig(raw);
  if (!validation.valid) {
    const formatted = formatTeamConfigErrors(validation.errors, configPath);
    throw new TeamConfigError(formatted, validation.errors, configPath);
  }

  // Apply defaults for any missing optional fields
  const config = applyTeamConfigDefaults(validation.config!);

  return {
    config,
    configPath,
    source: 'file',
  };
}

/**
 * Parse a team config from a raw YAML string (no file I/O).
 * Useful for testing or when the content is already in memory.
 *
 * @throws TeamConfigError if YAML is invalid or fails validation
 */
export function parseTeamConfigString(yamlContent: string, sourcePath?: string): TeamConfig {
  let raw: unknown;
  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new TeamConfigError(
      `Failed to parse team config: ${message}`,
      [{ path: '', message: `Invalid YAML: ${message}` }],
      sourcePath ?? '<inline>',
    );
  }

  if (raw === null || raw === undefined) {
    throw new TeamConfigError(
      'Team config is empty',
      [{ path: '', message: 'Team config is empty' }],
      sourcePath ?? '<inline>',
    );
  }

  const validation = validateTeamConfig(raw);
  if (!validation.valid) {
    const formatted = formatTeamConfigErrors(validation.errors, sourcePath);
    throw new TeamConfigError(formatted, validation.errors, sourcePath ?? '<inline>');
  }

  return applyTeamConfigDefaults(validation.config!);
}
