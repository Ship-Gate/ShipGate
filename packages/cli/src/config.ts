/**
 * Configuration Loader
 * 
 * Loads and validates ISL configuration files.
 * Supports both YAML (.yaml, .yml) and JSON (.json) formats.
 */

import { readFile, access } from 'fs/promises';
import { resolve, dirname, join } from 'path';
import { parse as parseYaml } from 'yaml';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Output generation configuration */
export interface OutputConfig {
  /** Output directory for generated files */
  dir: string;
  /** Whether to generate TypeScript types */
  types?: boolean;
  /** Whether to generate tests */
  tests?: boolean;
  /** Whether to generate documentation */
  docs?: boolean;
}

/** AI generation configuration */
export interface AIConfig {
  /** AI model to use */
  model?: string;
  /** API key (can reference env vars with ${VAR}) */
  apiKey?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
}

/** Verification configuration */
export interface VerifyConfig {
  /** Test timeout in milliseconds */
  timeout?: number;
  /** Minimum trust score for passing */
  minTrustScore?: number;
  /** Whether to run in verbose mode */
  verbose?: boolean;
}

/** Full ISL configuration */
export interface ISLConfig {
  /** Config file version */
  version?: string;
  /** Project name */
  name?: string;
  /** ISL source files or directories */
  include: string[];
  /** Files or patterns to exclude */
  exclude?: string[];
  /** Output configuration */
  output: OutputConfig;
  /** AI configuration */
  ai?: AIConfig;
  /** Verification configuration */
  verify?: VerifyConfig;
  /** Custom templates directory */
  templates?: string;
  /** Additional plugins */
  plugins?: string[];
}

/** Config search result */
export interface ConfigSearchResult {
  config: ISLConfig | null;
  configPath: string | null;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Config file names to search for (in order of priority) */
const CONFIG_FILES = [
  'isl.config.json',
  'isl.config.yaml',
  'isl.config.yml',
  '.islrc.json',
  '.islrc.yaml',
  '.islrc.yml',
  '.islrc',
];

/** Default configuration */
const DEFAULT_CONFIG: ISLConfig = {
  version: '1.0',
  include: ['**/*.isl'],
  exclude: ['node_modules/**', 'dist/**'],
  output: {
    dir: './generated',
    types: true,
    tests: true,
    docs: false,
  },
  ai: {
    model: 'claude-sonnet-4-20250514',
  },
  verify: {
    timeout: 30000,
    minTrustScore: 70,
    verbose: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Search for a config file starting from the given directory
 */
async function searchConfigFile(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);
  const root = dirname(dir);

  while (dir !== root) {
    for (const filename of CONFIG_FILES) {
      const configPath = join(dir, filename);
      if (await fileExists(configPath)) {
        return configPath;
      }
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Expand environment variables in a string
 */
function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] ?? match;
  });
}

/**
 * Expand environment variables in config
 */
function expandConfigEnvVars(config: ISLConfig): ISLConfig {
  const expanded = { ...config };
  
  if (expanded.ai?.apiKey) {
    expanded.ai = { ...expanded.ai, apiKey: expandEnvVars(expanded.ai.apiKey) };
  }
  
  return expanded;
}

/**
 * Validate configuration
 */
function validateConfig(config: unknown): config is Partial<ISLConfig> {
  if (typeof config !== 'object' || config === null) {
    return false;
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Include must be an array if present
  if (cfg.include !== undefined && !Array.isArray(cfg.include)) {
    return false;
  }
  
  // Output.dir must be a string if output is present
  if (cfg.output !== undefined) {
    if (typeof cfg.output !== 'object' || cfg.output === null) {
      return false;
    }
    const output = cfg.output as Record<string, unknown>;
    if (output.dir !== undefined && typeof output.dir !== 'string') {
      return false;
    }
  }
  
  return true;
}

/**
 * Merge partial config with defaults
 */
function mergeWithDefaults(partial: Partial<ISLConfig>): ISLConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    output: {
      ...DEFAULT_CONFIG.output,
      ...partial.output,
    },
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...partial.ai,
    },
    verify: {
      ...DEFAULT_CONFIG.verify,
      ...partial.verify,
    },
  };
}

/**
 * Parse config file content based on file extension
 */
function parseConfigContent(content: string, configPath: string): unknown {
  const isJson = configPath.endsWith('.json');
  
  if (isJson) {
    return JSON.parse(content);
  }
  
  return parseYaml(content);
}

/**
 * Load config from a specific file path
 */
export async function loadConfigFromFile(configPath: string): Promise<ConfigSearchResult> {
  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = parseConfigContent(content, configPath);
    
    if (!validateConfig(parsed)) {
      return {
        config: null,
        configPath,
        error: 'Invalid configuration format',
      };
    }
    
    const merged = mergeWithDefaults(parsed);
    const expanded = expandConfigEnvVars(merged);
    
    return {
      config: expanded,
      configPath,
    };
  } catch (err) {
    return {
      config: null,
      configPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Load config by searching from the current directory
 */
export async function loadConfig(startDir?: string): Promise<ConfigSearchResult> {
  const searchDir = startDir ?? process.cwd();
  const configPath = await searchConfigFile(searchDir);
  
  if (!configPath) {
    // Return default config if no config file found
    return {
      config: DEFAULT_CONFIG,
      configPath: null,
    };
  }
  
  return loadConfigFromFile(configPath);
}

/**
 * Get the default configuration
 */
export function getDefaultConfig(): ISLConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Create a config file template
 */
export function createConfigTemplate(options?: Partial<ISLConfig>): string {
  const config = {
    version: '1.0',
    name: options?.name ?? 'my-isl-project',
    include: options?.include ?? ['**/*.isl'],
    exclude: options?.exclude ?? ['node_modules/**', 'dist/**'],
    output: {
      dir: options?.output?.dir ?? './generated',
      types: options?.output?.types ?? true,
      tests: options?.output?.tests ?? true,
      docs: options?.output?.docs ?? false,
    },
    ai: {
      model: options?.ai?.model ?? 'claude-sonnet-4-20250514',
      apiKey: '${ANTHROPIC_API_KEY}',
    },
    verify: {
      timeout: options?.verify?.timeout ?? 30000,
      minTrustScore: options?.verify?.minTrustScore ?? 70,
    },
  };

  return `# ISL Configuration
# Documentation: https://intentos.dev/docs/config

${Object.entries(config).map(([key, value]) => {
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n');
    return `${key}:\n${entries}`;
  }
  if (Array.isArray(value)) {
    return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
  }
  return `${key}: ${value}`;
}).join('\n\n')}
`;
}

/**
 * Create a JSON config file template
 */
export function createJsonConfigTemplate(options?: Partial<ISLConfig>): string {
  const config = {
    defaultTarget: 'typescript',
    strictMode: true,
    outputDir: options?.output?.dir ?? './generated',
    include: options?.include ?? ['specs/**/*.isl'],
    exclude: options?.exclude ?? ['specs/drafts/**'],
    output: {
      types: options?.output?.types ?? true,
      tests: options?.output?.tests ?? true,
      docs: options?.output?.docs ?? false,
    },
    ai: {
      model: options?.ai?.model ?? 'claude-sonnet-4-20250514',
    },
    verify: {
      timeout: options?.verify?.timeout ?? 30000,
      minTrustScore: options?.verify?.minTrustScore ?? 70,
    },
  };

  return JSON.stringify(config, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export {
  CONFIG_FILES,
  DEFAULT_CONFIG,
};
