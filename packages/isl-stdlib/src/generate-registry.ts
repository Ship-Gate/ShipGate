#!/usr/bin/env tsx
/**
 * Generate Canonical Stdlib Registry
 * 
 * This script generates the registry.json and registry-data.ts files
 * from the actual stdlib ISL files with computed content hashes.
 * 
 * Usage:
 *   pnpm run generate-registry
 * 
 * The script:
 * 1. Scans stdlib/ directory for ISL files
 * 2. Computes SHA-256 content hashes for each file
 * 3. Computes aggregate module hashes
 * 4. Generates registry.json with full metadata
 * 5. Updates registry-data.ts for build-time inclusion
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STDLIB_ROOT = path.resolve(__dirname, '../../../stdlib');
const REGISTRY_JSON_PATH = path.resolve(__dirname, '../registry.json');
const REGISTRY_DATA_PATH = path.resolve(__dirname, './registry-data.ts');

interface FileEntry {
  path: string;
  contentHash: string;
}

interface ModuleDefinition {
  name: string;
  version: string;
  description: string;
  category: string;
  status: 'implemented' | 'planned' | 'deprecated';
  entryPoint: string;
  exports: Record<string, string>;
  files: FileEntry[];
  moduleHash: string;
  provides: {
    entities: string[];
    behaviors: string[];
    enums: string[];
    types: string[];
  };
  dependencies: string[];
  peerDependencies: string[];
  keywords: string[];
}

/**
 * Calculate SHA-256 hash of file content
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate aggregate module hash from file hashes
 */
function computeModuleHash(files: FileEntry[]): string {
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const combined = sortedFiles.map(f => `${f.path}:${f.contentHash}`).join('\n');
  return computeHash(combined);
}

/**
 * Extract symbols from ISL file content
 */
