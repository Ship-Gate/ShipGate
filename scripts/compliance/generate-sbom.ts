#!/usr/bin/env tsx
/**
 * Generate Software Bill of Materials (SBOM)
 * 
 * Generates a CycloneDX format SBOM containing all dependencies
 * and their metadata for security scanning and compliance.
 * 
 * Output: sbom.json (CycloneDX format)
 * 
 * Usage:
 *   tsx scripts/compliance/generate-sbom.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

interface Component {
  type: 'library' | 'application';
  'bom-ref': string;
  name: string;
  version: string;
  purl?: string;
  licenses?: Array<{ license: { id?: string; name?: string } }>;
  externalReferences?: Array<{
    type: string;
    url: string;
  }>;
  hashes?: Array<{
    alg: string;
    content: string;
  }>;
}

interface CycloneDXBOM {
  bomFormat: 'CycloneDX';
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools?: Array<{
      vendor: string;
      name: string;
      version: string;
    }>;
    component?: {
      type: 'application';
      name: string;
      version: string;
    };
  };
  components: Component[];
}

function getPackageInfo(): { name: string; version: string } {
  const packageJsonPath = join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return {
    name: pkg.name || 'isl-lang-monorepo',
    version: pkg.version || '0.0.0',
  };
}

function getDependencies(): Map<string, { version: string; license?: string; homepage?: string; repository?: string }> {
  const dependencies = new Map<string, { version: string; license?: string; homepage?: string; repository?: string }>();

  // Read root package.json
  const rootPackageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));
  
  // Collect all dependencies from root and workspace packages
  const allDeps: Record<string, string> = {
    ...rootPackageJson.dependencies,
    ...rootPackageJson.devDependencies,
  };

  // Use pnpm list to get actual installed versions
  try {
    const pnpmListOutput = execSync('pnpm list --depth=0 --json', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    const listData = JSON.parse(pnpmListOutput);
    
    function processDependencies(deps: Record<string, unknown>, parentPath: string[] = []): void {
      if (!deps) return;
      
      for (const [name, info] of Object.entries(deps)) {
        if (typeof info === 'object' && info !== null && 'version' in info) {
          const depInfo = info as { version: string };
          
          // Skip workspace packages
          if (!name.startsWith('@isl-lang/') && !name.startsWith('shipgate')) {
            if (!dependencies.has(name)) {
              dependencies.set(name, { version: depInfo.version });
              
              // Try to enrich with package.json info
              try {
                const nodeModulesPath = join(ROOT_DIR, 'node_modules', name, 'package.json');
                if (existsSync(nodeModulesPath)) {
                  const pkgJson = JSON.parse(readFileSync(nodeModulesPath, 'utf-8'));
                  dependencies.set(name, {
                    version: depInfo.version,
                    license: pkgJson.license || pkgJson.licenses?.[0]?.type,
                    homepage: pkgJson.homepage,
                    repository: typeof pkgJson.repository === 'string'
                      ? pkgJson.repository
                      : pkgJson.repository?.url,
                  });
                }
              } catch (error) {
                // Ignore
              }
            }
          }
          
          // Process nested dependencies
          if ('dependencies' in info && typeof info.dependencies === 'object') {
            processDependencies(info.dependencies as Record<string, unknown>, [...parentPath, name]);
          }
        }
      }
    }

    if (listData.dependencies) {
      processDependencies(listData.dependencies);
    }
  } catch (error) {
    console.warn('Could not get full dependency tree, using package.json only');
    
    // Fallback to package.json
    for (const [name, version] of Object.entries(allDeps)) {
      if (typeof version === 'string' && !name.startsWith('@isl-lang/')) {
        dependencies.set(name, { version: version.replace(/[\^~]/, '') });
      }
    }
  }

  return dependencies;
}

function generatePURL(name: string, version: string): string {
  // Generate Package URL (purl) for npm packages
  // Format: pkg:npm/package-name@version
  const encodedName = encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${version}`;
}

function generateComponentHash(name: string, version: string): string {
  // Generate a simple hash for component identification
  const content = `${name}@${version}`;
  return createHash('sha256').update(content).digest('hex');
}

function generateSBOM(): CycloneDXBOM {
  const pkgInfo = getPackageInfo();
  const dependencies = getDependencies();
  const components: Component[] = [];

  console.log(`📦 Processing ${dependencies.size} dependencies...`);

  for (const [name, info] of dependencies.entries()) {
    const component: Component = {
      type: 'library',
      'bom-ref': generateComponentHash(name, info.version),
      name,
      version: info.version,
      purl: generatePURL(name, info.version),
    };

    if (info.license) {
      component.licenses = [{
        license: {
          id: info.license,
          name: info.license,
        },
      }];
    }

    const externalRefs: Component['externalReferences'] = [];
    
    if (info.homepage) {
      externalRefs.push({
        type: 'website',
        url: info.homepage,
      });
    }

    if (info.repository) {
      externalRefs.push({
        type: 'vcs',
        url: info.repository,
      });
    }

    if (externalRefs.length > 0) {
      component.externalReferences = externalRefs;
    }

    components.push(component);
  }

  // Sort components by name
  components.sort((a, b) => a.name.localeCompare(b.name));

  const bom: CycloneDXBOM = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{
        vendor: 'ISL Lang',
        name: 'sbom-generator',
        version: '1.0.0',
      }],
      component: {
        type: 'application',
        name: pkgInfo.name,
        version: pkgInfo.version,
      },
    },
    components,
  };

  return bom;
}

function main(): void {
  console.log('📋 Generating Software Bill of Materials (SBOM)...\n');

  try {
    const bom = generateSBOM();
    const outputPath = join(ROOT_DIR, 'sbom.json');
    
    writeFileSync(outputPath, JSON.stringify(bom, null, 2), 'utf-8');
    
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   Format: CycloneDX ${bom.specVersion}`);
    console.log(`   Components: ${bom.components.length}`);
    console.log(`   Size: ${(JSON.stringify(bom).length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Failed to generate SBOM:', error);
    process.exit(1);
  }
}

// Run if executed directly (cross-platform: Windows path vs file:// URL)
const isMain = process.argv[1] && (import.meta.url === pathToFileURL(process.argv[1]).href || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));
if (isMain) {
  main();
}
