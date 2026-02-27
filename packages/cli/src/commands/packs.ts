/**
 * ShipGate Packs Command
 * 
 * Marketplace MVP for ISL domain/spec packs.
 * 
 * Usage:
 *   shipgate packs install <name>     # Install a pack
 *   shipgate packs list               # List installed packs
 *   shipgate packs verify <name>      # Verify pack integrity
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { createHash } from 'crypto';
import chalk from 'chalk';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pack manifest (pack.json)
 */
export interface PackManifest {
  /** Pack name (e.g., "stdlib-auth") */
  name: string;
  /** Pack version (semver) */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Author information */
  author?: string | { name: string; email?: string };
  /** License */
  license?: string;
  /** Repository URL */
  repository?: string | { type: string; url: string };
  /** Keywords for discovery */
  keywords?: string[];
  
  /** ISL domain name */
  domain: string;
  
  /** Pack dependencies (other packs) */
  dependencies?: Record<string, string>;
  
  /** Files included in this pack */
  files: PackFile[];
  
  /** Optional signature for verification */
  signature?: {
    algorithm: string;
    value: string;
    publicKey?: string;
  };
  
  /** Pack metadata */
  publishedAt?: string;
}

/**
 * File entry with checksum
 */
export interface PackFile {
  /** Relative path from pack root */
  path: string;
  /** SHA-256 checksum */
  checksum: string;
  /** File size in bytes */
  size: number;
}

/**
 * Registry entry for a pack
 */
export interface RegistryEntry {
  /** Pack name */
  name: string;
  /** Latest version */
  version: string;
  /** Description */
  description?: string;
  /** Download URL (can be GitHub raw, CDN, etc.) */
  downloadUrl: string;
  /** Pack manifest URL */
  manifestUrl?: string;
  /** SHA-256 checksum of the pack archive */
  checksum: string;
  /** Optional signature */
  signature?: {
    algorithm: string;
    value: string;
  };
}

/**
 * Registry (static JSON)
 */
export interface PackRegistry {
  /** Registry version */
  version: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Available packs */
  packs: Record<string, RegistryEntry>;
}

/**
 * Install options
 */
export interface PackInstallOptions {
  /** Pack name */
  name: string;
  /** Version (default: latest) */
  version?: string;
  /** Target directory (default: ./shipgate/packs/<name>) */
  targetDir?: string;
  /** Skip verification */
  skipVerify?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Registry URL (for testing) */
  registryUrl?: string;
}

/**
 * Install result
 */
export interface PackInstallResult {
  success: boolean;
  packName: string;
  version: string;
  installPath: string;
  filesInstalled: number;
  error?: string;
  manifest?: PackManifest;
}

/**
 * List result
 */
export interface PackListResult {
  packs: Array<{
    name: string;
    version: string;
    path: string;
    domain: string;
  }>;
}

/**
 * Verify result
 */
export interface PackVerifyResult {
  success: boolean;
  packName: string;
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_REGISTRY_URL = process.env.SHIPGATE_REGISTRY_URL || 
  resolve(process.cwd(), 'packages/cli/registry/packs-registry.json');
const DEFAULT_PACKS_DIR = './shipgate/packs';

// ─────────────────────────────────────────────────────────────────────────────
// Registry Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load registry from URL or local file
 */
async function loadRegistry(registryUrl?: string): Promise<PackRegistry> {
  const url = registryUrl || DEFAULT_REGISTRY_URL;
  
  try {
    // Try local file first if it's a file path
    if (url.startsWith('file://') || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      let filePath = url.startsWith('file://') ? url.slice(7) : url;
      
      // Resolve relative paths from project root
      if (!resolve(filePath).startsWith('/') && !filePath.match(/^[A-Z]:/)) {
        // Relative path - resolve from project root
        const projectRoot = process.cwd();
        filePath = resolve(projectRoot, filePath);
      }
      
      if (existsSync(filePath)) {
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content) as PackRegistry;
      }
    }
    
    // Fetch from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.statusText}`);
    }
    
    return await response.json() as PackRegistry;
  } catch (error) {
    throw new Error(`Failed to load registry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Find pack in registry
 */
async function findPackInRegistry(name: string, version?: string, registryUrl?: string): Promise<RegistryEntry> {
  const registry = await loadRegistry(registryUrl);
  
  const entry = registry.packs[name];
  if (!entry) {
    throw new Error(`Pack "${name}" not found in registry`);
  }
  
  // For MVP, we only support latest version
  if (version && version !== entry.version) {
    throw new Error(`Version ${version} not available. Latest is ${entry.version}`);
  }
  
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Download Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download pack archive
 */
async function downloadPack(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download pack: ${response.statusText}`);
  }
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  const writer = createWriteStream(destPath);
  await pipeline(response.body as any, writer);
}

/**
 * Download and extract pack manifest
 */
