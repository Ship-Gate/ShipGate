/**
 * Docker Deployment Adapter
 *
 * Any framework. Multi-stage Dockerfile, docker-compose.yml,
 * .dockerignore, docker-compose.prod.yml override.
 */

import type { DeploymentAdapter } from './types.js';
import type { GeneratedFile } from '../types.js';
import { toKebabCase } from '../types.js';

export const DockerAdapter: DeploymentAdapter = {
  name: 'Docker',
  platform: 'docker',

  generateConfig(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile[] {
    const projectName = toKebabCase(spec.projectName);
    const dbName = toKebabCase(spec.domainName);
    const files: GeneratedFile[] = [];

    // Multi-stage Dockerfile
    files.push({
      path: 'Dockerfile',
      content: [
        '# ─── Build Stage ────────────────────────────────────────────────────────────',
        'FROM node:20-alpine AS deps',
        'WORKDIR /app',
        'COPY package*.json ./',
        'RUN npm ci',
        '',
        'FROM node:20-alpine AS builder',
        'WORKDIR /app',
        'COPY --from=deps /app/node_modules ./node_modules',
        'COPY . .',
        'RUN npx prisma generate',
        'RUN npm run build',
        '',
        '# ─── Production Stage ───────────────────────────────────────────────────────',
        'FROM node:20-alpine',
        'WORKDIR /app',
        'ENV NODE_ENV=production',
        'COPY --from=builder /app/dist ./dist',
        'COPY --from=builder /app/node_modules ./node_modules',
        'COPY --from=builder /app/package.json ./',
        'COPY --from=builder /app/prisma ./prisma',
        'EXPOSE 3000',
        'CMD ["node", "dist/server.js"]',
      ].join('\n'),
      layer: 'scaffold',
    });

    // docker-compose.yml
    const composeServices: string[] = [
      'version: "3.8"',
      '',
      'services:',
      `  ${projectName}:`,
      '    build: .',
      '    ports:',
      '      - "3000:3000"',
      '    environment:',
      '      - NODE_ENV=development',
      '      - ISL_CONTRACT_MODE=warn',
    ];

    if (db === 'postgres') {
      composeServices.push(
        `      - DATABASE_URL=postgresql://postgres:postgres@db:5432/${dbName}?schema=public`,
        '    depends_on:',
        '      db:',
        '        condition: service_healthy',
        '    volumes:',
        '      - ./src:/app/src',
        '',
        '  db:',
        '    image: postgres:16-alpine',
        '    environment:',
        '      POSTGRES_USER: postgres',
        '      POSTGRES_PASSWORD: postgres',
        `      POSTGRES_DB: ${dbName}`,
        '    ports:',
        '      - "5432:5432"',
        '    volumes:',
        '      - pgdata:/var/lib/postgresql/data',
        '    healthcheck:',
        '      test: ["CMD-SHELL", "pg_isready -U postgres"]',
        '      interval: 5s',
        '      timeout: 5s',
        '      retries: 5',
        '',
        'volumes:',
        '  pgdata:'
      );
    } else if (db === 'sqlite') {
      composeServices.push(
        '      - DATABASE_URL=file:./data/sqlite.db',
        '    volumes:',
        '      - ./src:/app/src',
        '      - sqlitedata:/app/data',
        '',
        'volumes:',
        '  sqlitedata:'
      );
    } else {
      composeServices.push('    volumes:', '      - ./src:/app/src');
    }

    files.push({
      path: 'docker-compose.yml',
      content: composeServices.join('\n'),
      layer: 'scaffold',
    });

    // docker-compose.prod.yml — production override
    const prodServices: string[] = [
      'version: "3.8"',
      '',
      'services:',
      `  ${projectName}:`,
      '    restart: unless-stopped',
      '    volumes: []',
    ];

    if (db === 'postgres') {
      prodServices.push(
        '',
        '  db:',
        '    restart: unless-stopped'
      );
    }

    files.push({
      path: 'docker-compose.prod.yml',
      content: prodServices.join('\n'),
      layer: 'scaffold',
    });

    // .dockerignore
    files.push({
      path: '.dockerignore',
      content: [
        'node_modules',
        'dist',
        '.git',
        '.env',
        '.env.local',
        '*.log',
        '.DS_Store',
        'coverage',
        '.turbo',
        '*.test.ts',
        '*.spec.ts',
      ].join('\n'),
      layer: 'scaffold',
    });

    return files;
  },

  generateEnvTemplate(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile {
    const lines: string[] = [
      `# ${spec.projectName} — Docker`,
      '# Copy to .env. Used by docker-compose.',
      '',
      db === 'postgres'
        ? [
            '# Local: postgresql://postgres:postgres@localhost:5432/' + toKebabCase(spec.domainName),
            '# Docker: postgresql://postgres:postgres@db:5432/' + toKebabCase(spec.domainName) + '?schema=public',
            'DATABASE_URL="postgresql://postgres:postgres@db:5432/' + toKebabCase(spec.domainName) + '?schema=public"',
          ].join('\n')
        : 'DATABASE_URL="file:./data/sqlite.db"',
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
    return 'docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d';
  },

  getRequirements(): string[] {
    return ['Docker', 'Docker Compose', 'Node 20'];
  },
};
