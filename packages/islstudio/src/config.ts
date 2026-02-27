/**
 * ISL Studio - Configuration Loader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GateConfig } from './gate.js';

// ============================================================================
// Presets
// ============================================================================

const PRESETS: Record<string, GateConfig> = {
  'strict-security': {
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
    },
    threshold: 80,
  },
  'startup-default': {
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: false },
      'rate-limit': { enabled: true },
    },
    threshold: 70,
  },
  'payments-heavy': {
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
    },
    threshold: 75,
  },
  'privacy-heavy': {
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: false },
      'rate-limit': { enabled: false },
    },
    threshold: 80,
  },
  'agent-mode': {
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
    },
    threshold: 85,
  },
};

// ============================================================================
// Config Loader
// ============================================================================

export async function loadConfig(cwd: string): Promise<GateConfig> {
  // Try to load .islstudio/config.json
  const configPath = path.join(cwd, '.islstudio', 'config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // Apply preset if specified
    let baseConfig: GateConfig = {};
    if (userConfig.preset && PRESETS[userConfig.preset]) {
      baseConfig = { ...PRESETS[userConfig.preset] };
    }
    
    // Merge with user config
    return {
      ...baseConfig,
      ...userConfig,
      packs: {
        ...baseConfig.packs,
        ...userConfig.packs,
      },
    };
  } catch {
    // No config file, use default
    return PRESETS['startup-default'];
  }
}

export { PRESETS };
