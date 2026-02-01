// ============================================================================
// MSW (Mock Service Worker) Handler Generator
// ============================================================================

import type * as AST from '@intentos/isl-core';
import type { GenerateOptions, MockEndpoint, DataFactory } from '../types';

/**
 * Generate MSW handlers
 */
export function generateMswHandlers(
  endpoints: MockEndpoint[],
  factories: DataFactory[],
  options: GenerateOptions
): string {
  const lines: string[] = [];
  const basePath = options.basePath || '/api';

  // Imports
  lines.push("import { http, HttpResponse, delay } from 'msw';");
  lines.push("import { factories } from './factories';");
  lines.push('');

  // In-memory store
  if (options.persistence) {
    lines.push('// In-memory data store');
    lines.push('const store: Record<string, Map<string, unknown>> = {};');
    lines.push('');
    for (const factory of factories) {
      lines.push(`store['${factory.entityName}'] = new Map();`);
    }
    lines.push('');
  }

  // Helper functions
  if (options.includeDelay) {
    const [min, max] = options.delayRange || [100, 500];
    lines.push('// Simulate network delay');
    lines.push(`const simulateDelay = () => delay(Math.random() * ${max - min} + ${min});`);
    lines.push('');
  }

  if (options.includeErrorSimulation) {
    lines.push('// Simulate random errors');
    lines.push(`const shouldError = () => Math.random() < ${options.errorProbability || 0.1};`);
    lines.push('');
  }

  // Generate handlers
  lines.push('export const handlers = [');

  for (const endpoint of endpoints) {
    lines.push(generateMswHandler(endpoint, options, basePath));
    lines.push('');
  }

  lines.push('];');
  lines.push('');

  // Export default
  lines.push('export default handlers;');

  return lines.join('\n');
}

/**
 * Generate single MSW handler
 */
function generateMswHandler(
  endpoint: MockEndpoint,
  options: GenerateOptions,
  basePath: string
): string {
  const lines: string[] = [];
  const method = endpoint.method.toLowerCase();
  const fullPath = `${basePath}${endpoint.path.replace(/:(\w+)/g, ':$1')}`;

  lines.push(`  // ${endpoint.behaviorName}`);
  lines.push(`  http.${method}('${fullPath}', async ({ request, params }) => {`);

  // Add delay
  if (options.includeDelay) {
    lines.push('    await simulateDelay();');
    lines.push('');
  }

  // Add error simulation
  if (options.includeErrorSimulation && endpoint.errors.length > 0) {
    lines.push('    // Simulate random error');
    lines.push('    if (shouldError()) {');
    const error = endpoint.errors[0];
    lines.push(`      return HttpResponse.json(`);
    lines.push(`        { code: '${error.name}', message: 'Simulated error' },`);
    lines.push(`        { status: ${error.statusCode} }`);
    lines.push('      );');
    lines.push('    }');
    lines.push('');
  }

  // Handle different methods
  switch (endpoint.method) {
    case 'GET':
      if (endpoint.path.includes(':id')) {
        // Get by ID
        lines.push('    const { id } = params;');
        if (options.persistence) {
          lines.push(`    const item = store['${endpoint.outputType}'].get(id as string);`);
          lines.push('    if (!item) {');
          lines.push('      return HttpResponse.json(');
          lines.push("        { code: 'NOT_FOUND', message: 'Resource not found' },");
          lines.push('        { status: 404 }');
          lines.push('      );');
          lines.push('    }');
          lines.push('    return HttpResponse.json(item);');
        } else {
          lines.push(`    return HttpResponse.json(factories.${endpoint.outputType}({ id: id as string }));`);
        }
      } else {
        // List
        if (options.persistence) {
          lines.push(`    const items = Array.from(store['${endpoint.outputType}'].values());`);
          lines.push('    return HttpResponse.json(items);');
        } else {
          lines.push(`    const items = factories.${endpoint.outputType}List(10);`);
          lines.push('    return HttpResponse.json(items);');
        }
      }
      break;

    case 'POST':
      lines.push('    const body = await request.json();');
      lines.push(`    const item = factories.${endpoint.outputType}(body);`);
      if (options.persistence) {
        lines.push(`    store['${endpoint.outputType}'].set(item.id, item);`);
      }
      lines.push('    return HttpResponse.json(item, { status: 201 });');
      break;

    case 'PUT':
    case 'PATCH':
      lines.push('    const { id } = params;');
      lines.push('    const body = await request.json();');
      if (options.persistence) {
        lines.push(`    const existing = store['${endpoint.outputType}'].get(id as string);`);
        lines.push('    if (!existing) {');
        lines.push('      return HttpResponse.json(');
        lines.push("        { code: 'NOT_FOUND', message: 'Resource not found' },");
        lines.push('        { status: 404 }');
        lines.push('      );');
        lines.push('    }');
        lines.push('    const updated = { ...existing, ...body };');
        lines.push(`    store['${endpoint.outputType}'].set(id as string, updated);`);
        lines.push('    return HttpResponse.json(updated);');
      } else {
        lines.push(`    return HttpResponse.json(factories.${endpoint.outputType}({ id: id as string, ...body }));`);
      }
      break;

    case 'DELETE':
      lines.push('    const { id } = params;');
      if (options.persistence) {
        lines.push(`    const deleted = store['${endpoint.outputType}'].delete(id as string);`);
        lines.push('    if (!deleted) {');
        lines.push('      return HttpResponse.json(');
        lines.push("        { code: 'NOT_FOUND', message: 'Resource not found' },");
        lines.push('        { status: 404 }');
        lines.push('      );');
        lines.push('    }');
      }
      lines.push('    return new HttpResponse(null, { status: 204 });');
      break;
  }

  lines.push('  }),');

  return lines.join('\n');
}

/**
 * Generate MSW setup file
 */
export function generateMswSetup(options: GenerateOptions): string {
  return `// Auto-generated by @intentos/codegen-mocks
// MSW Browser Setup

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Start worker in development
if (process.env.NODE_ENV === 'development') {
  worker.start({
    onUnhandledRequest: 'bypass',
  });
}
`;
}

/**
 * Generate MSW Node setup for testing
 */
export function generateMswNodeSetup(options: GenerateOptions): string {
  return `// Auto-generated by @intentos/codegen-mocks
// MSW Node Setup for Testing

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// Setup for tests
export function setupMockServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

// Helper to add custom handlers in tests
export function addHandler(...customHandlers: Parameters<typeof server.use>) {
  server.use(...customHandlers);
}
`;
}
