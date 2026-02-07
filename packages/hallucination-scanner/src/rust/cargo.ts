/**
 * Load and parse Cargo.toml
 * @module @isl-lang/hallucination-scanner/rust/cargo
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CargoManifest, CargoDependencyValue } from './types.js';

/**
 * Find Cargo.toml path from a directory (current or parent)
 */
export async function findCargoToml(dir: string): Promise<string | null> {
  let current = path.resolve(dir);
  const root = path.parse(current).root;

  while (current !== root) {
    const candidate = path.join(current, 'Cargo.toml');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      current = path.dirname(current);
    }
  }

  return null;
}

/**
 * Parse Cargo.toml content (INI-like TOML subset: [package], [dependencies], etc.)
 * Does not use an external TOML parser to avoid dependency; parses enough for dependency names.
 */
export function parseCargoToml(content: string): CargoManifest | null {
  const manifest: CargoManifest = {};
  let currentSection: string | null = null;
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).trim();
      continue;
    }

    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();

    if (currentSection === 'package') {
      if (!manifest.package) manifest.package = { name: '' };
      if (key === 'name') manifest.package.name = parseStringValue(value);
      if (key === 'version') manifest.package.version = parseStringValue(value);
      if (key === 'edition') manifest.package.edition = parseStringValue(value);
    }

    if (
      currentSection === 'dependencies' ||
      currentSection === 'dev-dependencies' ||
      currentSection === 'build-dependencies'
    ) {
      const depKey = key.replace(/^([^."]+).*$/, '$1');
      if (!manifest[currentSection]) (manifest as Record<string, Record<string, CargoDependencyValue>>)[currentSection] = {};
      const section = manifest[currentSection] as Record<string, CargoDependencyValue>;
      if (value.startsWith('"') || value.startsWith("'")) {
        section[depKey] = parseStringValue(value);
      } else if (value.startsWith('{')) {
        section[depKey] = parseInlineTable(value);
      }
    }
  }

  return manifest;
}

function parseStringValue(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return t;
}

function parseInlineTable(s: string): { version?: string; path?: string; git?: string; optional?: boolean; package?: string } {
  const out: { version?: string; path?: string; git?: string; optional?: boolean; package?: string } = {};
  const versionMatch = s.match(/version\s*=\s*["']([^"']+)["']/);
  if (versionMatch?.[1]) out.version = versionMatch[1];
  const pathMatch = s.match(/path\s*=\s*["']([^"']+)["']/);
  if (pathMatch?.[1]) out.path = pathMatch[1];
  const gitMatch = s.match(/git\s*=\s*["']([^"']+)["']/);
  if (gitMatch?.[1]) out.git = gitMatch[1];
  const packageMatch = s.match(/package\s*=\s*["']([^"']+)["']/);
  if (packageMatch?.[1]) out.package = packageMatch[1];
  if (/optional\s*=\s*true/.test(s)) out.optional = true;
  return out;
}

/**
 * Load Cargo.toml from a directory (searches upward for Cargo.toml)
 */
export async function loadCargoManifest(projectRoot: string): Promise<CargoManifest | null> {
  const cargoPath = await findCargoToml(projectRoot);
  if (!cargoPath) return null;

  try {
    const content = await fs.readFile(cargoPath, 'utf-8');
    return parseCargoToml(content);
  } catch {
    return null;
  }
}

/**
 * Return set of all crate names declared in the manifest (dependencies + dev + build)
 */
export function getDeclaredCrates(manifest: CargoManifest): Set<string> {
  const set = new Set<string>();
  const sections: (keyof CargoManifest)[] = ['dependencies', 'dev-dependencies', 'build-dependencies'];
  for (const section of sections) {
    const deps = manifest[section] as Record<string, CargoDependencyValue> | undefined;
    if (deps && typeof deps === 'object') {
      for (const name of Object.keys(deps)) {
        set.add(name);
      }
    }
  }
  return set;
}
