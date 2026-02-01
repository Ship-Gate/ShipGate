/**
 * Server Generator
 * 
 * Generates a complete server from ISL specs.
 */

import type { GeneratedFile, DomainSpec } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface ServerOptions {
  /** Server framework */
  framework: 'express' | 'fastify' | 'hono' | 'nest';
  /** API type */
  apiType: 'rest' | 'graphql' | 'both';
  /** Include Docker configuration */
  docker?: boolean;
  /** Include database setup */
  database?: 'postgres' | 'mysql' | 'mongodb' | 'none';
  /** Output prefix */
  outputPrefix?: string;
}

// ============================================================================
// Server Generator
// ============================================================================

export class ServerGenerator {
  private options: Required<ServerOptions>;

  constructor(options: ServerOptions) {
    this.options = {
      framework: options.framework,
      apiType: options.apiType,
      docker: options.docker ?? true,
      database: options.database ?? 'none',
      outputPrefix: options.outputPrefix ?? '',
    };
  }

  /**
   * Generate complete server
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // Main entry point
    files.push({
      path: `${this.options.outputPrefix}index.ts`,
      content: this.generateEntryPoint(domain),
      type: 'config',
    });

    // Package.json
    files.push({
      path: `${this.options.outputPrefix}package.json`,
      content: this.generatePackageJson(domain),
      type: 'config',
    });

    // Environment config
    files.push({
      path: `${this.options.outputPrefix}.env.example`,
      content: this.generateEnvExample(),
      type: 'config',
    });

    // Docker files
    if (this.options.docker) {
      files.push({
        path: `${this.options.outputPrefix}Dockerfile`,
        content: this.generateDockerfile(),
        type: 'config',
      });
      files.push({
        path: `${this.options.outputPrefix}docker-compose.yml`,
        content: this.generateDockerCompose(domain),
        type: 'config',
      });
    }

    return files;
  }

  /**
   * Generate entry point
   */
  private generateEntryPoint(domain: DomainSpec): string {
    switch (this.options.framework) {
      case 'express':
        return this.generateExpressEntry(domain);
      case 'fastify':
        return this.generateFastifyEntry(domain);
      case 'hono':
        return this.generateHonoEntry(domain);
      default:
        return this.generateExpressEntry(domain);
    }
  }

  private generateExpressEntry(domain: DomainSpec): string {
    return `/**
 * ${domain.name} API Server
 * Generated from ISL specification
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', domain: '${domain.name}', version: '${domain.version}' });
});

// API routes
app.use('/api', routes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
});

// Start server
app.listen(port, () => {
  console.log(\`🚀 ${domain.name} API running on port \${port}\`);
});

export default app;
`;
  }

  private generateFastifyEntry(domain: DomainSpec): string {
    return `/**
 * ${domain.name} API Server
 * Generated from ISL specification
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { routes } from './routes.js';

const app = Fastify({ logger: true });
const port = parseInt(process.env.PORT || '3000');

// Plugins
await app.register(cors);

// Health check
app.get('/health', async () => ({
  status: 'ok',
  domain: '${domain.name}',
  version: '${domain.version}'
}));

// API routes
await app.register(routes, { prefix: '/api' });

// Start server
try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(\`🚀 ${domain.name} API running on port \${port}\`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
`;
  }

  private generateHonoEntry(domain: DomainSpec): string {
    return `/**
 * ${domain.name} API Server
 * Generated from ISL specification
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import routes from './routes.js';

const app = new Hono();
const port = parseInt(process.env.PORT || '3000');

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', (c) => c.json({
  status: 'ok',
  domain: '${domain.name}',
  version: '${domain.version}'
}));

// API routes
app.route('/api', routes);

// Start server
console.log(\`🚀 ${domain.name} API running on port \${port}\`);
serve({ fetch: app.fetch, port });
`;
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(domain: DomainSpec): string {
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {
      '@types/node': '^20.10.0',
      'typescript': '^5.3.0',
    };

    switch (this.options.framework) {
      case 'express':
        deps['express'] = '^4.18.0';
        deps['cors'] = '^2.8.0';
        deps['helmet'] = '^7.1.0';
        devDeps['@types/express'] = '^4.17.0';
        devDeps['@types/cors'] = '^2.8.0';
        break;
      case 'fastify':
        deps['fastify'] = '^4.25.0';
        deps['@fastify/cors'] = '^8.4.0';
        break;
      case 'hono':
        deps['hono'] = '^3.12.0';
        deps['@hono/node-server'] = '^1.4.0';
        break;
    }

    if (this.options.database === 'postgres') {
      deps['pg'] = '^8.11.0';
      deps['drizzle-orm'] = '^0.29.0';
    }

    return JSON.stringify({
      name: `@${domain.name.toLowerCase()}/api`,
      version: domain.version,
      type: 'module',
      scripts: {
        build: 'tsc',
        start: 'node dist/index.js',
        dev: 'tsx watch src/index.ts',
      },
      dependencies: deps,
      devDependencies: devDeps,
    }, null, 2);
  }

  /**
   * Generate .env.example
   */
  private generateEnvExample(): string {
    const lines = [
      '# Server',
      'PORT=3000',
      'NODE_ENV=development',
      '',
      '# Authentication',
      'JWT_SECRET=your-secret-key',
      '',
    ];

    if (this.options.database === 'postgres') {
      lines.push('# Database');
      lines.push('DATABASE_URL=postgres://user:pass@localhost:5432/dbname');
    }

    return lines.join('\n');
  }

  /**
   * Generate Dockerfile
   */
  private generateDockerfile(): string {
    return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;
  }

  /**
   * Generate docker-compose.yml
   */
  private generateDockerCompose(domain: DomainSpec): string {
    const services: Record<string, unknown> = {
      api: {
        build: '.',
        ports: ['3000:3000'],
        environment: ['NODE_ENV=production'],
      },
    };

    if (this.options.database === 'postgres') {
      services['api'] = {
        ...services['api'] as object,
        depends_on: ['db'],
        environment: [
          'NODE_ENV=production',
          'DATABASE_URL=postgres://user:pass@db:5432/app',
        ],
      };
      services['db'] = {
        image: 'postgres:16-alpine',
        environment: {
          POSTGRES_USER: 'user',
          POSTGRES_PASSWORD: 'pass',
          POSTGRES_DB: 'app',
        },
        volumes: ['pgdata:/var/lib/postgresql/data'],
      };
    }

    return `version: '3.8'
services:
${Object.entries(services).map(([name, config]) => {
  return `  ${name}:\n${this.objectToYaml(config as object, 4)}`;
}).join('\n')}
${this.options.database === 'postgres' ? '\nvolumes:\n  pgdata:' : ''}
`;
  }

  private objectToYaml(obj: object, indent: number): string {
    return Object.entries(obj).map(([key, value]) => {
      const spaces = ' '.repeat(indent);
      if (Array.isArray(value)) {
        return `${spaces}${key}:\n${value.map(v => `${spaces}  - ${v}`).join('\n')}`;
      }
      if (typeof value === 'object' && value !== null) {
        return `${spaces}${key}:\n${this.objectToYaml(value as object, indent + 2)}`;
      }
      return `${spaces}${key}: ${value}`;
    }).join('\n');
  }
}

export function generateServer(domain: DomainSpec, options: ServerOptions): GeneratedFile[] {
  return new ServerGenerator(options).generate(domain);
}
