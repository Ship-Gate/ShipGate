import { Hono } from 'hono';
import { z } from 'zod';
import { VerifyRequestSchema, VerifyResponseSchema } from './routes/verify.js';
import { GateRequestSchema, GateResponseSchema } from './routes/gate.js';
import { ScanRequestSchema, ScanResponseSchema } from './routes/scan.js';

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: (schema as z.ZodEnum<[string, ...string[]]>).options };
  }
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema.removeDefault());
  }

  return { type: 'string' };
}

function makeEndpoint(
  method: string,
  path: string,
  summary: string,
  description: string,
  requestSchema: z.ZodType | null,
  responseSchema: z.ZodType,
  tags: string[],
) {
  const endpoint: Record<string, unknown> = {
    summary,
    description,
    tags,
    responses: {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: zodToJsonSchema(responseSchema),
          },
        },
      },
      '400': {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string' } },
            },
          },
        },
      },
      '429': {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                retryAfter: { type: 'number' },
              },
            },
          },
        },
      },
      '500': {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { error: { type: 'string' } },
            },
          },
        },
      },
    },
  };

  if (requestSchema) {
    endpoint.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: zodToJsonSchema(requestSchema),
        },
      },
    };
  }

  if (method === 'get') {
    delete (endpoint.responses as Record<string, unknown>)['400'];
  }

  return { [method]: endpoint };
}

export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'ShipGate Verification API',
    version: '1.0.0',
    description:
      'Hosted API for code verification, security scanning, and gate decisions powered by ShipGate.',
    contact: {
      name: 'ShipGate',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development',
    },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'sg_key_*',
        description: 'API key with sg_key_ prefix',
      },
    },
  },
  paths: {
    '/api/v1/verify': makeEndpoint(
      'post',
      '/api/v1/verify',
      'Verify source code',
      'Verify source code against optional ISL spec. Runs security scanning and returns a SHIP/NO_SHIP verdict.',
      VerifyRequestSchema,
      VerifyResponseSchema,
      ['Verification'],
    ),
    '/api/v1/gate': makeEndpoint(
      'post',
      '/api/v1/gate',
      'Run gate checks',
      'Run all specless checks against provided files. Returns verdict with signals and evidence.',
      GateRequestSchema,
      GateResponseSchema,
      ['Gate'],
    ),
    '/api/v1/scan': makeEndpoint(
      'post',
      '/api/v1/scan',
      'Scan for vulnerabilities',
      'Run security scanner, taint tracker, and hallucination scanner on source code.',
      ScanRequestSchema,
      ScanResponseSchema,
      ['Scanning'],
    ),
    '/api/v1/health': makeEndpoint(
      'get',
      '/api/v1/health',
      'Health check',
      'Returns server status, version, uptime, and available detectors.',
      null,
      z.object({
        status: z.literal('ok'),
        version: z.string(),
        uptime: z.number(),
        detectors: z.array(z.string()),
      }),
      ['System'],
    ),
    '/api/v1/openapi.json': makeEndpoint(
      'get',
      '/api/v1/openapi.json',
      'OpenAPI specification',
      'Returns the OpenAPI 3.1 specification for this API.',
      null,
      z.object({}),
      ['System'],
    ),
  },
};

const app = new Hono();

app.get('/api/v1/openapi.json', (c) => {
  return c.json(openapiSpec);
});

export default app;
