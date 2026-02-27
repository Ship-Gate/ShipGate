/**
 * Gate configuration loader
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { info, warning } from '@actions/core';
import { GateConfig } from './types.js';

/**
 * Default gate configuration
 */
export const DEFAULT_GATE_CONFIG: GateConfig = {
  thresholds: {
    minScore: 80,
    minTestPassRate: 100,
    minCoverage: 70,
    maxCriticalFindings: 0,
    maxHighFindings: 0,
  },
  include: ['**/*.{ts,tsx,js,jsx,isl}'],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/coverage/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.turbo/**',
  ],
  checks: {
    parser: true,
    typechecker: true,
    verifier: true,
    security: true,
    hallucination: true,
    firewall: true,
  },
};

/**
 * Load gate configuration from file
 */
export function loadGateConfig(configPath: string, projectRoot: string): GateConfig {
  const fullPath = resolve(projectRoot, configPath);
  
  if (!existsSync(fullPath)) {
    warning(`Config file not found at ${fullPath}. Using defaults.`);
    return DEFAULT_GATE_CONFIG;
  }

  try {
    const configContent = readFileSync(fullPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // Merge with defaults
    const mergedConfig: GateConfig = {
      thresholds: {
        ...DEFAULT_GATE_CONFIG.thresholds,
        ...config.thresholds,
      },
      include: config.include || DEFAULT_GATE_CONFIG.include,
      exclude: config.exclude || DEFAULT_GATE_CONFIG.exclude,
      checks: {
        ...DEFAULT_GATE_CONFIG.checks,
        ...config.checks,
      },
    };

    info(`Loaded gate configuration from ${fullPath}`);
    return mergedConfig;
  } catch (error) {
    warning(`Failed to load config from ${fullPath}: ${error}. Using defaults.`);
    return DEFAULT_GATE_CONFIG;
  }
}

/**
 * Validate gate configuration
 */
export function validateGateConfig(config: GateConfig): void {
  if (config.thresholds.minScore < 0 || config.thresholds.minScore > 100) {
    throw new Error('minScore must be between 0 and 100');
  }
  
  if (config.thresholds.minTestPassRate < 0 || config.thresholds.minTestPassRate > 100) {
    throw new Error('minTestPassRate must be between 0 and 100');
  }
  
  if (config.thresholds.minCoverage < 0 || config.thresholds.minCoverage > 100) {
    throw new Error('minCoverage must be between 0 and 100');
  }
  
  if (config.thresholds.maxCriticalFindings < 0) {
    throw new Error('maxCriticalFindings must be non-negative');
  }
  
  if (config.thresholds.maxHighFindings < 0) {
    throw new Error('maxHighFindings must be non-negative');
  }

  info('Gate configuration validated successfully');
}
