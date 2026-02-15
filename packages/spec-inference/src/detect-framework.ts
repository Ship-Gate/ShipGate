/**
 * Framework and ORM auto-detection.
 * Detects: Next.js, Express, Fastify, Hono, Koa, NestJS, and ORMs (Prisma, Mongoose, Drizzle, TypeORM).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkDetection, WebFramework, OrmType } from './types.js';

export async function detectFramework(projectRoot: string): Promise<FrameworkDetection> {
  const pkgPath = path.join(projectRoot, 'package.json');
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};

  try {
    const content = await fs.promises.readFile(pkgPath, 'utf-8');
    pkg = JSON.parse(content) as typeof pkg;
  } catch {
    return {
      web: 'unknown',
      orm: 'unknown',
      details: { error: 'Could not read package.json' },
    };
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  const web = detectWebFramework(deps, projectRoot);
  const orm = detectOrm(deps, projectRoot);

  const details: Record<string, unknown> = {
    packageJson: pkgPath,
    hasAppRouter: false,
    hasPagesRouter: false,
    hasExpressRouter: false,
  };

  if (web === 'nextjs') {
    details.hasAppRouter = await pathExists(path.join(projectRoot, 'app'));
    details.hasPagesRouter = await pathExists(path.join(projectRoot, 'pages'));
  }

  if (web === 'express') {
    details.hasExpressRouter = await pathExists(path.join(projectRoot, 'routes')) ||
      await pathExists(path.join(projectRoot, 'src/routes'));
  }

  return { web, orm, details };
}

function detectWebFramework(
  deps: Record<string, string>,
  projectRoot: string
): WebFramework {
  if (deps['next']) return 'nextjs';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  if (deps['hono']) return 'hono';
  if (deps['@hono/node-server']) return 'hono';
  if (deps['koa']) return 'koa';
  if (deps['@nestjs/core']) return 'nestjs';

  return 'unknown';
}

function detectOrm(deps: Record<string, string>, projectRoot: string): OrmType {
  if (deps['@prisma/client'] || deps['prisma']) return 'prisma';
  if (deps['mongoose']) return 'mongoose';
  if (deps['drizzle-orm']) return 'drizzle';
  if (deps['typeorm']) return 'typeorm';
  if (deps['knex']) return 'knex';

  // Check for schema files even without explicit deps (e.g. Prisma schema)
  const prismaSchema = path.join(projectRoot, 'prisma', 'schema.prisma');
  if (fs.existsSync(prismaSchema)) return 'prisma';

  return 'unknown';
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
