#!/usr/bin/env tsx
/**
 * Generate THIRD_PARTY_NOTICES
 * 
 * Generates a comprehensive third-party attribution file listing all
 * dependencies with their licenses and copyright information.
 * 
 * Output: THIRD_PARTY_NOTICES.txt
 * 
 * Usage:
 *   tsx scripts/compliance/generate-third-party-notices.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

interface DependencyInfo {
  name: string;
  version: string;
  license?: string;
  licenseText?: string;
  author?: string;
  homepage?: string;
  repository?: string;
}

function getDependenciesFromLockfile(): Map<string, DependencyInfo> {
  const dependencies = new Map<string, DependencyInfo>();

  // Use pnpm list to get all dependencies
  try {
    const pnpmListOutput = execSync('pnpm list --depth=Infinity --json', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large dependency trees
    });

    // Parse pnpm list output
    const listData = JSON.parse(pnpmListOutput);
    
    function processDependencies(deps: Record<string, unknown>, seen: Set<string> = new Set()): void {
      if (!deps || typeof deps !== 'object') return;
      
      for (const [name, info] of Object.entries(deps)) {
        // Skip workspace packages
        if (name.startsWith('@isl-lang/') || name === 'shipgate' || name.startsWith('isl-lang-monorepo')) {
          continue;
        }
        
        // Avoid duplicates
        if (seen.has(name)) continue;
        seen.add(name);
        
        if (typeof info === 'object' && info !== null && 'version' in info) {
          const depInfo = info as { version: string };
          dependencies.set(name, {
            name,
            version: depInfo.version,
          });
          
          // Process nested dependencies
          if ('dependencies' in info && typeof info.dependencies === 'object') {
            processDependencies(info.dependencies as Record<string, unknown>, seen);
          }
        }
      }
    }

    if (listData.dependencies) {
      processDependencies(listData.dependencies);
    }
  } catch (error) {
    console.error('Failed to get dependency list from pnpm:', error);
    throw new Error('Could not get dependency list. Ensure pnpm is installed and dependencies are installed.');
  }

  return dependencies;
}

async function enrichDependencyInfo(dep: DependencyInfo): Promise<DependencyInfo> {
  try {
    // Try to read package.json from node_modules
    const nodeModulesPath = join(ROOT_DIR, 'node_modules', dep.name, 'package.json');
    if (existsSync(nodeModulesPath)) {
      const pkgJson = JSON.parse(readFileSync(nodeModulesPath, 'utf-8'));
      
      return {
        ...dep,
        license: pkgJson.license || pkgJson.licenses?.[0]?.type || 'Unknown',
        author: typeof pkgJson.author === 'string' 
          ? pkgJson.author 
          : pkgJson.author?.name || undefined,
        homepage: pkgJson.homepage,
        repository: typeof pkgJson.repository === 'string'
          ? pkgJson.repository
          : pkgJson.repository?.url || undefined,
      };
    }
  } catch (error) {
    // Ignore errors - we'll use what we have
  }

  return dep;
}

function getLicenseText(packageName: string, version: string): string | undefined {
  const licensePaths = [
    join(ROOT_DIR, 'node_modules', packageName, 'LICENSE'),
    join(ROOT_DIR, 'node_modules', packageName, 'LICENSE.txt'),
    join(ROOT_DIR, 'node_modules', packageName, 'LICENSE.md'),
    join(ROOT_DIR, 'node_modules', packageName, 'license'),
    join(ROOT_DIR, 'node_modules', packageName, 'license.txt'),
  ];

  for (const licensePath of licensePaths) {
    if (existsSync(licensePath)) {
      try {
        const licenseText = readFileSync(licensePath, 'utf-8');
        // Limit license text length to avoid huge files
        return licenseText.length > 10000 
          ? licenseText.substring(0, 10000) + '\n... (truncated)'
          : licenseText;
      } catch (error) {
        // Continue to next path
      }
    }
  }

  return undefined;
}

async function generateThirdPartyNotices(): Promise<string> {
  const dependencies = getDependenciesFromLockfile();
  const enrichedDeps: DependencyInfo[] = [];

  console.log(`📦 Processing ${dependencies.size} dependencies...`);

  // Enrich dependency information
  for (const [name, dep] of dependencies.entries()) {
    const enriched = await enrichDependencyInfo(dep);
    
    // Try to get license text
    const licenseText = getLicenseText(name, enriched.version);
    if (licenseText) {
      enriched.licenseText = licenseText;
    }

    enrichedDeps.push(enriched);
  }

  // Sort by name
  enrichedDeps.sort((a, b) => a.name.localeCompare(b.name));

  // Generate notice file
  let notice = `THIRD-PARTY SOFTWARE NOTICES AND INFORMATION

This file contains the licenses and copyright notices for third-party software
components used in this project.

Generated: ${new Date().toISOString()}
Total dependencies: ${enrichedDeps.length}

─────────────────────────────────────────────────────────────────────────────

`;

  for (const dep of enrichedDeps) {
    notice += `\n${'='.repeat(80)}\n`;
    notice += `${dep.name} (v${dep.version})\n`;
    notice += `${'='.repeat(80)}\n\n`;

    if (dep.license) {
      notice += `License: ${dep.license}\n`;
    }

    if (dep.author) {
      notice += `Author: ${dep.author}\n`;
    }

    if (dep.homepage) {
      notice += `Homepage: ${dep.homepage}\n`;
    }

    if (dep.repository) {
      notice += `Repository: ${dep.repository}\n`;
    }

    if (dep.licenseText) {
      notice += `\nLicense Text:\n${'-'.repeat(80)}\n${dep.licenseText}\n`;
    }

    notice += '\n';
  }

  notice += `\n${'='.repeat(80)}\n`;
  notice += `END OF THIRD-PARTY NOTICES\n`;
  notice += `${'='.repeat(80)}\n`;

  return notice;
}

async function main(): Promise<void> {
  console.log('📝 Generating THIRD_PARTY_NOTICES...\n');

  try {
    const noticeContent = await generateThirdPartyNotices();
    const outputPath = join(ROOT_DIR, 'THIRD_PARTY_NOTICES.txt');
    
    writeFileSync(outputPath, noticeContent, 'utf-8');
    
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   Size: ${(noticeContent.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Failed to generate third-party notices:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  main();
}
