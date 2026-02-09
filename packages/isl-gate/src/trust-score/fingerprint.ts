/**
 * Project Fingerprinting for Trust Score History
 *
 * Generates stable, deterministic fingerprints for projects to enable
 * per-project history tracking and prevent cross-project contamination.
 *
 * @module @isl-lang/gate/trust-score/fingerprint
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Generate a project fingerprint from project root directory.
 *
 * The fingerprint is computed from:
 * - Project root path (normalized)
 * - Package.json name/version (if exists)
 * - ISL config file (if exists)
 * - Git root (if exists)
 *
 * This ensures the same project always gets the same fingerprint,
 * even across different machines or directory structures.
 */
export function generateProjectFingerprint(projectRoot: string): string {
  const root = resolve(projectRoot);
  const hash = createHash('sha256');

  // Include normalized project root
  hash.update(`root:${root}\n`);

  // Include package.json if it exists
  const packageJsonPath = join(root, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      hash.update(`package:${pkg.name ?? 'unknown'}:${pkg.version ?? 'unknown'}\n`);
    } catch {
      // Ignore parse errors
    }
  }

  // Include ISL config if it exists
  const islConfigPath = join(root, 'isl.config.json');
  if (existsSync(islConfigPath)) {
    try {
      const stats = statSync(islConfigPath);
      hash.update(`isl-config:${stats.mtimeMs}\n`);
    } catch {
      // Ignore errors
    }
  }

  // Include ShipGate config if it exists
  const shipgateConfigPath = join(root, '.shipgate', 'project.json');
  if (existsSync(shipgateConfigPath)) {
    try {
      const stats = statSync(shipgateConfigPath);
      hash.update(`shipgate-config:${stats.mtimeMs}\n`);
    } catch {
      // Ignore errors
    }
  }

  // Try to include git root
  try {
    const { execSync } = require('child_process');
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (gitRoot) {
      hash.update(`git-root:${gitRoot}\n`);
    }
  } catch {
    // Not a git repo or git not available
  }

  return hash.digest('hex').slice(0, 16);
}

/**
 * Compute project fingerprint from input metadata.
 * Falls back to generating from projectRoot if fingerprint not provided.
 */
export function computeProjectFingerprint(
  projectRoot?: string,
  providedFingerprint?: string,
): string | undefined {
  if (providedFingerprint) {
    return providedFingerprint;
  }

  if (projectRoot) {
    return generateProjectFingerprint(projectRoot);
  }

  // Try to detect project root from cwd
  try {
    const cwd = process.cwd();
    return generateProjectFingerprint(cwd);
  } catch {
    return undefined;
  }
}
