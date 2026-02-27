// ============================================================================
// Phantom Dependency Scanner - Core Logic
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  ScannerOptions,
  ScanResult,
  Finding,
  PackageJson,
} from './types.js';
import { FindingKind } from './types.js';
import { parseImports, isRelativeImport, isNodeBuiltin } from './parser.js';
import { detectWorkspace, isWorkspacePackage } from './workspace.js';
import { RegistryChecker } from './registry.js';
import { findTypoCandidates } from './typo-detector.js';

/**
 * Main scanner function
 */
export async function scanDependencies(options: ScannerOptions): Promise<ScanResult> {
  const {
    projectRoot,
    files,
    checkRegistry = false,
    registryTimeout = 5000,
    cacheDir = path.join(process.cwd(), '.phantom-scanner-cache'),
    maxRegistryChecks = 50,
    suggestTypos = true,
    readFile = defaultReadFile,
    fileExists = defaultFileExists,
  } = options;

  const findings: Finding[] = [];
  const errors: Error[] = [];
  let filesScanned = 0;
  let importsChecked = 0;

  // Detect workspace
  const workspaceInfo = await detectWorkspace(projectRoot);

  // Load package.json
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let packageJson: PackageJson = {};
  try {
    const content = await readFile(packageJsonPath);
    packageJson = JSON.parse(content) as PackageJson;
  } catch (error) {
    errors.push(new Error(`Failed to read package.json: ${error}`));
  }

  // Initialize registry checker if needed
  let registryChecker: RegistryChecker | null = null;
  if (checkRegistry) {
    registryChecker = new RegistryChecker({
      cacheDir,
      maxChecks: maxRegistryChecks,
      timeout: registryTimeout,
    });
    await registryChecker.loadCache();
  }

  // Collect all dependencies
  const allDependencies = new Set<string>();
  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach((dep) => allDependencies.add(dep));
  }
  if (packageJson.devDependencies) {
    Object.keys(packageJson.devDependencies).forEach((dep) => allDependencies.add(dep));
  }
  if (packageJson.peerDependencies) {
    Object.keys(packageJson.peerDependencies).forEach((dep) => allDependencies.add(dep));
  }
  if (packageJson.optionalDependencies) {
    Object.keys(packageJson.optionalDependencies).forEach((dep) => allDependencies.add(dep));
  }

  // Add workspace packages
  workspaceInfo.workspacePackages.forEach((pkg) => allDependencies.add(pkg));

  // Find files to scan
  const filesToScan = files ?? (await findSourceFiles(projectRoot));

  // Scan each file
  for (const file of filesToScan) {
    try {
      const content = await readFile(file);
      const imports = parseImports(content, file);

      for (const imp of imports) {
        importsChecked++;

        // Handle relative imports separately
        if (isRelativeImport(imp.specifier)) {
          const resolved = await resolveRelativeImport(
            imp.specifier,
            path.dirname(file),
            fileExists
          );

          if (!resolved) {
            findings.push({
              kind: FindingKind.UNRESOLVABLE_IMPORT,
              packageName: imp.specifier,
              file: imp.file,
              line: imp.line,
              column: imp.column,
              importStatement: imp.statement,
              confidence: 100, // Very high confidence - file doesn't exist
            });
          }
          continue;
        }

        // Skip Node.js built-ins
        if (isNodeBuiltin(imp.specifier)) {
          continue;
        }

        // Extract package name (handle scoped packages)
        const packageName = extractPackageName(imp.specifier);

        // Check if it's a workspace package
        if (isWorkspacePackage(packageName, workspaceInfo)) {
          continue; // Workspace packages are always valid
        }

        // Check if package is in dependencies
        if (!allDependencies.has(packageName)) {
          // Check registry if enabled
          let existsOnRegistry = false;
          if (checkRegistry && registryChecker) {
            try {
              existsOnRegistry = await registryChecker.packageExists(packageName);
            } catch (error) {
              // Registry check failed, continue without it
            }
          }

          // Generate suggestions
          const suggestions = suggestTypos
            ? findTypoCandidates(packageName, Array.from(allDependencies), 5, 0.6)
            : undefined;

          // Calculate confidence
          let confidence = 90; // High confidence for missing dependency
          if (existsOnRegistry) {
            confidence = 100; // Package exists but not installed
          } else if (checkRegistry && !existsOnRegistry) {
            confidence = 95; // Checked registry and it doesn't exist
          }

          const finding: Finding = {
            kind: FindingKind.MISSING_DEPENDENCY,
            packageName,
            file: imp.file,
            line: imp.line,
            column: imp.column,
            importStatement: imp.statement,
            confidence,
            details: {
              existsOnRegistry,
              isWorkspacePackage: false,
            },
          };
          if (suggestions) {
            finding.suggestions = suggestions;
          }
          findings.push(finding);
        }
      }

      filesScanned++;
    } catch (error) {
      errors.push(new Error(`Failed to scan ${file}: ${error}`));
    }
  }

  // Save registry cache
  if (registryChecker) {
    await registryChecker.saveCache();
  }

  return {
    findings,
    filesScanned,
    importsChecked,
    registryChecksPerformed: checkRegistry,
    registryChecksMade: registryChecker?.getCheckCount() ?? 0,
    errors,
  };
}

/**
 * Extract package name from import specifier
 */
function extractPackageName(specifier: string): string {
  // Handle scoped packages: @scope/name/subpath -> @scope/name
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return specifier;
  }

  // Regular package: name/subpath -> name
  const parts = specifier.split('/');
  return parts[0]!;
}

/**
 * Resolve relative import to file path
 */
async function resolveRelativeImport(
  specifier: string,
  baseDir: string,
  fileExists: (path: string) => Promise<boolean>
): Promise<string | null> {
  // Try different extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts', ''];

  for (const ext of extensions) {
    let resolvedPath = path.resolve(baseDir, specifier + ext);

    // Check if file exists
    if (await fileExists(resolvedPath)) {
      return resolvedPath;
    }

    // Try index file
    const indexPath = path.join(resolvedPath, `index${ext}`);
    if (await fileExists(indexPath)) {
      return indexPath;
    }
  }

  return null;
}

/**
 * Find all TypeScript/JavaScript source files
 */
async function findSourceFiles(
  projectRoot: string
): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip node_modules, dist, .git, etc.
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build'
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  await walkDir(projectRoot);
  return files;
}

/**
 * Default file reader
 */
async function defaultReadFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Default file existence checker
 */
async function defaultFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
