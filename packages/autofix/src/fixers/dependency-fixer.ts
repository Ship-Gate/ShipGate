/**
 * Phantom Dependency Fixer
 * 
 * Removes unused dependencies or adds missing dependencies to package.json.
 */

import type { Finding } from '@isl-lang/isl-gate';
import type { FixContext, FixSuggestion } from '../shipgate-fixes.js';
import { readFileSafe } from '../shipgate-fixes.js';
import { createPatch } from '../patcher.js';
import { join } from 'path';

/**
 * Extract dependency name from finding message
 */
function extractDependencyName(finding: Finding): { name: string; type: 'missing' | 'unused' } | null {
  // Try to extract from message patterns like:
  // "Missing dependency: express"
  // "Unused dependency: lodash"
  // "Package 'axios' is imported but not in package.json"
  const patterns = [
    /missing dependency[:\s]+['"]?([^\s'"]+)['"]?/i,
    /unused dependency[:\s]+['"]?([^\s'"]+)['"]?/i,
    /package ['"]([^'"]+)['"] is imported but not in package\.json/i,
    /dependency ['"]([^'"]+)['"] not found/i,
  ];

  for (const pattern of patterns) {
    const match = finding.message.match(pattern);
    if (match && match[1]) {
      const name = match[1];
      const isUnused = finding.message.toLowerCase().includes('unused');
      return { name, type: isUnused ? 'unused' : 'missing' };
    }
  }

  return null;
}

/**
 * Parse package.json
 */
function parsePackageJson(content: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
} | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Find package.json file
 */
async function findPackageJson(projectRoot: string, file?: string): Promise<string | null> {
  // If file is provided and it's package.json, use it
  if (file && file.endsWith('package.json')) {
    return file;
  }

  // Otherwise, look for package.json in project root
  const candidates = [
    'package.json',
    join(projectRoot, 'package.json'),
  ];

  for (const candidate of candidates) {
    const fullPath = candidate.startsWith('/') || candidate.includes(':')
      ? candidate
      : join(projectRoot, candidate);
    if (existsSync(fullPath)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Determine dependency section (dependencies, devDependencies, peerDependencies)
 */
function determineDependencySection(
  depName: string,
  pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
): 'dependencies' | 'devDependencies' {
  // Heuristic: if it's in devDependencies, keep it there; otherwise use dependencies
  // In a real implementation, we might analyze import patterns
  if (pkg.devDependencies && depName in pkg.devDependencies) {
    return 'devDependencies';
  }
  return 'dependencies';
}

/**
 * Add dependency to package.json
 */
function addDependency(
  content: string,
  depName: string,
  section: 'dependencies' | 'devDependencies' | 'peerDependencies',
  version: string = 'latest'
): string {
  const pkg = parsePackageJson(content);
  if (!pkg) {
    return content;
  }

  // Ensure section exists
  if (!pkg[section]) {
    pkg[section] = {};
  }

  // Add dependency
  pkg[section]![depName] = version;

  // Format JSON with proper indentation
  return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Remove dependency from package.json
 */
function removeDependency(
  content: string,
  depName: string
): string {
  const pkg = parsePackageJson(content);
  if (!pkg) {
    return content;
  }

  // Remove from all sections
  if (pkg.dependencies && depName in pkg.dependencies) {
    delete pkg.dependencies[depName];
    if (Object.keys(pkg.dependencies).length === 0) {
      delete pkg.dependencies;
    }
  }

  if (pkg.devDependencies && depName in pkg.devDependencies) {
    delete pkg.devDependencies[depName];
    if (Object.keys(pkg.devDependencies).length === 0) {
      delete pkg.devDependencies;
    }
  }

  if (pkg.peerDependencies && depName in pkg.peerDependencies) {
    delete pkg.peerDependencies[depName];
    if (Object.keys(pkg.peerDependencies).length === 0) {
      delete pkg.peerDependencies;
    }
  }

  // Format JSON with proper indentation
  return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Find line number for dependency in package.json
 */
function findDependencyLine(
  content: string,
  depName: string,
  section: string
): number {
  const lines = content.split('\n');
  let inSection = false;
  let sectionStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    
    if (line.includes(`"${section}"`)) {
      inSection = true;
      sectionStart = i;
    }

    if (inSection && line.includes(`"${depName}"`)) {
      return i + 1;
    }

    if (inSection && line.includes('}') && i > sectionStart) {
      break;
    }
  }

  // If not found, return insertion point (after section start)
  return sectionStart >= 0 ? sectionStart + 2 : lines.length;
}

/**
 * Generate fix suggestions for phantom dependency
 */
export async function fixPhantomDependency(
  finding: Finding,
  context: FixContext
): Promise<FixSuggestion[]> {
  const suggestions: FixSuggestion[] = [];
  const depInfo = extractDependencyName(finding);

  if (!depInfo) {
    return [];
  }

  const { name: depName, type } = depInfo;
  const { projectRoot } = context;

  const pkgJsonPath = await findPackageJson(projectRoot, finding.file);
  if (!pkgJsonPath) {
    return [];
  }

  const content = await readFileSafe(pkgJsonPath, projectRoot);
  if (!content) {
    return [];
  }

  const pkg = parsePackageJson(content);
  if (!pkg) {
    return [];
  }

  if (type === 'missing') {
    // Add missing dependency
    const section = determineDependencySection(depName, pkg);
    const newContent = addDependency(content, depName, section);
    const lineNumber = findDependencyLine(content, depName, section);

    const patch = createPatch('replace', 1, {
      file: pkgJsonPath,
      original: content,
      replacement: newContent,
      description: `Add missing dependency ${depName} to ${section}`,
      confidence: 0.8,
    });

    suggestions.push({
      rule: 'phantom-dependency',
      why: `Dependency ${depName} is imported but not listed in package.json. Adding to ${section}.`,
      confidence: 0.8,
      patch,
      diff: generateDiff(pkgJsonPath, content, newContent),
    });
  } else {
    // Remove unused dependency (only in dry-run unless user confirms)
    const newContent = removeDependency(content, depName);
    const lineNumber = findDependencyLine(
      content,
      depName,
      'dependencies' // Simplified - would check all sections
    );

    const patch = createPatch('replace', 1, {
      file: pkgJsonPath,
      original: content,
      replacement: newContent,
      description: `Remove unused dependency ${depName} from package.json`,
      confidence: 0.7,
    });

    suggestions.push({
      rule: 'phantom-dependency',
      why: `Dependency ${depName} is listed in package.json but not used. Consider removing.`,
      confidence: 0.7,
      patch,
      diff: generateDiff(pkgJsonPath, content, newContent),
    });
  }

  return suggestions;
}

/**
 * Generate unified diff
 */
function generateDiff(
  file: string,
  oldContent: string,
  newContent: string
): string {
  const { generateUnifiedDiff } = require('../diff-generator.js');
  return generateUnifiedDiff(file, oldContent, newContent);
}

// Import existsSync
import { existsSync } from 'fs';
