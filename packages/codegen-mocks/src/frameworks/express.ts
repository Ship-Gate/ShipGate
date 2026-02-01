// ============================================================================
// Express Mock Server Generator
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type { GenerateOptions, MockEndpoint, DataFactory } from '../types';

/**
 * Generate Express mock server
 */
export function generateExpressServer(
  endpoints: MockEndpoint[],
  factories: DataFactory[],
  options: GenerateOptions
): string {
  const lines: string[] = [];
  const port = options.port || 3001;
  const basePath = options.basePath || '/api';

  // Imports
  lines.push("import express from 'express';");
  lines.push("import cors from 'cors';");
  lines.push("import { factories } from './factories';");
  lines.push('');

  // App setup
  lines.push('const app = express();');
  lines.push('app.use(cors());');
  lines.push('app.use(express.json());');
  lines.push('');

  // In-memory store
  if (options.persistence) {
    lines.push('// In-memory data store');
    lines.push('const store: Record<string, Map<string, unknown>> = {};');
    for (const factory of factories) {
      lines.push(`store['${factory.entityName}'] = new Map();`);
    }
    lines.push('');
  }

  // Middleware for delay
  if (options.includeDelay) {
    const [min, max] = options.delayRange || [100, 500];
    lines.push('// Delay middleware');
    lines.push('app.use((req, res, next) => {');
    lines.push(`  const delay = Math.random() * ${max - min} + ${min};`);
    lines.push('  setTimeout(next, delay);');
    lines.push('});');
    lines.push('');
  }

  // Error simulation middleware
  if (options.includeErrorSimulation) {
    lines.push('// Random error middleware');
    lines.push('app.use((req, res, next) => {');
    lines.push(`  if (Math.random() < ${options.errorProbability || 0.1}) {`);
    lines.push("    return res.status(500).json({ code: 'RANDOM_ERROR', message: 'Simulated error' });");
    lines.push('  }');
    lines.push('  next();');
    lines.push('});');
    lines.push('');
  }

  // Generate routes
  lines.push(`// API Routes`);
  for (const endpoint of endpoints) {
    lines.push(generateExpressRoute(endpoint, options, basePath));
    lines.push('');
  }

  // Start server
  lines.push('// Start server');
  lines.push(`const PORT = process.env.PORT || ${port};`);
  lines.push('app.listen(PORT, () => {');
  lines.push('  console.log(`Mock server running on http://localhost:${PORT}`);');
  lines.push('});');
  lines.push('');
  lines.push('export default app;');

  return lines.join('\n');
}

/**
 * Generate single Express route
 */
function generateExpressRoute(
  endpoint: MockEndpoint,
  options: GenerateOptions,
  basePath: string
): string {
  const lines: string[] = [];
  const method = endpoint.method.toLowerCase();
  const fullPath = `${basePath}${endpoint.path}`;

  lines.push(`// ${endpoint.behaviorName}`);
  lines.push(`app.${method}('${fullPath}', (req, res) => {`);

  switch (endpoint.method) {
    case 'GET':
      if (endpoint.path.includes(':id')) {
        lines.push('  const { id } = req.params;');
        if (options.persistence) {
          lines.push(`  const item = store['${endpoint.outputType}'].get(id);`);
          lines.push('  if (!item) {');
          lines.push("    return res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found' });");
          lines.push('  }');
          lines.push('  res.json(item);');
        } else {
          lines.push(`  res.json(factories.${endpoint.outputType}({ id }));`);
        }
      } else {
        if (options.persistence) {
          lines.push(`  const items = Array.from(store['${endpoint.outputType}'].values());`);
          lines.push('  res.json(items);');
        } else {
          lines.push(`  res.json(factories.${endpoint.outputType}List(10));`);
        }
      }
      break;

    case 'POST':
      lines.push(`  const item = factories.${endpoint.outputType}(req.body);`);
      if (options.persistence) {
        lines.push(`  store['${endpoint.outputType}'].set(item.id, item);`);
      }
      lines.push('  res.status(201).json(item);');
      break;

    case 'PUT':
    case 'PATCH':
      lines.push('  const { id } = req.params;');
      if (options.persistence) {
        lines.push(`  const existing = store['${endpoint.outputType}'].get(id);`);
        lines.push('  if (!existing) {');
        lines.push("    return res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found' });");
        lines.push('  }');
        lines.push('  const updated = { ...existing, ...req.body };');
        lines.push(`  store['${endpoint.outputType}'].set(id, updated);`);
        lines.push('  res.json(updated);');
      } else {
        lines.push(`  res.json(factories.${endpoint.outputType}({ id, ...req.body }));`);
      }
      break;

    case 'DELETE':
      lines.push('  const { id } = req.params;');
      if (options.persistence) {
        lines.push(`  const deleted = store['${endpoint.outputType}'].delete(id);`);
        lines.push('  if (!deleted) {');
        lines.push("    return res.status(404).json({ code: 'NOT_FOUND', message: 'Resource not found' });");
        lines.push('  }');
      }
      lines.push('  res.status(204).send();');
      break;
  }

  lines.push('});');

  return lines.join('\n');
}

/**
 * Generate package.json for standalone mock server
 */
export function generateExpressPackageJson(options: GenerateOptions): string {
  return JSON.stringify(
    {
      name: 'mock-server',
      version: '1.0.0',
      private: true,
      scripts: {
        start: 'ts-node server.ts',
        dev: 'ts-node-dev server.ts',
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.0',
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/cors': '^2.8.0',
        'ts-node': '^10.9.0',
        'ts-node-dev': '^2.0.0',
        typescript: '^5.0.0',
      },
    },
    null,
    2
  );
}
