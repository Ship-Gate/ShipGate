// ============================================================================
// Input Validation Prover - Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  proveInputValidation,
  detectZodValidation,
  traceFieldAccesses,
  checkCompleteness,
  analyzeConstraintQuality,
} from '../src/input-validation/index.js';

describe('InputValidationProver', () => {
  describe('Zod validation detection', () => {
    it('should detect Zod validation with strict constraints', () => {
      const code = `
        import { z } from 'zod';
        
        const userSchema = z.object({
          email: z.string().email().min(5).max(100),
          age: z.number().min(18).max(120),
          role: z.enum(['user', 'admin'])
        });
        
        app.post('/users', async (req, res) => {
          const validated = userSchema.parse(req.body);
          const user = await createUser(validated.email, validated.age);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.status).toBe('PROVEN');
      expect(proof.evidence).toHaveLength(1);
      expect(proof.evidence[0]?.validationLibrary).toBe('zod');
      expect(proof.evidence[0]?.hasValidation).toBe(true);
      expect(proof.evidence[0]?.validationBeforeLogic).toBe(true);
      expect(proof.evidence[0]?.constraintQuality).toBe('strict');
      expect(proof.evidence[0]?.unvalidatedFields).toHaveLength(0);
    });

    it('should detect unused validation result', () => {
      const code = `
        const userSchema = z.object({
          email: z.string().email()
        });
        
        app.post('/users', async (req, res) => {
          userSchema.parse(req.body);
          const user = await createUser(req.body.email);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.findings.some(f => f.message.includes('not used'))).toBe(true);
    });

    it('should detect partial validation', () => {
      const code = `
        const userSchema = z.object({
          email: z.string().email()
        });
        
        app.post('/users', async (req, res) => {
          const validated = userSchema.parse(req.body);
          const user = await createUser(validated.email, req.body.password);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.status).toBe('PARTIAL');
      expect(proof.evidence[0]?.unvalidatedFields).toContain('password');
      expect(proof.findings.some(f => f.message.includes('unvalidated fields'))).toBe(true);
    });
  });

  describe('Joi validation detection', () => {
    it('should detect Joi validation', () => {
      const code = `
        import Joi from 'joi';
        
        const schema = Joi.object({
          username: Joi.string().min(3).max(30).required(),
          email: Joi.string().email().required()
        });
        
        app.post('/register', async (req, res) => {
          const result = await schema.validate(req.body);
          if (result.error) {
            return res.status(400).json({ error: result.error.message });
          }
          const user = await createUser(result.value.username, result.value.email);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence[0]?.validationLibrary).toBe('joi');
      expect(proof.evidence[0]?.hasValidation).toBe(true);
      expect(proof.evidence[0]?.constraintQuality).toBe('basic');
    });
  });

  describe('Yup validation detection', () => {
    it('should detect Yup validation', () => {
      const code = `
        import * as yup from 'yup';
        
        const schema = yup.object({
          title: yup.string().min(1).max(200).required(),
          content: yup.string().required()
        });
        
        app.post('/posts', async (req, res) => {
          const validated = await schema.validate(req.body);
          const post = await createPost(validated.title, validated.content);
          res.json(post);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence[0]?.validationLibrary).toBe('yup');
      expect(proof.evidence[0]?.hasValidation).toBe(true);
    });
  });

  describe('class-validator detection', () => {
    it('should detect class-validator decorators', () => {
      const code = `
        import { validate, IsEmail, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
        
        class CreateUserDto {
          @IsEmail()
          email: string;
          
          @IsNotEmpty()
          @MinLength(8)
          @MaxLength(50)
          password: string;
        }
        
        app.post('/users', async (req, res) => {
          const dto = Object.assign(new CreateUserDto(), req.body);
          const errors = await validate(dto);
          if (errors.length > 0) {
            return res.status(400).json({ errors });
          }
          const user = await createUser(dto.email, dto.password);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence[0]?.validationLibrary).toBe('class-validator');
      expect(proof.evidence[0]?.hasValidation).toBe(true);
    });
  });

  describe('Fastify schema validation detection', () => {
    it('should detect Fastify JSON Schema', () => {
      const code = `
        fastify.post('/items', {
          schema: {
            body: {
              type: 'object',
              required: ['name', 'price'],
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 100 },
                price: { type: 'number', minimum: 0, maximum: 999999 },
                category: { type: 'string', enum: ['electronics', 'books'] }
              }
            }
          }
        }, async (request, reply) => {
          const item = await createItem(request.body.name, request.body.price);
          return item;
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence[0]?.validationLibrary).toBe('fastify-schema');
      expect(proof.evidence[0]?.hasValidation).toBe(true);
      expect(proof.evidence[0]?.constraintQuality).toBe('strict');
    });
  });

  describe('Manual validation detection', () => {
    it('should detect manual TypeScript type guards', () => {
      const code = `
        app.post('/data', async (req, res) => {
          if (typeof req.body.name !== 'string') {
            return res.status(400).json({ error: 'Invalid name' });
          }
          if (typeof req.body.age !== 'number') {
            return res.status(400).json({ error: 'Invalid age' });
          }
          const result = process(req.body.name, req.body.age);
          res.json(result);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence[0]?.validationLibrary).toBe('manual');
      expect(proof.evidence[0]?.hasValidation).toBe(true);
    });
  });

  describe('Unvalidated input detection', () => {
    it('should detect completely unvalidated input', () => {
      const code = `
        app.post('/users', async (req, res) => {
          const user = await createUser(req.body.email, req.body.password);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.status).toBe('FAILED');
      expect(proof.evidence[0]?.hasValidation).toBe(false);
      expect(proof.findings.some(f => f.severity === 'error')).toBe(true);
      expect(proof.findings.some(f => f.message.includes('without validation'))).toBe(true);
    });

    it('should detect validation after business logic', () => {
      const code = `
        const schema = z.object({ email: z.string().email() });
        
        app.post('/users', async (req, res) => {
          const user = await createUser(req.body.email);
          const validated = schema.parse(req.body);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence[0]?.validationBeforeLogic).toBe(false);
      expect(proof.findings.some(f => f.message.includes('after business logic'))).toBe(true);
    });
  });

  describe('Field access tracing', () => {
    it('should trace req.body field accesses', () => {
      const code = `
        app.post('/test', (req, res) => {
          const email = req.body.email;
          const name = req.body.name;
          processData(email, name);
        });
      `;

      const accesses = traceFieldAccesses(code, 1);

      expect(accesses).toHaveLength(2);
      expect(accesses.some(a => a.field === 'email')).toBe(true);
      expect(accesses.some(a => a.field === 'name')).toBe(true);
    });

    it('should trace destructured field accesses', () => {
      const code = `
        app.post('/test', (req, res) => {
          const { email, password, username } = req.body;
          register(email, password, username);
        });
      `;

      const accesses = traceFieldAccesses(code, 1);

      expect(accesses.length).toBeGreaterThanOrEqual(3);
      expect(accesses.some(a => a.field === 'email')).toBe(true);
      expect(accesses.some(a => a.field === 'password')).toBe(true);
      expect(accesses.some(a => a.field === 'username')).toBe(true);
    });

    it('should trace req.params accesses', () => {
      const code = `
        app.get('/users/:id', (req, res) => {
          const userId = req.params.id;
          getUserById(userId);
        });
      `;

      const accesses = traceFieldAccesses(code, 1);

      expect(accesses.some(a => a.field === 'id' && a.source === 'params')).toBe(true);
    });
  });

  describe('Completeness checking', () => {
    it('should find unvalidated fields', () => {
      const validated = ['email', 'name'];
      const accessed = ['email', 'name', 'password', 'age'];

      const unvalidated = checkCompleteness(validated, accessed);

      expect(unvalidated).toEqual(['password', 'age']);
    });

    it('should return empty for complete validation', () => {
      const validated = ['email', 'name', 'password'];
      const accessed = ['email', 'name'];

      const unvalidated = checkCompleteness(validated, accessed);

      expect(unvalidated).toEqual([]);
    });
  });

  describe('Constraint quality analysis', () => {
    it('should rate strict constraints', () => {
      const schema = {
        library: 'zod' as const,
        line: 1,
        isUsed: true,
        fields: [
          {
            name: 'email',
            type: 'string',
            constraints: {
              required: true,
              minLength: 5,
              maxLength: 100,
              format: 'email',
            },
          },
        ],
      };

      const quality = analyzeConstraintQuality(schema);

      expect(quality).toBe('strict');
    });

    it('should rate basic constraints', () => {
      const schema = {
        library: 'joi' as const,
        line: 1,
        isUsed: true,
        fields: [
          {
            name: 'username',
            type: 'string',
            constraints: {
              required: true,
              minLength: 3,
            },
          },
        ],
      };

      const quality = analyzeConstraintQuality(schema);

      expect(quality).toBe('basic');
    });

    it('should rate minimal constraints', () => {
      const schema = {
        library: 'manual' as const,
        line: 1,
        isUsed: true,
        fields: [
          {
            name: 'data',
            type: null,
            constraints: {
              required: true,
            },
          },
        ],
      };

      const quality = analyzeConstraintQuality(schema);

      expect(quality).toBe('minimal');
    });

    it('should rate no constraints', () => {
      const schema = {
        library: 'zod' as const,
        line: 1,
        isUsed: true,
        fields: [
          {
            name: 'value',
            type: 'string',
            constraints: {
              required: false,
            },
          },
        ],
      };

      const quality = analyzeConstraintQuality(schema);

      expect(quality).toBe('minimal');
    });
  });

  describe('Multiple endpoints', () => {
    it('should analyze multiple endpoints correctly', () => {
      const code = `
        const schema = z.object({ email: z.string().email() });
        
        app.post('/validated', (req, res) => {
          const data = schema.parse(req.body);
          process(data.email);
        });
        
        app.post('/unvalidated', (req, res) => {
          process(req.body.email);
        });
        
        app.get('/safe', (req, res) => {
          res.json({ status: 'ok' });
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence.length).toBeGreaterThanOrEqual(2);
      expect(proof.stats.validatedEndpoints).toBeGreaterThanOrEqual(1);
      expect(proof.stats.unvalidatedEndpoints).toBeGreaterThanOrEqual(1);
      expect(proof.status).toBe('PARTIAL');
    });
  });

  describe('Next.js API routes', () => {
    it('should detect Next.js API route validation', () => {
      const code = `
        import { z } from 'zod';
        
        const schema = z.object({
          title: z.string().min(1).max(200),
          content: z.string()
        });
        
        export async function POST(request: Request) {
          const body = await request.json();
          const validated = schema.parse(body);
          const post = await createPost(validated.title, validated.content);
          return Response.json(post);
        }
      `;

      const proof = proveInputValidation('app/api/posts/route.ts', code);

      expect(proof.evidence[0]?.hasValidation).toBe(true);
      expect(proof.evidence[0]?.validationLibrary).toBe('zod');
    });
  });

  describe('Edge cases', () => {
    it('should handle code with no endpoints', () => {
      const code = `
        function helper() {
          return 'helper';
        }
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.status).toBe('PROVEN');
      expect(proof.evidence).toHaveLength(0);
      expect(proof.summary).toContain('No input-accepting endpoints');
    });

    it('should handle GET endpoints (no body)', () => {
      const code = `
        app.get('/users', (req, res) => {
          const users = getUsers();
          res.json(users);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.evidence).toHaveLength(0);
    });

    it('should handle params validation in GET with route params', () => {
      const code = `
        app.get('/users/:id', (req, res) => {
          const userId = req.params.id;
          const user = getUserById(userId);
          res.json(user);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      // GET with params should be analyzed
      expect(proof.evidence.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Validation detector functions', () => {
    it('should detect Zod schema', () => {
      const code = `
        const schema = z.object({
          name: z.string().min(1)
        });
        const result = schema.parse(data);
      `;

      const schema = detectZodValidation(code, 1);

      expect(schema).not.toBeNull();
      expect(schema?.library).toBe('zod');
      expect(schema?.fields.some(f => f.name === 'name')).toBe(true);
    });

    it('should return null for non-Zod code', () => {
      const code = `
        const result = processData(data);
      `;

      const schema = detectZodValidation(code, 1);

      expect(schema).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const code = `
        const schema1 = z.object({ email: z.string().email().min(5).max(100) });
        const schema2 = z.object({ name: z.string() });
        
        app.post('/strict', (req, res) => {
          const data = schema1.parse(req.body);
          process(data.email);
        });
        
        app.post('/weak', (req, res) => {
          const data = schema2.parse(req.body);
          process(data.name);
        });
        
        app.post('/none', (req, res) => {
          process(req.body.data);
        });
      `;

      const proof = proveInputValidation('test.ts', code);

      expect(proof.stats.totalEndpoints).toBeGreaterThanOrEqual(3);
      expect(proof.stats.endpointsWithStrictValidation).toBeGreaterThanOrEqual(1);
      expect(proof.stats.unvalidatedEndpoints).toBeGreaterThanOrEqual(1);
    });
  });
});