function extractSymbols(content: string): {
  entities: string[];
  behaviors: string[];
  enums: string[];
  types: string[];
} {
  const entities: string[] = [];
  const behaviors: string[] = [];
  const enums: string[] = [];
  const types: string[] = [];

  // Extract entities: entity Name {
  const entityMatches = content.matchAll(/entity\s+(\w+)\s*\{/g);
  for (const match of entityMatches) {
    entities.push(match[1]);
  }

  // Extract behaviors: behavior Name {
  const behaviorMatches = content.matchAll(/behavior\s+(\w+)\s*\{/g);
  for (const match of behaviorMatches) {
    behaviors.push(match[1]);
  }

  // Extract enums: type Name = enum {
  const enumMatches = content.matchAll(/type\s+(\w+)\s*=\s*enum\s*\{/g);
  for (const match of enumMatches) {
    enums.push(match[1]);
  }

  // Extract types: type Name = ...
  const typeMatches = content.matchAll(/type\s+(\w+)\s*=\s*(?!enum)/g);
  for (const match of typeMatches) {
    types.push(match[1]);
  }

  return { entities, behaviors, enums, types };
}

/**
 * Module metadata definitions
 */
const MODULE_METADATA: Record<string, {
  name: string;
  description: string;
  category: string;
  dependencies: string[];
  peerDependencies: string[];
  keywords: string[];
}> = {
  'stdlib-auth': {
    name: '@isl-lang/stdlib-auth',
    description: 'Authentication and authorization (OAuth, sessions, rate limiting)',
    category: 'security',
    dependencies: [],
    peerDependencies: [],
    keywords: ['auth', 'authentication', 'oauth', 'session', 'login', 'security'],
  },
  'stdlib-payments': {
    name: '@isl-lang/stdlib-payments',
    description: 'PCI-compliant payment processing (payments, refunds, subscriptions, webhooks)',
    category: 'business',
    dependencies: [],
    peerDependencies: ['stdlib-auth'],
    keywords: ['payments', 'pci', 'stripe', 'subscriptions', 'billing', 'refunds'],
  },
  'stdlib-uploads': {
    name: '@isl-lang/stdlib-uploads',
    description: 'File upload, storage, and MIME validation',
    category: 'storage',
    dependencies: [],
    peerDependencies: [],
    keywords: ['files', 'uploads', 'storage', 's3', 'blobs', 'mime'],
  },
};

/**
 * Scan a module directory and build the module definition
 */
async function scanModule(moduleDir: string, moduleName: string): Promise<ModuleDefinition | null> {
  const metadata = MODULE_METADATA[moduleName];
  if (!metadata) {
    console.warn(`No metadata defined for module: ${moduleName}`);
    return null;
  }

  try {
    const dirPath = path.join(STDLIB_ROOT, moduleDir);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const islFiles = entries.filter(e => e.isFile() && e.name.endsWith('.isl'));

    if (islFiles.length === 0) {
      console.warn(`No ISL files found in ${moduleDir}`);
      return null;
    }

    const files: FileEntry[] = [];
    const allSymbols = {
      entities: [] as string[],
      behaviors: [] as string[],
      enums: [] as string[],
      types: [] as string[],
    };
    const exports: Record<string, string> = {};

    // First file becomes entry point
    let entryPoint = '';

    for (const file of islFiles) {
      const filePath = path.join(dirPath, file.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const contentHash = computeHash(content);
      const relativePath = `${moduleDir}/${file.name}`;

      files.push({ path: relativePath, contentHash });

      // Extract symbols
      const symbols = extractSymbols(content);
      allSymbols.entities.push(...symbols.entities);
      allSymbols.behaviors.push(...symbols.behaviors);
      allSymbols.enums.push(...symbols.enums);
      allSymbols.types.push(...symbols.types);

      // Build exports
      const exportName = file.name.replace('.isl', '');
      if (!entryPoint) {
        entryPoint = relativePath;
        exports['.'] = relativePath;
      }
      exports[`/${exportName}`] = relativePath;
    }

    const moduleHash = computeModuleHash(files);

    return {
      name: metadata.name,
      version: '1.0.0',
      description: metadata.description,
      category: metadata.category,
      status: 'implemented',
      entryPoint,
      exports,
      files,
      moduleHash,
      provides: {
        entities: [...new Set(allSymbols.entities)],
        behaviors: [...new Set(allSymbols.behaviors)],
        enums: [...new Set(allSymbols.enums)],
        types: [...new Set(allSymbols.types)],
      },
      dependencies: metadata.dependencies,
      peerDependencies: metadata.peerDependencies,
      keywords: metadata.keywords,
    };
  } catch (err) {
    console.error(`Error scanning module ${moduleDir}:`, err);
    return null;
  }
}

/**
 * Generate the full registry
 */
async function generateRegistry(): Promise<void> {
  console.log('Generating stdlib registry...\n');

  const modules: Record<string, ModuleDefinition> = {};
  const moduleMapping = {
    'auth': 'stdlib-auth',
    'payments': 'stdlib-payments',
    'uploads': 'stdlib-uploads',
  };

  for (const [dir, name] of Object.entries(moduleMapping)) {
    console.log(`Scanning ${dir}...`);
    const module = await scanModule(dir, name);
    if (module) {
      modules[name] = module;
      console.log(`  Found ${module.files.length} files`);
      console.log(`  Entities: ${module.provides.entities.join(', ') || 'none'}`);
      console.log(`  Behaviors: ${module.provides.behaviors.join(', ') || 'none'}`);
      console.log(`  Module hash: ${module.moduleHash.slice(0, 16)}...`);
    }
  }

  const registry = {
    $schema: './registry.schema.json',
    version: '1.0.0',
    description: 'ISL Standard Library Canonical Registry',
    generated: new Date().toISOString(),
    stdlibRoot: 'stdlib',
    modules,
    categories: {
      security: {
        name: 'Security',
        description: 'Authentication, authorization, and security patterns',
        modules: ['stdlib-auth'],
      },
      business: {
        name: 'Business Logic',
        description: 'Payments, billing, and SaaS patterns',
        modules: ['stdlib-payments'],
      },
      storage: {
        name: 'Storage',
        description: 'File storage and management',
        modules: ['stdlib-uploads'],
      },
    },
    importAliases: {
      '@isl/stdlib-auth': 'stdlib-auth',
      '@isl/auth': 'stdlib-auth',
      '@isl/stdlib-payments': 'stdlib-payments',
      '@isl/payments': 'stdlib-payments',
      '@isl/stdlib-uploads': 'stdlib-uploads',
      '@isl/uploads': 'stdlib-uploads',
    },
  };

  // Write registry.json
  await fs.writeFile(REGISTRY_JSON_PATH, JSON.stringify(registry, null, 2) + '\n');
  console.log(`\nWrote ${REGISTRY_JSON_PATH}`);

  // Generate registry-data.ts
  const registryDataContent = `/**
 * Registry Data
 * 
 * AUTO-GENERATED - DO NOT EDIT
 * Generated: ${registry.generated}
 * 
 * Run \`pnpm run generate-registry\` to regenerate.
 */

import type { StdlibRegistry } from './types.js';

export const REGISTRY_DATA: StdlibRegistry = ${JSON.stringify(registry, null, 2)};
`;

  await fs.writeFile(REGISTRY_DATA_PATH, registryDataContent);
  console.log(`Wrote ${REGISTRY_DATA_PATH}`);

  console.log('\nRegistry generation complete!');
  console.log(`Total modules: ${Object.keys(modules).length}`);
}

// Run if called directly
generateRegistry().catch(console.error);
