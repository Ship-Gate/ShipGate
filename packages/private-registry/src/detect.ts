/**
 * Detect private registries for npm, PyPI, and Maven from config files and environment.
 * No allowlists: we only use config and env to determine what is private.
 * @module @isl-lang/private-registry/detect
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PrivateRegistryConfig, DetectOptions } from './types.js';

const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/';
const DEFAULT_PYPI_INDEX = 'https://pypi.org/simple';
const DEFAULT_MAVEN_CENTRAL = 'https://repo.maven.apache.org/maven2';

/**
 * Normalize a registry URL for comparison (lowercase, strip trailing slash, no protocol for host match).
 */
function normalizeRegistryUrl(url: string): string {
  try {
    const u = url.trim().toLowerCase().replace(/\/$/, '');
    if (!u) return '';
    return u;
  } catch {
    return '';
  }
}

/**
 * Return true if the URL is a well-known public registry (so we treat anything else as potentially private).
 */
function isPublicNpmRegistry(url: string): boolean {
  const n = normalizeRegistryUrl(url);
  return n === '' || n === normalizeRegistryUrl(DEFAULT_NPM_REGISTRY) || n === 'https://registry.npmjs.org';
}

function isPublicPypiIndex(url: string): boolean {
  const n = normalizeRegistryUrl(url);
  return n === '' || n === normalizeRegistryUrl(DEFAULT_PYPI_INDEX) || n === 'https://pypi.org/simple';
}

function isPublicMavenRepo(url: string): boolean {
  const n = normalizeRegistryUrl(url);
  return (
    n === '' ||
    n === normalizeRegistryUrl(DEFAULT_MAVEN_CENTRAL) ||
    n === 'https://repo.maven.apache.org/maven2' ||
    n === 'https://repo1.maven.org/maven2'
  );
}

/**
 * Collect npm registry URLs from env and .npmrc (no allowlist).
 */
function detectNpmPrivate(projectRoot: string | undefined, env: NodeJS.ProcessEnv): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Env: NPM_CONFIG_REGISTRY, npm_config_registry (npm lowercases)
  const envRegistry = env.NPM_CONFIG_REGISTRY ?? env.npm_config_registry;
  if (envRegistry && typeof envRegistry === 'string') {
    const n = normalizeRegistryUrl(envRegistry);
    if (n && !isPublicNpmRegistry(envRegistry) && !seen.has(n)) {
      seen.add(n);
      urls.push(envRegistry.trim());
    }
  }

  // .npmrc: registry= and @scope:registry=
  const npmrcPaths: string[] = [];
  if (projectRoot) {
    npmrcPaths.push(join(projectRoot, '.npmrc'));
  }
  const home = env.HOME ?? env.USERPROFILE;
  if (home) {
    npmrcPaths.push(join(home, '.npmrc'));
  }

  for (const p of npmrcPaths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.replace(/#.*$/, '').trim();
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if ((key === 'registry' || key.endsWith(':registry')) && value) {
          const n = normalizeRegistryUrl(value);
          if (n && !isPublicNpmRegistry(value) && !seen.has(n)) {
            seen.add(n);
            urls.push(value);
          }
        }
      }
    } catch {
      // ignore read/parse errors
    }
  }

  return urls;
}

/**
 * Collect PyPI index URLs from env and config (no allowlist).
 */
function detectPypiPrivate(projectRoot: string | undefined, env: NodeJS.ProcessEnv): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // PIP_INDEX_URL, PIP_EXTRA_INDEX_URL, TWINE_REPOSITORY_URL
  const envVars = [
    env.PIP_INDEX_URL,
    env.PIP_EXTRA_INDEX_URL,
    env.TWINE_REPOSITORY_URL,
    env.PIP_TRUSTED_HOST, // often used with custom index
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  for (const v of envVars) {
    const one = v.split(/\s+/)[0]?.trim() ?? '';
    if (!one) continue;
    let url = one;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const n = normalizeRegistryUrl(url);
    if (n && !isPublicPypiIndex(url) && !seen.has(n)) {
      seen.add(n);
      urls.push(url);
    }
  }

  // pip.conf / pip.ini locations
  const pipPaths: string[] = [];
  if (projectRoot) {
    pipPaths.push(join(projectRoot, 'pip.conf'), join(projectRoot, '.pip', 'pip.conf'));
  }
  const home = env.HOME ?? env.USERPROFILE;
  const appData = env.APPDATA;
  if (home) pipPaths.push(join(home, '.config', 'pip', 'pip.conf'), join(home, '.pip', 'pip.conf'));
  if (appData) pipPaths.push(join(appData, 'pip', 'pip.ini'));

  for (const p of pipPaths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      // [global] index-url = ... extra-index-url = ...
      const indexUrlMatch = content.match(/index-url\s*=\s*(\S+)/gi);
      const extraMatch = content.match(/extra-index-url\s*=\s*(\S+)/gi);
      for (const m of [...(indexUrlMatch ?? []), ...(extraMatch ?? [])]) {
        const value = m.split('=')[1]?.trim() ?? '';
        if (!value) continue;
        let url = value;
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        const n = normalizeRegistryUrl(url);
        if (n && !isPublicPypiIndex(url) && !seen.has(n)) {
          seen.add(n);
          urls.push(url);
        }
      }
    } catch {
      // ignore
    }
  }

  return urls;
}

