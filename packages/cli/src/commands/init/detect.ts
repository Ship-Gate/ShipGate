/**
 * Project Detection
 *
 * Detects project language, framework, source directories, and critical paths.
 * Used by `shipgate init` to provide smart defaults.
 */

import { access, readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectProfile {
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'unknown';
  framework?: 'express' | 'fastify' | 'nextjs' | 'django' | 'flask' | 'gin';
  srcDirs: string[];
  criticalDirs: string[];
  testPattern: string;
  ciProvider?: 'github' | 'gitlab' | 'circleci';
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'go';
}

export interface DetectedPattern {
  /** Source file path (relative) */
  file: string;
  /** Pattern name (e.g. "auth-login", "jwt-token") */
  pattern: string;
  /** Confidence score 0-1 */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CRITICAL_DIR_KEYWORDS = [
  'auth', 'authentication', 'login',
  'payment', 'payments', 'billing', 'checkout', 'stripe',
  'api', 'routes', 'controllers',
  'security', 'crypto', 'encryption',
  'admin', 'dashboard',
  'middleware', 'gateway',
  'user', 'users', 'accounts',
];

const SRC_DIR_CANDIDATES = ['src', 'lib', 'app', 'server', 'api', 'backend', 'packages'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go']);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Detection
// ─────────────────────────────────────────────────────────────────────────────

async function detectLanguage(root: string): Promise<{
  language: ProjectProfile['language'];
  packageManager?: ProjectProfile['packageManager'];
}> {
  // Go
  if (await exists(join(root, 'go.mod'))) {
    return { language: 'go', packageManager: 'go' };
  }

  // Python
  if (
    await exists(join(root, 'requirements.txt')) ||
    await exists(join(root, 'pyproject.toml')) ||
    await exists(join(root, 'setup.py')) ||
    await exists(join(root, 'Pipfile'))
  ) {
    return { language: 'python', packageManager: 'pip' };
  }

  // Node.js (TypeScript or JavaScript)
  if (await exists(join(root, 'package.json'))) {
    let pm: ProjectProfile['packageManager'] = 'npm';
    if (await exists(join(root, 'pnpm-lock.yaml'))) pm = 'pnpm';
    else if (await exists(join(root, 'yarn.lock'))) pm = 'yarn';

    if (
      await exists(join(root, 'tsconfig.json')) ||
      await exists(join(root, 'tsconfig.base.json'))
    ) {
      return { language: 'typescript', packageManager: pm };
    }

    return { language: 'javascript', packageManager: pm };
  }

  return { language: 'unknown' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Framework Detection
// ─────────────────────────────────────────────────────────────────────────────

async function detectFramework(root: string): Promise<ProjectProfile['framework'] | undefined> {
  // Node.js frameworks
  const pkg = await readJsonSafe(join(root, 'package.json'));
  if (pkg) {
    const deps = pkg.dependencies as Record<string, string> | undefined;
    const devDeps = pkg.devDependencies as Record<string, string> | undefined;
    const allDeps = { ...deps, ...devDeps };

    if ('next' in allDeps) return 'nextjs';
    if ('fastify' in allDeps) return 'fastify';
    if ('express' in allDeps) return 'express';
  }

  // Python frameworks
  try {
    const reqs = await readFile(join(root, 'requirements.txt'), 'utf-8');
    if (/\bdjango\b/i.test(reqs)) return 'django';
    if (/\bflask\b/i.test(reqs)) return 'flask';
  } catch {
    /* no requirements.txt */
  }

  // Go frameworks
  try {
    const gomod = await readFile(join(root, 'go.mod'), 'utf-8');
    if (gomod.includes('gin-gonic')) return 'gin';
  } catch {
    /* no go.mod */
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Directory Discovery
// ─────────────────────────────────────────────────────────────────────────────

async function findSrcDirs(root: string): Promise<string[]> {
  const found: string[] = [];

  for (const candidate of SRC_DIR_CANDIDATES) {
    if (await isDirectory(join(root, candidate))) {
      found.push(candidate);
    }
  }

  if (found.length === 0) {
    found.push('.');
  }

  return found;
}

async function findCriticalDirs(root: string, srcDirs: string[]): Promise<string[]> {
  const critical: string[] = [];

  for (const srcDir of srcDirs) {
    const base = join(root, srcDir);
    try {
      const entries = await readdir(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const lower = entry.name.toLowerCase();
        if (CRITICAL_DIR_KEYWORDS.some((kw) => lower.includes(kw))) {
          const relPath = srcDir === '.' ? entry.name : `${srcDir}/${entry.name}`;
          critical.push(relPath);
        }
      }
    } catch {
      /* directory not readable */
    }
  }

  return critical;
}

async function detectCIProvider(root: string): Promise<ProjectProfile['ciProvider'] | undefined> {
  if (await exists(join(root, '.github', 'workflows'))) return 'github';
  if (await exists(join(root, '.gitlab-ci.yml'))) return 'gitlab';
  if (await exists(join(root, '.circleci', 'config.yml'))) return 'circleci';
  return undefined;
}

function getTestPattern(language: ProjectProfile['language']): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return '*.test.ts';
    case 'python':
      return 'test_*.py';
    case 'go':
      return '*_test.go';
    default:
      return '*.test.*';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Scanning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan a directory for source files and detect behavioral patterns.
 * Returns pattern names and confidence scores.
 */
export async function scanForPatterns(
  root: string,
  dir: string,
): Promise<DetectedPattern[]> {
  const results: DetectedPattern[] = [];
  const absDir = join(root, dir);

  try {
    const entries = await readdir(absDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      if (entry.name.endsWith('.d.ts')) continue;

      const name = entry.name.toLowerCase();
      const filePath = `${dir}/${entry.name}`;

      // Filename-based pattern detection
      if (name.includes('login') || name.includes('signin')) {
        results.push({ file: filePath, pattern: 'auth-login', confidence: 0.82 });
      }
      if (name.includes('register') || name.includes('signup')) {
        results.push({ file: filePath, pattern: 'user-registration', confidence: 0.78 });
      }
      if (name.includes('jwt') || name.includes('token')) {
        results.push({ file: filePath, pattern: 'jwt-token', confidence: 0.75 });
      }
      if (name.includes('password') || name.includes('hash')) {
        results.push({ file: filePath, pattern: 'password-hash', confidence: 0.73 });
      }
      if (name.includes('session')) {
        results.push({ file: filePath, pattern: 'session-management', confidence: 0.70 });
      }
      if (name.includes('charge') || name.includes('payment') || name.includes('billing')) {
        results.push({ file: filePath, pattern: 'payment-processing', confidence: 0.80 });
      }
      if (name.includes('subscription') || name.includes('plan')) {
        results.push({ file: filePath, pattern: 'subscription-management', confidence: 0.72 });
      }
      if (name.includes('refund')) {
        results.push({ file: filePath, pattern: 'refund-processing', confidence: 0.75 });
      }
      if (name.includes('rate') && name.includes('limit')) {
        results.push({ file: filePath, pattern: 'rate-limiting', confidence: 0.65 });
      }

      // Content-based pattern detection
      try {
        const source = await readFile(join(absDir, entry.name), 'utf-8');

        if (
          (source.includes('jwt.sign') || source.includes('jwt.verify') || source.includes('jsonwebtoken')) &&
          !results.some((r) => r.file === filePath && r.pattern === 'jwt-token')
        ) {
          results.push({ file: filePath, pattern: 'jwt-token', confidence: 0.80 });
        }

        if (
          (source.includes('bcrypt') || source.includes('argon2') || source.includes('scrypt')) &&
          !results.some((r) => r.file === filePath && r.pattern === 'password-hash')
        ) {
          results.push({ file: filePath, pattern: 'password-hash', confidence: 0.78 });
        }

        if (
          (source.includes('rateLimit') || source.includes('rate_limit') || source.includes('throttle')) &&
          !results.some((r) => r.file === filePath && r.pattern === 'rate-limiting')
        ) {
          results.push({ file: filePath, pattern: 'rate-limiting', confidence: 0.65 });
        }

        if (
          (source.includes('stripe') || source.includes('Stripe') || source.includes('paymentIntent')) &&
          !results.some((r) => r.file === filePath && r.pattern === 'payment-processing')
        ) {
          results.push({ file: filePath, pattern: 'payment-processing', confidence: 0.82 });
        }
      } catch {
        /* file not readable */
      }
    }
  } catch {
    /* directory not readable */
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subdirectory Listing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all subdirectories of a source directory (non-recursive, single level).
 */
export async function getSubDirs(root: string, srcDir: string): Promise<string[]> {
  const dirs: string[] = [];
  const absDir = join(root, srcDir);

  try {
    const entries = await readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        dirs.push(srcDir === '.' ? entry.name : `${srcDir}/${entry.name}`);
      }
    }
  } catch {
    /* skip */
  }

  return dirs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Detection Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect project characteristics from the filesystem.
 * Scans for language, framework, source directories, and critical paths.
 */
export async function detectProject(root: string): Promise<ProjectProfile> {
  const { language, packageManager } = await detectLanguage(root);
  const framework = await detectFramework(root);
  const srcDirs = await findSrcDirs(root);
  const criticalDirs = await findCriticalDirs(root, srcDirs);
  const ciProvider = await detectCIProvider(root);
  const testPattern = getTestPattern(language);

  return {
    language,
    framework,
    srcDirs,
    criticalDirs,
    testPattern,
    ciProvider,
    packageManager,
  };
}
