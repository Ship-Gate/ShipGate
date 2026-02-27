/**
 * ISL Evidence Bench Harness - Configuration
 * 
 * Defines configuration types and loaders for the bench harness.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface SampleConfig {
  /** Unique identifier for the sample */
  id: string;
  /** Human-readable name */
  name: string;
  /** Path to the sample directory (relative to samples/) */
  path: string;
  /** Path to the prompt JSON file */
  promptFile: string;
  /** Path to the context JSON file */
  contextFile: string;
  /** Expected ISL output file name */
  expectedIslFile?: string;
  /** Test commands to run for verification */
  testCommands: string[];
  /** Typecheck commands to run */
  typecheckCommands: string[];
  /** Whether this sample is enabled */
  enabled: boolean;
  /** Tags for filtering */
  tags: string[];
}

export interface BenchConfig {
  /** Root directory for the bench harness */
  rootDir: string;
  /** Samples directory */
  samplesDir: string;
  /** Output directory for reports */
  outputDir: string;
  /** List of sample configurations */
  samples: SampleConfig[];
  /** Timeout for each step in milliseconds */
  timeouts: {
    translate: number;
    generate: number;
    verify: number;
  };
  /** Whether to run in verbose mode */
  verbose: boolean;
  /** Whether to bail on first failure */
  bailOnFailure: boolean;
}

export interface PromptContext {
  /** The natural language prompt/intent */
  prompt: string;
  /** Additional context for translation */
  context: {
    /** Target domain (e.g., "auth", "payments", "crud") */
    domain?: string;
    /** Existing types to reference */
    existingTypes?: Record<string, unknown>;
    /** Constraints or requirements */
    constraints?: string[];
    /** Example inputs/outputs */
    examples?: Array<{
      input: unknown;
      expectedOutput: unknown;
    }>;
  };
  /** Metadata about the prompt */
  metadata: {
    version: string;
    createdAt: string;
    author?: string;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG: Omit<BenchConfig, 'rootDir' | 'samplesDir' | 'outputDir'> = {
  samples: [],
  timeouts: {
    translate: 60_000,  // 1 minute
    generate: 120_000,  // 2 minutes
    verify: 180_000,    // 3 minutes
  },
  verbose: false,
  bailOnFailure: false,
};

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Resolves the bench root directory
 */
export function resolveBenchRoot(customRoot?: string): string {
  if (customRoot) {
    return resolve(customRoot);
  }
  // Default to the directory containing this file
  return resolve(import.meta.dirname ?? __dirname, '..');
}

/**
 * Loads the bench configuration from a JSON file or returns defaults
 */
export function loadConfig(configPath?: string): BenchConfig {
  const rootDir = resolveBenchRoot();
  const samplesDir = join(rootDir, 'isl-evidence', 'samples');
  const outputDir = join(rootDir, 'isl-evidence', 'output');

  const baseConfig: BenchConfig = {
    ...DEFAULT_CONFIG,
    rootDir,
    samplesDir,
    outputDir,
    samples: [],
  };

  // Try to load custom config if provided
  if (configPath && existsSync(configPath)) {
    try {
      const customConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      return {
        ...baseConfig,
        ...customConfig,
        timeouts: {
          ...baseConfig.timeouts,
          ...customConfig.timeouts,
        },
      };
    } catch (error) {
      console.error(`Failed to load config from ${configPath}:`, error);
    }
  }

  // Try to auto-discover samples
  const discoveredSamples = discoverSamples(samplesDir);
  baseConfig.samples = discoveredSamples;

  return baseConfig;
}

/**
 * Auto-discovers samples in the samples directory
 */
export function discoverSamples(samplesDir: string): SampleConfig[] {
  if (!existsSync(samplesDir)) {
    return [];
  }

  const samples: SampleConfig[] = [];
  
  // Look for sample.json files in subdirectories
  try {
    const { readdirSync, statSync } = require('node:fs');
    const entries = readdirSync(samplesDir);
    
    for (const entry of entries) {
      const entryPath = join(samplesDir, entry);
      const stat = statSync(entryPath);
      
      if (stat.isDirectory()) {
        const sampleConfigPath = join(entryPath, 'sample.json');
        if (existsSync(sampleConfigPath)) {
          try {
            const sampleConfig = JSON.parse(readFileSync(sampleConfigPath, 'utf-8'));
            samples.push({
              id: entry,
              name: sampleConfig.name ?? entry,
              path: entry,
              promptFile: sampleConfig.promptFile ?? 'prompt.json',
              contextFile: sampleConfig.contextFile ?? 'context.json',
              expectedIslFile: sampleConfig.expectedIslFile,
              testCommands: sampleConfig.testCommands ?? ['pnpm test'],
              typecheckCommands: sampleConfig.typecheckCommands ?? ['pnpm typecheck'],
              enabled: sampleConfig.enabled ?? true,
              tags: sampleConfig.tags ?? [],
            });
          } catch {
            // Skip invalid sample configs
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return samples;
}

/**
 * Loads a prompt and context from JSON files
 */
export function loadPromptContext(sampleDir: string, config: SampleConfig): PromptContext {
  const promptPath = join(sampleDir, config.promptFile);
  const contextPath = join(sampleDir, config.contextFile);

  let prompt = '';
  let context: PromptContext['context'] = {};
  let metadata: PromptContext['metadata'] = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
  };

  if (existsSync(promptPath)) {
    const promptData = JSON.parse(readFileSync(promptPath, 'utf-8'));
    prompt = promptData.prompt ?? promptData.intent ?? '';
    metadata = { ...metadata, ...promptData.metadata };
  }

  if (existsSync(contextPath)) {
    context = JSON.parse(readFileSync(contextPath, 'utf-8'));
  }

  return { prompt, context, metadata };
}

/**
 * Validates a sample configuration
 */
export function validateSampleConfig(config: SampleConfig): string[] {
  const errors: string[] = [];

  if (!config.id) {
    errors.push('Sample must have an id');
  }
  if (!config.path) {
    errors.push('Sample must have a path');
  }
  if (!config.testCommands || config.testCommands.length === 0) {
    errors.push('Sample must have at least one test command');
  }

  return errors;
}