/**
 * Collect Maven repository URLs from env and settings.xml (no allowlist).
 */
function detectMavenPrivate(projectRoot: string | undefined, env: NodeJS.ProcessEnv): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // MAVEN_OPTS can contain -Drepository.url=...; also common to use env in settings.xml
  const mavenRepoUrl = env.MAVEN_REPOSITORY_URL ?? env.MAVEN_REPO_URL;
  if (mavenRepoUrl && typeof mavenRepoUrl === 'string') {
    const n = normalizeRegistryUrl(mavenRepoUrl);
    if (n && !isPublicMavenRepo(mavenRepoUrl) && !seen.has(n)) {
      seen.add(n);
      urls.push(mavenRepoUrl.trim());
    }
  }

  // settings.xml: <repository><url>...</url></repository>
  const settingsPaths: string[] = [];
  if (projectRoot) {
    settingsPaths.push(
      join(projectRoot, '.m2', 'settings.xml'),
      join(projectRoot, 'settings.xml'),
    );
  }
  const home = env.HOME ?? env.USERPROFILE;
  const m2Home = env.M2_HOME ?? (home ? join(home, '.m2') : '');
  if (m2Home) settingsPaths.push(join(m2Home, 'settings.xml'));

  for (const p of settingsPaths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      const urlMatches = content.match(/<url>\s*([^<]+)\s*<\/url>/gi);
      if (urlMatches) {
        for (const m of urlMatches) {
          const value = m.replace(/<\/?url>\s*/gi, '').trim();
          if (!value) continue;
          const n = normalizeRegistryUrl(value);
          if (n && !isPublicMavenRepo(value) && !seen.has(n)) {
            seen.add(n);
            urls.push(value);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return urls;
}

/**
 * Detect all private registries from config and environment.
 * Uses only config files and env vars — no allowlists.
 */
export function detectPrivateRegistries(options: DetectOptions = {}): PrivateRegistryConfig {
  const projectRoot = options.projectRoot;
  const env = options.env ?? process.env;

  return {
    npm: detectNpmPrivate(projectRoot, env),
    pypi: detectPypiPrivate(projectRoot, env),
    maven: detectMavenPrivate(projectRoot, env),
  };
}

/**
 * Check if a given registry URL is considered private for the ecosystem (i.e. not the default public).
 */
export function isPrivateRegistryUrl(
  ecosystem: 'npm' | 'pypi' | 'maven',
  url: string,
): boolean {
  const n = normalizeRegistryUrl(url);
  if (!n) return false;
  switch (ecosystem) {
    case 'npm':
      return !isPublicNpmRegistry(url);
    case 'pypi':
      return !isPublicPypiIndex(url);
    case 'maven':
      return !isPublicMavenRepo(url);
    default:
      return false;
  }
}

/**
 * Check if a dependency name/scope is served by one of the detected private registries.
 * For npm: if we have a scoped registry for @scope, or the default registry is private.
 * For PyPI/Maven: we only have a list of private index/repo URLs; we can't know which package
 * comes from which without resolution. So we consider "from private" if the resolved URL
 * matches a detected private registry, or (when resolution failed) we treat as "unverifiable"
 * only when there is at least one private registry configured — caller can use that to
 * downgrade "broken" to "unverifiable_private" when appropriate.
 */
export function isPackageFromDetectedPrivate(
  ecosystem: 'npm' | 'pypi' | 'maven',
  _name: string,
  resolvedRegistryUrl: string | undefined,
  config: PrivateRegistryConfig,
): boolean {
  if (resolvedRegistryUrl) {
    const n = normalizeRegistryUrl(resolvedRegistryUrl);
    const list = ecosystem === 'npm' ? config.npm : ecosystem === 'pypi' ? config.pypi : config.maven;
    return list.some((u) => normalizeRegistryUrl(u) === n);
  }
  // No resolved URL: for npm we can guess from scope. @scope/pkg -> check if we have @scope:registry
  if (ecosystem === 'npm' && _name.startsWith('@')) {
    const scope = _name.split('/')[0];
    if (scope && config.npm.length > 0) {
      // If any private npm registry is configured, we treat scoped packages as possibly from it
      return true;
    }
  }
  // If we have private registries configured and no resolved URL, caller may still treat as unverifiable
  const list = ecosystem === 'npm' ? config.npm : ecosystem === 'pypi' ? config.pypi : config.maven;
  return list.length > 0;
}
