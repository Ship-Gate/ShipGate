/**
 * Actor inferrer.
 * Scans auth middleware and role checks to infer actor permissions.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InferredActor } from '../types.js';

const AUTH_PATTERNS = [
  'auth', 'authenticate', 'requireAuth', 'getSession', 'getServerSession',
  'verifyToken', 'jwt', 'middleware',
];
const ROLE_PATTERNS = ['admin', 'role', 'permission', 'isAdmin', 'requireRole'];

export async function inferActors(
  projectRoot: string
): Promise<InferredActor[]> {
  const actors: InferredActor[] = [];
  const authFiles = findAuthFiles(projectRoot);

  const anonymousActor: InferredActor = {
    name: 'Anonymous',
    permissions: ['public'],
    confidence: 'high',
    source: 'heuristic',
  };
  actors.push(anonymousActor);

  let hasAuth = false;
  let hasRole = false;
  const roleChecks: string[] = [];

  for (const file of authFiles) {
    const content = fs.readFileSync(file, 'utf-8');

    if (AUTH_PATTERNS.some((p) => content.includes(p))) {
      hasAuth = true;
    }
    if (ROLE_PATTERNS.some((p) => content.includes(p))) {
      hasRole = true;
    }

    const roleMatch = content.match(/role\s*===?\s*['"]([^'"]+)['"]/g);
    if (roleMatch) {
      for (const m of roleMatch) {
        const val = m.match(/['"]([^'"]+)['"]/)?.[1];
        if (val && !roleChecks.includes(val)) roleChecks.push(val);
      }
    }

    if (content.match(/\.(admin|isAdmin|role)\s*===?\s*true/gi)) {
      if (!roleChecks.includes('admin')) roleChecks.push('admin');
    }
  }

  if (hasAuth) {
    actors.push({
      name: 'User',
      permissions: ['authenticated'],
      confidence: 'medium',
      source: 'heuristic',
    });
  }

  if (hasRole || roleChecks.length > 0) {
    actors.push({
      name: 'Admin',
      permissions: ['authenticated', 'admin'],
      roleChecks: roleChecks.length ? roleChecks : undefined,
      confidence: 'medium',
      source: 'typescript',
    });
  }

  return actors;
}

function findAuthFiles(projectRoot: string): string[] {
  const results: string[] = [];
  const dirs = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'app'),
    path.join(projectRoot, 'middleware'),
    path.join(projectRoot, 'lib'),
    path.join(projectRoot, 'auth'),
    projectRoot,
  ];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      results.push(...collectTsFiles(dir));
    }
  }

  return results.filter((f) => {
    const name = path.basename(f).toLowerCase();
    return (
      name.includes('auth') ||
      name.includes('middleware') ||
      name.includes('session')
    );
  });
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}
