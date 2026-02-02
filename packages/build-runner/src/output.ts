// ============================================================================
// Output Manager - Deterministic File Output
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { OutputFile, OutputManifest, ManifestEntry } from './types.js';

/**
 * Fixed output directory structure
 */
export const OUTPUT_STRUCTURE = {
  types: 'types',
  tests: 'tests',
  helpers: 'tests/helpers',
  fixtures: 'tests/fixtures',
  evidence: 'evidence',
  reports: 'reports',
} as const;

/**
 * Create a deterministic hash of content
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Create a deterministic build ID from spec path and content
 */
export function createDeterministicBuildId(specPath: string, content: string): string {
  const normalizedPath = path.basename(specPath);
  const combined = `${normalizedPath}:${content}`;
  return crypto.createHash('sha256').update(combined, 'utf8').digest('hex').slice(0, 12);
}

/**
 * Sort files deterministically by path
 */
export function sortFilesDeterministically(files: OutputFile[]): OutputFile[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

/**
 * Write all output files to the output directory
 */
export async function writeOutputFiles(
  outDir: string,
  files: OutputFile[]
): Promise<OutputManifest> {
  // Ensure output directory exists
  await fs.mkdir(outDir, { recursive: true });

  // Sort files deterministically
  const sortedFiles = sortFilesDeterministically(files);

  // Collect directories to create
  const directories = new Set<string>();
  for (const file of sortedFiles) {
    const dir = path.dirname(path.join(outDir, file.path));
    directories.add(dir);
  }

  // Create directories in sorted order
  const sortedDirs = [...directories].sort((a, b) => a.localeCompare(b, 'en'));
  for (const dir of sortedDirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Write files and build manifest
  const manifestEntries: ManifestEntry[] = [];
  const counts: Record<OutputFile['type'], number> = {
    types: 0,
    test: 0,
    helper: 0,
    config: 0,
    fixture: 0,
    evidence: 0,
    report: 0,
  };

  for (const file of sortedFiles) {
    const fullPath = path.join(outDir, file.path);
    await fs.writeFile(fullPath, file.content, 'utf8');

    const sizeBytes = Buffer.byteLength(file.content, 'utf8');
    const hash = hashContent(file.content);

    manifestEntries.push({
      path: file.path,
      type: file.type,
      sizeBytes,
      hash,
    });

    counts[file.type] = (counts[file.type] || 0) + 1;
  }

  return {
    root: outDir,
    files: manifestEntries,
    counts,
  };
}

/**
 * Generate manifest file content (JSON)
 */
export function generateManifestContent(manifest: OutputManifest): string {
  // Create a stable JSON output with sorted keys
  const output = {
    root: manifest.root,
    generated: 'build-runner',
    fileCount: manifest.files.length,
    counts: Object.fromEntries(
      Object.entries(manifest.counts).sort(([a], [b]) => a.localeCompare(b, 'en'))
    ),
    files: manifest.files.map((f) => ({
      path: f.path,
      type: f.type,
      size: f.sizeBytes,
      hash: f.hash,
    })),
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Clean output directory (remove all generated files)
 */
export async function cleanOutputDir(outDir: string): Promise<void> {
  try {
    await fs.rm(outDir, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
}

/**
 * Get the output path for a file type
 */
export function getOutputPath(type: OutputFile['type'], filename: string): string {
  switch (type) {
    case 'types':
      return path.join(OUTPUT_STRUCTURE.types, filename);
    case 'test':
      return path.join(OUTPUT_STRUCTURE.tests, filename);
    case 'helper':
      return path.join(OUTPUT_STRUCTURE.helpers, filename);
    case 'fixture':
      return path.join(OUTPUT_STRUCTURE.fixtures, filename);
    case 'evidence':
      return path.join(OUTPUT_STRUCTURE.evidence, filename);
    case 'report':
      return path.join(OUTPUT_STRUCTURE.reports, filename);
    case 'config':
      return filename;
    default:
      return filename;
  }
}

/**
 * Normalize a path for deterministic output (forward slashes, no trailing slash)
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * Create output file entries from generated content
 */
export function createOutputFiles(
  generatedTypes: { path: string; content: string }[],
  generatedTests: { path: string; content: string; type: string }[]
): OutputFile[] {
  const files: OutputFile[] = [];

  for (const t of generatedTypes) {
    files.push({
      path: normalizePath(t.path),
      content: t.content,
      type: 'types',
    });
  }

  for (const t of generatedTests) {
    const type = t.type === 'test' ? 'test' : t.type === 'helper' ? 'helper' : t.type === 'fixture' ? 'fixture' : 'config';
    files.push({
      path: normalizePath(t.path),
      content: t.content,
      type: type as OutputFile['type'],
    });
  }

  return sortFilesDeterministically(files);
}
