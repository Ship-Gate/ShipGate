/**
 * Fly.io Deployment Adapter
 *
 * Any framework. fly.toml with health checks, auto-scaling,
 * Fly Postgres setup, Dockerfile optimized for Fly.
 */

import type { DeploymentAdapter } from './types.js';
import type { GeneratedFile } from '../types.js';
import { toKebabCase } from '../types.js';

export const FlyAdapter: DeploymentAdapter = {
  name: 'Fly.io',
  platform: 'fly',

  generateConfig(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile[] {
    const projectName = toKebabCase(spec.projectName);
    const files: GeneratedFile[] = [];

    // fly.toml
    files.push({
      path: 'fly.toml',
      content: [
        '# fly.toml - Fly.io app config',
        '# Run: fly launch (or fly deploy)',
        '',
        'app = "' + projectName + '"',
        '',
        '[build]',
        '',
        '[env]',
        '  NODE_ENV = "production"',
        '  ISL_CONTRACT_MODE = "warn"',
        '',
        '[http_service]',
        '  internal_port = 3000',
        '  force_https = true',
        '  auto_stop_machines = true',
        '  auto_start_machines = true',
        '  min_machines_running = 0',
        '  processes = ["app"]',
        '',
        '  [http_service.concurrency]',
        '    type = "requests"',
        '    hard_limit = 25',
        '    soft_limit = 20',
        '',
        '[[vm]]',
        '  memory = "256mb"',
        '  cpu_kind = "shared"',
        '  cpus = 1',
        '',
        '[[services]]',
        '  protocol = "tcp"',
        '  internal_port = 3000',
        '',
        '  [[services.ports]]',
        '    port = 80',
        '    handlers = ["http"]',
        '',
        '  [[services.ports]]',
        '    port = 443',
        '    handlers = ["tls", "http"]',
        '',
        '  [services.concurrency]',
        '    type = "connections"',
        '    hard_limit = 25',
        '    soft_limit = 20',
        '',
        '  [[services.http_checks]]',
        '    interval = "10s"',
        '    timeout = "2s"',
        '    grace_period = "5s"',
        '    method = "GET"',
        '    path = "/"',
      ].join('\n'),
      layer: 'config',
    });

    // Dockerfile for Fly (litefs for SQLite, or standard for Postgres)
    const dockerfileContent =
      db === 'sqlite'
        ? [
            '# Fly.io + SQLite (LiteFS)',
            'FROM node:20-alpine AS builder',
            'WORKDIR /app',
            'COPY package*.json ./',
            'RUN npm ci',
            'COPY . .',
            'RUN npx prisma generate',
            'RUN npm run build',
            '',
            'FROM node:20-alpine',
            'WORKDIR /app',
            'ENV NODE_ENV=production',
            'COPY --from=builder /app/dist ./dist',
            'COPY --from=builder /app/node_modules ./node_modules',
            'COPY --from=builder /app/package.json ./',
            'COPY --from=builder /app/prisma ./prisma',
            'EXPOSE 3000',
            'CMD ["node", "dist/server.js"]',
          ].join('\n')
        : [
            '# Fly.io + Postgres',
            'FROM node:20-alpine AS builder',
            'WORKDIR /app',
            'COPY package*.json ./',
            'RUN npm ci',
            'COPY . .',
            'RUN npx prisma generate',
            'RUN npm run build',
            '',
            'FROM node:20-alpine',
            'WORKDIR /app',
            'ENV NODE_ENV=production',
            'COPY --from=builder /app/dist ./dist',
            'COPY --from=builder /app/node_modules ./node_modules',
            'COPY --from=builder /app/package.json ./',
            'COPY --from=builder /app/prisma ./prisma',
            'EXPOSE 3000',
            'CMD ["node", "dist/server.js"]',
          ].join('\n');

    files.push({
      path: 'Dockerfile',
      content: dockerfileContent,
      layer: 'scaffold',
    });

    // Fly Postgres setup instructions
    files.push({
      path: 'DEPLOY_FLY.md',
      content: [
        '# Deploy to Fly.io',
        '',
        '## Prerequisites',
        '',
        '```bash',
        'curl -L https://fly.io/install.sh | sh',
        'fly auth login',
        '```',
        '',
        db === 'postgres'
          ? [
              '## Fly Postgres',
              '',
              '```bash',
              'fly postgres create',
              '# Attach to app:',
              'fly postgres attach <postgres-app-name>',
              '# DATABASE_URL is auto-set',
              'fly deploy',
              '```',
              '',
              'Or use external Postgres (Neon, Supabase, etc.) and set DATABASE_URL.',
              '',
            ].join('\n')
          : [
              '## SQLite',
              '',
              'SQLite works on Fly with a persistent volume. Add to fly.toml:',
              '',
              '```toml',
              '[[mounts]]',
              '  source = "data"',
              '  destination = "/data"',
              '```',
              '',
              'Then: `fly volumes create data`',
              '',
            ].join('\n'),
        '## Deploy',
        '',
        '```bash',
        'fly launch   # first time',
        'fly deploy   # subsequent deploys',
        '```',
        '',
        '## Migrations',
        '',
        '```bash',
        'fly ssh console -C "npx prisma migrate deploy"',
        '```',
        '',
      ].join('\n'),
      layer: 'config',
    });

    return files;
  },

  generateEnvTemplate(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile {
    const lines: string[] = [
      `# ${spec.projectName} — Fly.io`,
      '# Set via: fly secrets set KEY=value',
      '',
      db === 'postgres'
        ? [
            '# Fly Postgres: fly postgres attach <name>',
            '# Or external: Neon, Supabase, etc.',
            'DATABASE_URL=""',
          ].join('\n')
        : 'DATABASE_URL="file:/data/sqlite.db"',
      '',
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
    return 'fly deploy';
  },

  getRequirements(): string[] {
    return ['Fly.io account', 'flyctl CLI', 'Postgres: fly postgres create OR external DB'];
  },
};
