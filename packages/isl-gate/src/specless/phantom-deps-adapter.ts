/**
 * Phantom Dependency Scanner — Inlined SpeclessCheck
 *
 * Detects phantom/missing dependencies directly without an external package:
 *   - npm/yarn imports not listed in package.json dependencies
 *   - Relative imports that resolve to non-existent files
 *   - Potential typosquatting (Levenshtein distance ≤ 2 from a known package)
 *
 * Fail-closed: if the project root has no package.json, returns a warning.
 *
 * @module @isl-lang/gate/specless/phantom-deps-adapter
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import {
  registerSpeclessCheck,
  type SpeclessCheck,
  type GateContext,
} from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

const SCANNABLE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto',
  'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https', 'module', 'net', 'os',
  'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl',
  'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty', 'url',
  'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);
const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function isScannable(file: string): boolean {
  const ext = file.split('.').pop()?.toLowerCase();
  return SCANNABLE_EXTS.has(ext ?? '');
}

function extractImports(content: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      if (m[1] && !specifiers.includes(m[1])) specifiers.push(m[1]);
    }
  }
  return specifiers;
}

function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  return specifier.split('/')[0]!;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

function resolveRelative(specifier: string, fromDir: string): boolean {
  const base = resolve(fromDir, specifier);
  const stripped = extname(base) ? base : base;
  const candidates = [
    stripped,
    ...TS_EXTENSIONS.map((e) => stripped + e),
    ...TS_EXTENSIONS.map((e) => resolve(stripped, 'index' + e)),
  ];
  return candidates.some((c) => existsSync(c));
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function loadDeclaredPackages(projectRoot: string): Set<string> | null {
  const pkgPath = resolve(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const all = new Set<string>();
    for (const group of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
      if (group) Object.keys(group).forEach((k) => all.add(k));
    }
    return all;
  } catch {
    return null;
  }
}

export const phantomDepsCheck: SpeclessCheck = {
  name: 'phantom-dependency-scanner',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isScannable(file)) return [];

    const declared = loadDeclaredPackages(context.projectRoot);
    if (!declared) {
      return [{
        source: 'specless-scanner',
        check: 'phantom-dependency-scanner',
        result: 'warn',
        confidence: 0.5,
        details: `No package.json found at ${context.projectRoot} — phantom dep check skipped`,
      }];
    }

    let content: string;
    try {
      content = context.implementation?.length
        ? context.implementation
        : readFileSync(file, 'utf-8');
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'phantom-dependency-scanner',
        result: 'fail',
        confidence: 0.5,
        details: `Could not read file for phantom-dep analysis: ${file}`,
      }];
    }

    const specifiers = extractImports(content);
    const fileDir = dirname(file);
    const findings: GateEvidence[] = [];
    let checkedCount = 0;

    for (const specifier of specifiers) {
      if (specifier.startsWith('node:') || NODE_BUILTINS.has(specifier.split('/')[0]!)) continue;

      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        checkedCount++;
        if (!resolveRelative(specifier, fileDir)) {
          findings.push({
            source: 'specless-scanner',
            check: `phantom-dep: unresolvable relative import "${specifier}"`,
            result: 'fail',
            confidence: 0.90,
            details: `Relative import "${specifier}" in ${file} does not resolve to an existing file`,
          });
        }
        continue;
      }

      const pkgName = packageNameFromSpecifier(specifier);
      checkedCount++;

      if (!declared.has(pkgName)) {
        const typoCandidate = [...declared].find((d) => levenshtein(pkgName, d) <= 2 && d !== pkgName);
        const isCritical = !pkgName.startsWith('@types/');
        findings.push({
          source: 'specless-scanner',
          check: isCritical
            ? `critical_vulnerability: phantom dep "${pkgName}"${typoCandidate ? ` (did you mean "${typoCandidate}"?)` : ''}`
            : `phantom-dep: missing declaration "${pkgName}"`,
          result: isCritical ? 'fail' : 'warn',
          confidence: typoCandidate ? 0.90 : 0.80,
          details: `"${pkgName}" imported in ${file} is not in package.json${typoCandidate ? ` — possible typosquat of "${typoCandidate}"` : ''}`,
        });
      }
    }

    if (findings.length === 0) {
      return [{
        source: 'specless-scanner',
        check: 'phantom-deps: all imports resolve',
        result: 'pass',
        confidence: 0.85,
        details: `All ${checkedCount} imports in ${file} resolve correctly`,
      }];
    }

    return findings;
  },
};

registerSpeclessCheck(phantomDepsCheck);
