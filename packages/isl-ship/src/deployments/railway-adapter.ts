/**
 * Railway Deployment Adapter
 *
 * Any framework. railway.toml, Procfile, Postgres provisioning instructions.
 */

import type { DeploymentAdapter } from './types.js';
import type { GeneratedFile } from '../types.js';
import { toKebabCase } from '../types.js';

export const RailwayAdapter: DeploymentAdapter = {
  name: 'Railway',
  platform: 'railway',

  generateConfig(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile[] {
    const projectName = toKebabCase(spec.projectName);
    const files: GeneratedFile[] = [];

    // railway.toml
    files.push({
      path: 'railway.toml',
      content: [
        '[build]',
        'builder = "nixpacks"',
        '',
        '[deploy]',
        'startCommand = "npm run start"',
        'restartPolicyType = "on_failure"',
        'restartPolicyMaxRetries = 3',
        '',
        '[build.nixpacks]',
        'providers = ["node"]',
      ].join('\n'),
      layer: 'config',
    });

    // Procfile
    files.push({
      path: 'Procfile',
      content: 'web: npm run start\n',
      layer: 'config',
    });

    // Railway Postgres instructions
    files.push({
      path: 'DEPLOY_RAILWAY.md',
      content: [
        '# Deploy to Railway',
        '',
        '## Quick Start',
        '',
        '```bash',
        'npm i -g @railway/cli',
        'railway login',
        'railway init',
        'railway up',
        '```',
        '',
        '## Railway Postgres',
        '',
        '1. Railway Dashboard → New Project → Add Postgres',
        '2. Connect your app to the Postgres service',
        '3. Railway auto-sets `DATABASE_URL`',
        '4. Run migrations: `railway run npx prisma migrate deploy`',
        '',
        '## Environment Variables',
        '',
        'Set in Railway Dashboard → Variables:',
        '',
        '- `DATABASE_URL` — Auto-set when Postgres is added',
        '- `ISL_CONTRACT_MODE` — `warn` (default) or `strict` or `off`',
        ...(spec.envVars ?? []).map((v) => `- \`${v}\``),
        '',
        '## Deploy',
        '',
        '```bash',
        'railway up',
        '```',
        '',
        'Or connect GitHub for automatic deploys.',
        '',
      ].join('\n'),
      layer: 'config',
    });

    return files;
  },

  generateEnvTemplate(spec: import('./types.js').ISLSpec, _framework: string, db: string): GeneratedFile {
    const lines: string[] = [
      `# ${spec.projectName} — Railway`,
      '# Set these in Railway Dashboard → Variables',
      '',
      db === 'postgres'
        ? [
            '# Railway Postgres: Add Postgres plugin, DATABASE_URL is auto-set',
            'DATABASE_URL=""',
          ].join('\n')
        : 'DATABASE_URL=""',
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
    return 'railway up';
  },

  getRequirements(): string[] {
    return ['Railway account', 'Railway CLI (optional)', 'Postgres plugin for database'];
  },
};
