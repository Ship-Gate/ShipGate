/**
 * Extract environment variable usage from code
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EnvUsage } from '../types.js';

/**
 * Extract env var usage from TypeScript/JavaScript files
 */
export function extractUsages(
  projectRoot: string,
  filePaths: string[]
): EnvUsage[] {
  const usages: EnvUsage[] = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Pattern 1: process.env.VAR_NAME
    extractProcessEnvUsages(content, lines, filePath, usages);

    // Pattern 2: process.env['VAR_NAME'] or process.env["VAR_NAME"]
    extractProcessEnvBracketUsages(content, lines, filePath, usages);

    // Pattern 3: Deno.env.get('VAR_NAME')
    extractDenoEnvUsages(content, lines, filePath, usages);

    // Pattern 4: import.meta.env.VAR_NAME (Vite/Next.js)
    extractImportMetaEnvUsages(content, lines, filePath, usages);

    // Pattern 5: Bun.env.VAR_NAME
    extractBunEnvUsages(content, lines, filePath, usages);
  }

  return usages;
}

/**
 * Extract process.env.VAR_NAME patterns
 */
function extractProcessEnvUsages(
  content: string,
  lines: string[],
  filePath: string,
  usages: EnvUsage[]
): void {
  const pattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const varName = match[1];
    const lineNum = getLineNumber(content, match.index);
    const lineContent = lines[lineNum - 1];

    // Check for default value: process.env.VAR || 'default'
    const hasDefault = /\|\|\s*['"`]/.test(lineContent);
    const defaultValueMatch = lineContent.match(/\|\|\s*['"`]([^'"`]+)['"`]/);

    // Extract context (function/class name)
    const context = extractContext(content, match.index);

    usages.push({
      name: varName,
      file: filePath,
      line: lineNum,
      source: 'process.env',
      hasDefault,
      defaultValue: defaultValueMatch ? defaultValueMatch[1] : undefined,
      context,
    });
  }
}

/**
 * Extract process.env['VAR_NAME'] patterns
 */
function extractProcessEnvBracketUsages(
  content: string,
  lines: string[],
  filePath: string,
  usages: EnvUsage[]
): void {
  const pattern = /process\.env\[['"`]([A-Z_][A-Z0-9_]*)['"`]\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const varName = match[1];
    const lineNum = getLineNumber(content, match.index);
    const lineContent = lines[lineNum - 1];

    const hasDefault = /\|\|\s*['"`]/.test(lineContent);
    const defaultValueMatch = lineContent.match(/\|\|\s*['"`]([^'"`]+)['"`]/);
    const context = extractContext(content, match.index);

    usages.push({
      name: varName,
      file: filePath,
      line: lineNum,
      source: 'process.env',
      hasDefault,
      defaultValue: defaultValueMatch ? defaultValueMatch[1] : undefined,
      context,
    });
  }
}

/**
 * Extract Deno.env.get('VAR_NAME') patterns
 */
function extractDenoEnvUsages(
  content: string,
  lines: string[],
  filePath: string,
  usages: EnvUsage[]
): void {
  const pattern = /Deno\.env\.get\s*\(\s*['"`]([A-Z_][A-Z0-9_]*)['"`]\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const varName = match[1];
    const lineNum = getLineNumber(content, match.index);
    const context = extractContext(content, match.index);

    usages.push({
      name: varName,
      file: filePath,
      line: lineNum,
      source: 'Deno.env.get',
      hasDefault: false, // Deno.env.get returns undefined if not found
      context,
    });
  }
}

/**
 * Extract import.meta.env.VAR_NAME patterns (Vite/Next.js)
 */
function extractImportMetaEnvUsages(
  content: string,
  lines: string[],
  filePath: string,
  usages: EnvUsage[]
): void {
  const pattern = /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const varName = match[1];
    const lineNum = getLineNumber(content, match.index);
    const context = extractContext(content, match.index);

    usages.push({
      name: varName,
      file: filePath,
      line: lineNum,
      source: 'import.meta.env',
      hasDefault: false,
      context,
    });
  }
}

/**
 * Extract Bun.env.VAR_NAME patterns
 */
function extractBunEnvUsages(
  content: string,
  lines: string[],
  filePath: string,
  usages: EnvUsage[]
): void {
  const pattern = /Bun\.env\.([A-Z_][A-Z0-9_]*)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const varName = match[1];
    const lineNum = getLineNumber(content, match.index);
    const context = extractContext(content, match.index);

    usages.push({
      name: varName,
      file: filePath,
      line: lineNum,
      source: 'Bun.env',
      hasDefault: false,
      context,
    });
  }
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract function/class context around usage
 */
function extractContext(content: string, index: number): string | undefined {
  const before = content.substring(0, index);
  const lines = before.split('\n');
  const currentLine = lines[lines.length - 1];

  // Look for function/class declarations in recent lines
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i];
    const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*[=:]/);
    if (funcMatch) {
      return funcMatch[1];
    }
    const classMatch = line.match(/class\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }
  }

  return undefined;
}