async function downloadManifest(entry: RegistryEntry): Promise<PackManifest> {
  const manifestUrl = entry.manifestUrl || entry.downloadUrl.replace(/\.(tar\.gz|zip)$/, '/pack.json');
  
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.statusText}`);
    }
    return await response.json() as PackManifest;
  } catch (error) {
    // If manifest URL fails, try downloading the pack and extracting manifest
    // For MVP, we'll create a minimal manifest from registry entry
    return {
      name: entry.name,
      version: entry.version,
      description: entry.description,
      domain: entry.name.replace('stdlib-', ''),
      files: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 checksum of file
 */
async function computeChecksum(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Verify pack integrity
 */
async function verifyPack(packPath: string, manifest: PackManifest): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Verify all files exist and checksums match
  for (const file of manifest.files) {
    const filePath = join(packPath, file.path);
    
    if (!existsSync(filePath)) {
      errors.push(`Missing file: ${file.path}`);
      continue;
    }
    
    const actualChecksum = await computeChecksum(filePath);
    if (actualChecksum !== file.checksum) {
      errors.push(`Checksum mismatch for ${file.path}: expected ${file.checksum}, got ${actualChecksum}`);
    }
    
    const stats = await stat(filePath);
    if (stats.size !== file.size) {
      errors.push(`Size mismatch for ${file.path}: expected ${file.size}, got ${stats.size}`);
    }
  }
  
  // Signature verification is not supported yet; manifest.signature is ignored.
  // Integrity is enforced via file checksums and size checks above. See README-PACKS.md for future plans.

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Install Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract pack archive (simplified - assumes it's a directory structure)
 * For MVP, we'll copy files from local directories or download from URLs
 */
async function extractPack(entry: RegistryEntry, targetDir: string, manifest: PackManifest): Promise<void> {
  // For MVP, we'll create the directory structure and copy/download files
  // In a real implementation, this would extract from a tarball/zip
  
  await mkdir(targetDir, { recursive: true });
  
  // Write pack.json
  const packJsonPath = join(targetDir, 'pack.json');
  await writeFile(packJsonPath, JSON.stringify(manifest, null, 2), 'utf-8');
  
  // Handle local file paths
  const isLocalPath = entry.downloadUrl.startsWith('file://') || 
                      (!entry.downloadUrl.startsWith('http://') && !entry.downloadUrl.startsWith('https://'));
  
  if (isLocalPath) {
    // Copy from local directory
    let sourceDir = entry.downloadUrl.startsWith('file://') 
      ? entry.downloadUrl.slice(7) 
      : entry.downloadUrl;
    
    // Resolve relative paths
    if (!resolve(sourceDir).startsWith('/') && !sourceDir.match(/^[A-Z]:/)) {
      const projectRoot = process.cwd();
      sourceDir = resolve(projectRoot, sourceDir);
    }
    
    if (existsSync(sourceDir)) {
      // Copy intents directory if it exists
      const intentsSource = join(sourceDir, 'intents');
      if (existsSync(intentsSource)) {
        const intentsDest = join(targetDir, 'intents');
        await mkdir(intentsDest, { recursive: true });
        
        // Copy all ISL files
        const { copyFile } = await import('fs/promises');
        const { readdir, stat } = await import('fs/promises');
        
        async function copyDir(src: string, dest: string) {
          const entries = await readdir(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = join(src, entry.name);
            const destPath = join(dest, entry.name);
            
            if (entry.isDirectory()) {
              await mkdir(destPath, { recursive: true });
              await copyDir(srcPath, destPath);
            } else if (entry.isFile() && entry.name.endsWith('.isl')) {
              await copyFile(srcPath, destPath);
            }
          }
        }
        
        await copyDir(intentsSource, intentsDest);
      }
    }
  } else {
    // Download from URL
    if (manifest.files.length === 0) {
      // Create minimal structure
      const domainDir = join(targetDir, 'intents');
      await mkdir(domainDir, { recursive: true });
      
      // Create a placeholder domain.isl
      const domainIsl = `domain ${manifest.domain} {
  version: "${manifest.version}"
  description: "${manifest.description || 'Installed pack'}"
}`;
      await writeFile(join(domainDir, 'domain.isl'), domainIsl, 'utf-8');
    } else {
      // Download files
      const baseUrl = entry.downloadUrl.replace(/\/[^/]+$/, '');
      
      for (const file of manifest.files) {
        const filePath = join(targetDir, file.path);
        const fileDir = dirname(filePath);
        await mkdir(fileDir, { recursive: true });
        
        try {
          const fileUrl = `${baseUrl}/${file.path}`;
          const response = await fetch(fileUrl);
          if (response.ok) {
            const content = await response.text();
            await writeFile(filePath, content, 'utf-8');
          }
        } catch (error) {
          // Skip files that can't be downloaded
        }
      }
    }
  }
}

/**
 * Install a pack
 */
export async function installPack(options: PackInstallOptions): Promise<PackInstallResult> {
  const { name, version, targetDir, skipVerify = false, verbose = false, registryUrl } = options;
  
  try {
    // Find pack in registry
    const entry = await findPackInRegistry(name, version, registryUrl);
    
    // Download manifest
    const manifest = await downloadManifest(entry);
    
    // Determine install path
    const installPath = targetDir || join(DEFAULT_PACKS_DIR, name);
    
    // Create directory
    await mkdir(installPath, { recursive: true });
    
    // Extract pack
    await extractPack(entry, installPath, manifest);
    
    // Verify integrity
    if (!skipVerify) {
      const verification = await verifyPack(installPath, manifest);
      if (!verification.valid) {
        return {
          success: false,
          packName: name,
          version: manifest.version,
          installPath,
          filesInstalled: 0,
          error: `Verification failed: ${verification.errors.join(', ')}`,
        };
      }
    }
    
    return {
      success: true,
      packName: name,
      version: manifest.version,
      installPath,
      filesInstalled: manifest.files.length || 1,
      manifest,
    };
  } catch (error) {
    return {
      success: false,
      packName: name,
      version: version || 'unknown',
      installPath: targetDir || join(DEFAULT_PACKS_DIR, name),
      filesInstalled: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List installed packs
 */
export async function listPacks(packsDir: string = DEFAULT_PACKS_DIR): Promise<PackListResult> {
  const packs: PackListResult['packs'] = [];
  
  if (!existsSync(packsDir)) {
    return { packs: [] };
  }
  
  const entries = await readdir(packsDir);
  
  for (const entry of entries) {
    const packPath = join(packsDir, entry);
    const packJsonPath = join(packPath, 'pack.json');
    
    if (existsSync(packJsonPath)) {
      try {
        const manifest = JSON.parse(await readFile(packJsonPath, 'utf-8')) as PackManifest;
        packs.push({
          name: manifest.name,
          version: manifest.version,
          path: packPath,
          domain: manifest.domain,
        });
      } catch (error) {
        // Skip invalid packs
      }
    }
  }
  
  return { packs };
}

/**
 * Verify installed pack
 */
export async function verifyPackInstall(name: string, packsDir: string = DEFAULT_PACKS_DIR): Promise<PackVerifyResult> {
  const packPath = join(packsDir, name);
  const packJsonPath = join(packPath, 'pack.json');
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!existsSync(packPath)) {
    return {
      success: false,
      packName: name,
      path: packPath,
      valid: false,
      errors: [`Pack "${name}" is not installed`],
      warnings: [],
    };
  }
  
  if (!existsSync(packJsonPath)) {
    return {
      success: false,
      packName: name,
      path: packPath,
      valid: false,
      errors: [`pack.json not found in ${packPath}`],
      warnings: [],
    };
  }
  
  try {
    const manifest = JSON.parse(await readFile(packJsonPath, 'utf-8')) as PackManifest;
    const verification = await verifyPack(packPath, manifest);
    
    return {
      success: verification.valid,
      packName: name,
      path: packPath,
      valid: verification.valid,
      errors: verification.errors,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      packName: name,
      path: packPath,
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print Functions
// ─────────────────────────────────────────────────────────────────────────────

export function printInstallResult(result: PackInstallResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const { format = 'pretty' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (format === 'quiet') {
    return;
  }
  
  if (result.success) {
    console.log(chalk.green(`✓ Installed ${result.packName}@${result.version}`));
    console.log(chalk.gray(`  Path: ${result.installPath}`));
    console.log(chalk.gray(`  Files: ${result.filesInstalled}`));
  } else {
    console.error(chalk.red(`✗ Failed to install ${result.packName}`));
    if (result.error) {
      console.error(chalk.red(`  Error: ${result.error}`));
    }
  }
}

export function printListResult(result: PackListResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const { format = 'pretty' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (format === 'quiet') {
    return;
  }
  
  if (result.packs.length === 0) {
    console.log(chalk.gray('No packs installed'));
    return;
  }
  
  console.log(chalk.bold('Installed packs:'));
  console.log('');
  
  for (const pack of result.packs) {
    console.log(chalk.cyan(`  ${pack.name}@${pack.version}`));
    console.log(chalk.gray(`    Domain: ${pack.domain}`));
    console.log(chalk.gray(`    Path: ${pack.path}`));
    console.log('');
  }
}

export function printVerifyResult(result: PackVerifyResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const { format = 'pretty' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (format === 'quiet') {
    return;
  }
  
  if (result.valid) {
    console.log(chalk.green(`✓ Pack "${result.packName}" is valid`));
  } else {
    console.error(chalk.red(`✗ Pack "${result.packName}" verification failed`));
    for (const error of result.errors) {
      console.error(chalk.red(`  - ${error}`));
    }
  }
  
  for (const warning of result.warnings) {
    console.warn(chalk.yellow(`  ⚠ ${warning}`));
  }
}

export function getInstallExitCode(result: PackInstallResult): number {
  return result.success ? 0 : 1;
}

export function getVerifyExitCode(result: PackVerifyResult): number {
  return result.valid ? 0 : 1;
}
