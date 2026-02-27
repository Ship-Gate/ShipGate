// ============================================================================
// OpenAPIGenerator Tests (Parser AST)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '@isl-lang/parser';
import { OpenAPIGenerator, generateApiClient, normalizeDomain } from '../src/index.js';
import * as YAML from 'yaml';

const MINIMAL_ISL = `
domain Minimal {
  version: "1.0.0"
  entity User {
    id: UUID [immutable]
    email: String
  }
  behavior CreateUser {
    input { email: String }
    output { success: User }
  }
}
`;

describe('OpenAPIGenerator', () => {
  it('should generate OpenAPI from parser AST', () => {
    const result = parse(MINIMAL_ISL, 'test.isl');
    expect(result.domain).toBeDefined();
    if (!result.domain) return;

    const generator = new OpenAPIGenerator({ format: 'json' });
    const files = generator.generate(result.domain);

    expect(files.length).toBe(1);
    expect(files[0].path).toBe('openapi.json');
    const spec = JSON.parse(files[0].content);
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toContain('Minimal');
    expect(spec.components.schemas.User).toBeDefined();
  });

  it('should include default servers when enabled', () => {
    const result = parse(MINIMAL_ISL, 'test.isl');
    if (!result.domain) return;

    const generator = new OpenAPIGenerator({
      format: 'json',
      defaultServers: true,
    });
    const files = generator.generate(result.domain);
    const spec = JSON.parse(files[0].content);

    expect(spec.servers).toBeDefined();
    expect(spec.servers.length).toBeGreaterThan(0);
    expect(spec.servers[0].url).toContain('localhost');
  });

  it('should add Bearer auth when explicitly provided in options', () => {
    const result = parse(MINIMAL_ISL, 'test.isl');
    if (!result.domain) return;

    const generator = new OpenAPIGenerator({
      format: 'json',
      auth: [{ type: 'http', name: 'bearerAuth', scheme: 'bearer' }],
    });
    const files = generator.generate(result.domain);
    const spec = JSON.parse(files[0].content);

    expect(spec.components.securitySchemes).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
  });
});

describe('normalizeDomain', () => {
  it('should normalize parser Domain to generator format', () => {
    const result = parse(MINIMAL_ISL, 'test.isl');
    expect(result.domain).toBeDefined();
    if (!result.domain) return;

    const normalized = normalizeDomain(result.domain);
    expect(normalized.name).toBe('Minimal');
    expect(normalized.version).toBe('1.0.0');
    expect(normalized.entities.length).toBe(1);
    expect(normalized.entities[0].name).toBe('User');
    expect(normalized.behaviors.length).toBe(1);
    expect(normalized.behaviors[0].name).toBe('CreateUser');
  });
});

describe('generateApiClient', () => {
  it('should generate typed fetch client from OpenAPI spec', () => {
    const spec = {
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            summary: 'List users',
            parameters: [{ name: 'page', in: 'query' }],
            responses: { '200': { description: 'OK' } },
          },
          post: {
            operationId: 'createUser',
            summary: 'Create user',
            requestBody: { content: { 'application/json': { schema: {} } } },
            responses: { '201': { description: 'Created' } },
          },
        },
        '/users/{id}': {
          get: {
            operationId: 'getUser',
            parameters: [{ name: 'id', in: 'path', required: true }],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const client = generateApiClient(spec, { baseUrl: '/api' });
    expect(client).toContain('listUsers');
    expect(client).toContain('createUser');
    expect(client).toContain('getUser');
    expect(client).toContain('BASE_URL');
    expect(client).toContain('request');
  });
});
