/**
 * Vercel Deployment Adapter
 *
 * Next.js only. Generates vercel.json, next.config.js optimizations,
 * Vercel Postgres/Neon connection config, and one-click deploy button.
 */

import type { DeploymentAdapter } from './types.js';
import type { GeneratedFile } from '../types.js';
import { toKebabCase } from '../types.js';

export const VercelAdapter: DeploymentAdapter = {
  name: 'Vercel',
  platform: 'vercel',

  generateConfig(spec: import('./types.js').ISLSpec, framework: string, db: string): GeneratedFile[] {
    if (framework !== 'nextjs') {
      return [];
    }

    const projectName = toKebabCase(spec.projectName);
    const files: GeneratedFile[] = [];

    // vercel.json
    const buildCommand = 'npm run build';
    const outputDir = '.next';

    files.push({
      path: 'vercel.json',
      content: JSON.stringify(
        {
          framework: 'nextjs',
          buildCommand,
          outputDirectory: outputDir,
          installCommand: 'npm install',
        },
        null,
        2
      ),
      layer: 'config',
    });

    // next.config.js (optimized for Vercel)
    files.push({
      path: 'next.config.js',
      content: [
        '/** @type {import("next").NextConfig} */',
        'const nextConfig = {',
        '  images: { remotePatterns: [{ protocol: "https", hostname: "**.vercel.app" }] },',
        '  async redirects() { return []; },',
        '  experimental: { serverActions: { bodySizeLimit: "2mb" } },',
        '};',
        '',
        'export default nextConfig;',
      ].join('\n'),
      layer: 'config',
    });

    // Vercel Postgres / Neon connection (if Postgres)
    if (db === 'postgres') {
      files.push({
        path: 'lib/db.ts',
        content: [
          '// Vercel Postgres or Neon — connection helper',
          '// Set DATABASE_URL in Vercel project settings',
          '// For Vercel Postgres: Add from Vercel dashboard → Storage',
          '// For Neon: https://neon.tech — copy connection string',
          '',
          'import { PrismaClient } from "@prisma/client";',
          '',
          'const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };',
          '',
          'export const prisma = globalForPrisma.prisma ?? new PrismaClient();',
          '',
          'if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;',
        ].join('\n'),
        layer: 'config',
      });
    }

    // One-click deploy button for README
    files.push({
      path: 'DEPLOY_VERCEL.md',
      content: [
        '# Deploy to Vercel',
        '',
        '[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/' +
          projectName +
          ')',
        '',
        '## Setup',
        '',
        '1. Click the button above or run `vercel` in this directory',
        '2. Add environment variables in Vercel dashboard:',
        '   - `DATABASE_URL` — Vercel Postgres or Neon connection string',
        ...(spec.envVars ?? []).map((v) => `   - \`${v}\``),
        '3. Run migrations: `vercel env pull && npx prisma migrate deploy`',
        '',
        '## Vercel Postgres',
        '',
        '1. Vercel Dashboard → Storage → Create Database → Postgres',
        '2. Connect to project, copy `POSTGRES_URL`',
        '3. Set `DATABASE_URL=$POSTGRES_URL` in env',
        '',
        '## Neon (alternative)',
        '',
        '1. Sign up at https://neon.tech',
        '2. Create project, copy connection string',
        '3. Set `DATABASE_URL` in Vercel env',
        '',
      ].join('\n'),
      layer: 'config',
    });

    return files;
  },

  generateEnvTemplate(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile {
    const lines: string[] = [
      `# ${spec.projectName} — Vercel / Next.js`,
      '# Copy to .env.local for local dev. Set in Vercel Dashboard for production.',
      '',
      '# Database (required for Postgres)',
      db === 'postgres'
        ? [
            '# Vercel Postgres: Add via Vercel Dashboard → Storage → Postgres',
            '# Neon: https://neon.tech — connection string',
            'DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"',
          ].join('\n')
        : 'DATABASE_URL=""',
      '',
      '# Runtime contract mode: strict | warn | off',
      'ISL_CONTRACT_MODE=warn',
      '',
      ...(spec.envVars ?? []).map((v) => `# ${v}\n${v}=`),
    ];

    return {
      path: '.env.example',
      content: lines.filter(Boolean).join('\n'),
      layer: 'config',
    };
  },

  getDeployCommand(): string {
    return 'vercel --prod';
  },

  getRequirements(): string[] {
    return ['Next.js project', 'Vercel account', 'DATABASE_URL (Vercel Postgres or Neon for Postgres)'];
  },
};
