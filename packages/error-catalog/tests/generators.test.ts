/**
 * Generator tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorCatalog } from '../src/catalog.js';
import { MarkdownGenerator } from '../src/generators/markdown.js';
import { JsonGenerator } from '../src/generators/json.js';
import { TypeScriptGenerator } from '../src/generators/typescript.js';
import { OpenAPIGenerator } from '../src/generators/openapi.js';
import type { ErrorDefinition } from '../src/types.js';

const sampleErrors: ErrorDefinition[] = [
  {
    id: 'DUPLICATE_EMAIL',
    code: 'AUTH_001',
    domain: 'auth',
    httpStatus: 409,
    message: 'Email already exists',
    description: 'The email address is already registered in the system.',
    retriable: false,
    severity: 'error',
    causes: [
      'User attempts to register with an existing email',
      'Admin creates user with duplicate email',
    ],
    resolutions: [
      'Use a different email address',
      'Reset password for existing account',
    ],
    relatedErrors: ['RATE_LIMITED'],
    metadata: {},
    tags: ['auth', 'registration'],
    example: {
      response: {
        status: 409,
        body: {
          error: {
            code: 'AUTH_001',
            type: 'DUPLICATE_EMAIL',
            message: 'Email already exists',
            details: { email: 'user@example.com' },
          },
        },
      },
    },
  },
  {
    id: 'RATE_LIMITED',
    code: 'AUTH_002',
    domain: 'auth',
    httpStatus: 429,
    message: 'Too many requests',
    description: 'Rate limit exceeded. Wait before retrying.',
    retriable: true,
    retryAfter: 60,
    severity: 'warning',
    causes: ['Too many API requests in short time'],
    resolutions: ['Wait for retry-after duration', 'Implement exponential backoff'],
    relatedErrors: [],
    metadata: {},
    tags: ['auth', 'rate-limit'],
  },
];

describe('MarkdownGenerator', () => {
  let catalog: ErrorCatalog;

  beforeEach(() => {
    catalog = new ErrorCatalog(sampleErrors);
  });

  it('should generate markdown output', async () => {
    const generator = new MarkdownGenerator({
      outputDir: './output',
    });

    const outputs = await generator.generate(catalog);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].type).toBe('markdown');
    expect(outputs[0].path).toContain('errors.md');
  });

  it('should include error details', async () => {
    const generator = new MarkdownGenerator({
      outputDir: './output',
      includeExamples: true,
    });

    const outputs = await generator.generate(catalog);
    const content = outputs[0].content;

    expect(content).toContain('DUPLICATE_EMAIL');
    expect(content).toContain('AUTH_001');
    expect(content).toContain('409');
    expect(content).toContain('Conflict');
    expect(content).toContain('Email already exists');
  });

  it('should include causes and resolutions', async () => {
    const generator = new MarkdownGenerator({
      outputDir: './output',
    });

    const outputs = await generator.generate(catalog);
    const content = outputs[0].content;

    expect(content).toContain('User attempts to register');
    expect(content).toContain('Use a different email');
  });

  it('should split by group when configured', async () => {
    const generator = new MarkdownGenerator({
      outputDir: './output',
      splitByGroup: true,
    });

    const outputs = await generator.generate(catalog);

    expect(outputs.length).toBeGreaterThan(1);
    expect(outputs.some((o) => o.path.includes('index.md'))).toBe(true);
    expect(outputs.some((o) => o.path.includes('auth.md'))).toBe(true);
  });
});

describe('JsonGenerator', () => {
  let catalog: ErrorCatalog;

  beforeEach(() => {
    catalog = new ErrorCatalog(sampleErrors);
  });

  it('should generate JSON output', async () => {
    const generator = new JsonGenerator({
      outputFile: './output/errors.json',
    });

    const outputs = await generator.generate(catalog);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].type).toBe('json');

    const json = JSON.parse(outputs[0].content);
    expect(json.errors).toHaveLength(2);
    expect(json.stats.totalErrors).toBe(2);
  });

  it('should include index', async () => {
    const generator = new JsonGenerator({
      outputFile: './output/errors.json',
    });

    const outputs = await generator.generate(catalog);
    const json = JSON.parse(outputs[0].content);

    expect(json.index.byId['DUPLICATE_EMAIL']).toBe(0);
    expect(json.index.byCode['AUTH_001']).toBe(0);
  });

  it('should format output when pretty is true', async () => {
    const generator = new JsonGenerator({
      outputFile: './output/errors.json',
      pretty: true,
    });

    const outputs = await generator.generate(catalog);

    expect(outputs[0].content).toContain('\n');
    expect(outputs[0].content).toContain('  ');
  });
});

describe('TypeScriptGenerator', () => {
  let catalog: ErrorCatalog;

  beforeEach(() => {
    catalog = new ErrorCatalog(sampleErrors);
  });

  it('should generate TypeScript output', async () => {
    const generator = new TypeScriptGenerator({
      outputFile: './output/errors.ts',
    });

    const outputs = await generator.generate(catalog);

    expect(outputs).toHaveLength(1);
    expect(outputs[0].type).toBe('typescript');
  });

  it('should generate error code enum', async () => {
    const generator = new TypeScriptGenerator({
      outputFile: './output/errors.ts',
    });

    const outputs = await generator.generate(catalog);
    const content = outputs[0].content;

    expect(content).toContain('export enum ErrorCode');
    expect(content).toContain("DUPLICATE_EMAIL = 'AUTH_001'");
    expect(content).toContain("RATE_LIMITED = 'AUTH_002'");
  });

  it('should generate error classes', async () => {
    const generator = new TypeScriptGenerator({
      outputFile: './output/errors.ts',
      generateClasses: true,
    });

    const outputs = await generator.generate(catalog);
    const content = outputs[0].content;

    expect(content).toContain('export class DuplicateEmailError extends ApiError');
    expect(content).toContain('export class RateLimitedError extends ApiError');
  });

  it('should generate type guards', async () => {
    const generator = new TypeScriptGenerator({
      outputFile: './output/errors.ts',
      generateTypeGuards: true,
    });

    const outputs = await generator.generate(catalog);
    const content = outputs[0].content;

    expect(content).toContain('export function isDuplicateEmailError');
    expect(content).toContain('error is DuplicateEmailError');
  });

  it('should generate factory functions', async () => {
    const generator = new TypeScriptGenerator({
      outputFile: './output/errors.ts',
      generateFactories: true,
    });

    const outputs = await generator.generate(catalog);
    const content = outputs[0].content;

    expect(content).toContain('export namespace Errors');
    expect(content).toContain('export function duplicateEmail');
  });
});

describe('OpenAPIGenerator', () => {
  let catalog: ErrorCatalog;

  beforeEach(() => {
    catalog = new ErrorCatalog(sampleErrors);
  });

  it('should generate OpenAPI output', async () => {
    const generator = new OpenAPIGenerator({
      outputFile: './output/errors.json',
    });

    const outputs = await generator.generate(catalog);

    expect(outputs).toHaveLength(1);
    const spec = JSON.parse(outputs[0].content);

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.components.schemas).toBeDefined();
  });

  it('should include error schemas', async () => {
    const generator = new OpenAPIGenerator({
      outputFile: './output/errors.json',
      includeSchemas: true,
    });

    const outputs = await generator.generate(catalog);
    const spec = JSON.parse(outputs[0].content);

    expect(spec.components.schemas['DuplicateEmailError']).toBeDefined();
    expect(spec.components.schemas['RateLimitedError']).toBeDefined();
  });

  it('should include response definitions', async () => {
    const generator = new OpenAPIGenerator({
      outputFile: './output/errors.json',
      includeResponses: true,
    });

    const outputs = await generator.generate(catalog);
    const spec = JSON.parse(outputs[0].content);

    expect(spec.components.responses['Error409']).toBeDefined();
    expect(spec.components.responses['Error429']).toBeDefined();
  });

  it('should generate YAML when filename ends with .yaml', async () => {
    const generator = new OpenAPIGenerator({
      outputFile: './output/errors.yaml',
    });

    const outputs = await generator.generate(catalog);

    expect(outputs[0].type).toBe('yaml');
    expect(outputs[0].content).not.toContain('{');
  });
});
